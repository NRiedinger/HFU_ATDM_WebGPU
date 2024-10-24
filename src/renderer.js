const vertices = new Float32Array([-0.8, -0.8, 0.8, -0.8, 0.0, 0.8]);

const canvas = document.querySelector("canvas");

const PARTICLE_COUNT = 10;
const PARTICLE_SCALE = 0.01;
const PARTICLE_EXTENT = 100;

const MOVE_SPEED = 1.0;
const ALIGNMENT_WEIGHT = 0.5;
const SEPARATION_WEIGHT = 0.5;
const TARGET_WEIGHT = 0.5;

const WORKGROUP_SIZE = 8;
const FRAMETIME = 100;
let step = 0;

export class Renderer {
  constructor() {
    this.setup().then(() => {
      // start animation
      this.lastAnimationTime = Date.now();
      requestAnimationFrame(this.frame.bind(this));
    });
  }

  async setup() {
    if (!navigator.gpu) {
      throw new Error("WebGPU not supported on this browser.");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("No appropriate GPUAdapter found.");
    }

    this.device = await adapter.requestDevice();

    this.context = canvas.getContext("webgpu");
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: canvasFormat,
    });

    // define vertex buffer
    this.vertexBuffer = this.device.createBuffer({
      label: "Particle vertices",
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(
      this.vertexBuffer,
      /*bufferOffset=*/ 0,
      vertices
    );

    const vertexBufferLayout = {
      arrayStride: 8,
      attributes: [
        {
          format: "float32x2",
          offset: 0,
          shaderLocation: 0, // Position, see vertex shader
        },
      ],
    };

    const particleShaderModule = this.device.createShaderModule({
      label: "Particle shader",
      code: `

struct VertexInput {
  @location(0) pos: vec2f,
  @builtin(instance_index) instance: u32,
};

struct VertexOutput {
  @builtin(position) pos: vec4f,
};

struct ParticleState {
  position: vec2f,
  forward: vec2f
};

@group(0) @binding(0) var<storage> particleStates: array<ParticleState>;

const particleScale = ${PARTICLE_SCALE};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {

  let i = f32(input.instance);
  let state = particleStates[input.instance];

  let pos = (input.pos + state.position) * particleScale;

  var output: VertexOutput;
  output.pos = vec4f(pos, 0, 1);
  return output;
}


@fragment
fn fragmentMain() -> @location(0) vec4f {
  return vec4f(1, 1, 1, 1);
}
`,
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      label: "Particle Bind Group Layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // particle state input buffer
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // particle state output buffer
        },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      label: "Particle Pipeline Layout",
      bindGroupLayouts: [bindGroupLayout],
    });

    this.particleRenderPipeline = this.device.createRenderPipeline({
      label: "Particle render pipeline",
      layout: pipelineLayout,
      vertex: {
        module: particleShaderModule,
        entryPoint: "vertexMain",
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: particleShaderModule,
        entryPoint: "fragmentMain",
        targets: [
          {
            format: canvasFormat,
          },
        ],
      },
    });

    const particleStateArray = new Float32Array(PARTICLE_COUNT * 4);
    const particleStateStorage = [
      this.device.createBuffer({
        label: "Particle state A",
        size: particleStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      this.device.createBuffer({
        label: "Particle state B",
        size: particleStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
    ];

    for (let i = 0; i < particleStateArray.length; i += 4) {
      particleStateArray[i] = (Math.random() * 2 - 1) * PARTICLE_EXTENT;
      particleStateArray[i + 1] = (Math.random() * 2 - 1) * PARTICLE_EXTENT;
      particleStateArray[i + 2] = 0.0;
      particleStateArray[i + 3] = 0.0;
    }
    this.device.queue.writeBuffer(
      particleStateStorage[0],
      0,
      particleStateArray
    );

    // create bind group
    this.bindGroups = [
      this.device.createBindGroup({
        label: "Cell renderer bind group A",
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: particleStateStorage[0] },
          },
          {
            binding: 1,
            resource: { buffer: particleStateStorage[1] },
          },
        ],
      }),
      this.device.createBindGroup({
        label: "Cell renderer bind group B",
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: particleStateStorage[1] },
          },
          {
            binding: 1,
            resource: { buffer: particleStateStorage[0] },
          },
        ],
      }),
    ];

    const simulationShaderModule = this.device.createShaderModule({
      label: "compute shader",
      code: `
struct ParticleState {
  position: vec2f,
  forward: vec2f
};

@group(0) @binding(0) var<storage> particleStatesIn: array<ParticleState>;
@group(0) @binding(1) var<storage, read_write> particleStatesOut: array<ParticleState>; 

const numParticles = ${PARTICLE_COUNT};
const alignmentWeight = ${ALIGNMENT_WEIGHT};
const separationWeight = ${SEPARATION_WEIGHT};
const targetWeight = ${TARGET_WEIGHT};
const targetPosition = vec2f(0);
const moveSpeed = ${MOVE_SPEED};

fn normalizeSafe(v: vec2f) -> vec2f {
  if(length(v) > 0) {
    return normalize(v);
  }
  return vec2f(0);
}

@compute
@workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE})
fn computeMain(@builtin(global_invocation_id) id: vec3u) {

  let particleIndex = id.x;
  let stateSelf = particleStatesIn[particleIndex];
  var cellAlignment: vec2f;
  var cellSeparation: vec2f;

  for(var i = 0; i < numParticles; i++) {
    let stateSelf = particleStatesIn[i];
    cellAlignment += stateSelf.forward;
    cellSeparation += stateSelf.position;
  }

  let alignmentResult = alignmentWeight * normalizeSafe((cellAlignment / numParticles) - stateSelf.forward);
  let separationResult = separationWeight * normalizeSafe((stateSelf.position / numParticles) - cellSeparation);
  let targetHeading = targetWeight * normalizeSafe(targetPosition - stateSelf.position);

  let normalHeading = normalizeSafe(alignmentResult + separationResult + targetHeading);
  let nextHeading = normalizeSafe(stateSelf.forward + /*deltaTime * */ (normalHeading - stateSelf.forward));

  var stateResult: ParticleState;
  stateResult.position = stateSelf.position + (nextHeading * moveSpeed /* * deltaTime*/);
  stateResult.forward = nextHeading;
  particleStatesOut[particleIndex] = stateResult;
}
      `,
    });

    this.simulationPipeline = this.device.createComputePipeline({
      label: "simulation pipeline",
      layout: pipelineLayout,
      compute: {
        module: simulationShaderModule,
        entryPoint: "computeMain",
      },
    });
  }

  frame() {
    const currentAnimationTime = Date.now();
    const deltaTime = currentAnimationTime - this.lastAnimationTime;

    if (deltaTime > FRAMETIME) {
      this.lastAnimationTime = currentAnimationTime - (deltaTime % FRAMETIME);

      const encoder = this.device.createCommandEncoder();

      const computePass = encoder.beginComputePass();
      computePass.setPipeline(this.simulationPipeline);
      computePass.setBindGroup(0, this.bindGroups[step % 2]);

      const workgroupCount = Math.ceil(PARTICLE_COUNT / WORKGROUP_SIZE);
      computePass.dispatchWorkgroups(workgroupCount, workgroupCount);

      computePass.end();

      step++;

      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.context.getCurrentTexture().createView(),
            loadOp: "clear",
            clearValue: { r: 0.02, g: 0.02, b: 0.02, a: 1 },
            storeOp: "store",
          },
        ],
      });

      pass.setPipeline(this.particleRenderPipeline);
      pass.setVertexBuffer(0, this.vertexBuffer);
      pass.setBindGroup(0, this.bindGroups[step % 2]);
      pass.draw(vertices.length / 2, PARTICLE_COUNT);

      pass.end();

      // Finish the command buffer and immediately submit it.
      this.device.queue.submit([encoder.finish()]);
    }

    requestAnimationFrame(this.frame.bind(this));
  }
}
