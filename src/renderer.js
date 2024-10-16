const vertices = new Float32Array([
  //   X,    Y,
  -0.8,
  -0.8, // Triangle 1 (Blue)
  0.8,
  -0.8,
  0.8,
  0.8,

  -0.8,
  -0.8, // Triangle 2 (Red)
  0.8,
  0.8,
  -0.8,
  0.8,
]);

const canvas = document.querySelector("canvas");
const GRID_SIZE = 50;
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

    const vertices = new Float32Array([
      //   X,    Y,
      -0.8,
      -0.8, // Triangle 1 (Blue)
      0.8,
      -0.8,
      0.8,
      0.8,

      -0.8,
      -0.8, // Triangle 2 (Red)
      0.8,
      0.8,
      -0.8,
      0.8,
    ]);

    this.vertexBuffer = this.device.createBuffer({
      label: "Cell vertices",
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

    const cellShaderModule = this.device.createShaderModule({
      label: "Cell shader",
      code: `

struct VertexInput {
@location(0) pos: vec2f,
@builtin(instance_index) instance: u32,
};

struct VertexOutput {
@builtin(position) pos: vec4f,
@location(0) cell: vec2f,
};

@group(0) @binding(0) var<uniform> grid: vec2f;
@group(0) @binding(1) var<storage> cellState: array<u32>;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {

let i = f32(input.instance);
let cell = vec2f(i % grid.x, floor(i / grid.x));
let state = f32(cellState[input.instance]);

let cellOffset = cell / grid * 2;
let gridPos = (input.pos * state + 1) / grid - 1 + cellOffset;

var output: VertexOutput;
output.pos = vec4f(gridPos, 0, 1);
output.cell = cell;
return output;
}


struct FragInput {
@location(0) cell: vec2f,
};

@fragment
fn fragmentMain(input: FragInput) -> @location(0) vec4f {
let c = input.cell / grid;
return vec4f(c, 1 - c.x, 1);
}
`,
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      label: "Cell Bind Group Layout",
      entries: [
        {
          binding: 0,
          visibility:
            GPUShaderStage.VERTEX |
            GPUShaderStage.FRAGMENT |
            GPUShaderStage.COMPUTE,
          buffer: {}, // grid uniform buffer
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" }, // cell state input buffer
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" }, // cell state output buffer
        },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      label: "Cell Pipeline Layout",
      bindGroupLayouts: [bindGroupLayout],
    });

    this.cellPipeline = this.device.createRenderPipeline({
      label: "Cell pipeline",
      layout: pipelineLayout,
      vertex: {
        module: cellShaderModule,
        entryPoint: "vertexMain",
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: cellShaderModule,
        entryPoint: "fragmentMain",
        targets: [
          {
            format: canvasFormat,
          },
        ],
      },
    });

    // create uniform buffer
    const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
    const uniformBuffer = this.device.createBuffer({
      label: "Grid Uniforms",
      size: uniformArray.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

    // create cell state array
    const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE);
    const cellStateStorage = [
      this.device.createBuffer({
        label: "Cell state A",
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      this.device.createBuffer({
        label: "Cell state B",
        size: cellStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
    ];

    for (let i = 0; i < cellStateArray.length; i++) {
      cellStateArray[i] = Math.random() > 0.6 ? 1 : 0;
    }
    this.device.queue.writeBuffer(cellStateStorage[0], 0, cellStateArray);

    // create bind group
    this.bindGroups = [
      this.device.createBindGroup({
        label: "Cell renderer bind group A",
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
          {
            binding: 1,
            resource: { buffer: cellStateStorage[0] },
          },
          {
            binding: 2,
            resource: { buffer: cellStateStorage[1] },
          },
        ],
      }),
      this.device.createBindGroup({
        label: "Cell renderer bind group B",
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
          {
            binding: 1,
            resource: { buffer: cellStateStorage[1] },
          },
          {
            binding: 2,
            resource: { buffer: cellStateStorage[0] },
          },
        ],
      }),
    ];

    const simulationShaderModule = this.device.createShaderModule({
      label: "Game of Life simulation shader",
      code: `
@group(0) @binding(0) var<uniform> grid: vec2f;

@group(0) @binding(1) var<storage> cellStateIn: array<u32>;
@group(0) @binding(2) var<storage, read_write> cellStateOut: array<u32>; 

fn cellIndex(cell: vec2u) -> u32 {
return (cell.y % u32(grid.y)) * u32(grid.x) + (cell.x % u32(grid.x));
}

fn cellActive(x: u32, y: u32) -> u32 {
return cellStateIn[cellIndex(vec2(x, y))];
}

@compute
@workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE})
fn computeMain(@builtin(global_invocation_id) cell: vec3u) {
let activeNeighbors = cellActive(cell.x+1, cell.y+1) +
                      cellActive(cell.x+1, cell.y) +
                      cellActive(cell.x+1, cell.y-1) +
                      cellActive(cell.x, cell.y-1) +
                      cellActive(cell.x-1, cell.y-1) +
                      cellActive(cell.x-1, cell.y) +
                      cellActive(cell.x-1, cell.y+1) +
                      cellActive(cell.x, cell.y+1);

let i = cellIndex(cell.xy);

switch activeNeighbors {
  case 2: {
    cellStateOut[i] = cellStateIn[i];
  }
  case 3: {
    cellStateOut[i] = 1;
  }
  default: {
    cellStateOut[i] = 0;
  }
}
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

      const workgroupCount = Math.ceil(GRID_SIZE / WORKGROUP_SIZE);
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

      pass.setPipeline(this.cellPipeline);
      pass.setVertexBuffer(0, this.vertexBuffer);
      pass.setBindGroup(0, this.bindGroups[step % 2]);
      pass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE);

      pass.end();

      // Finish the command buffer and immediately submit it.
      this.device.queue.submit([encoder.finish()]);
    }

    requestAnimationFrame(this.frame.bind(this));
  }
}
