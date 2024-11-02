import { particleShaderCode } from "./particleShader.js";
import { computeShaderCode } from "./computeShader.js";

const vertices = new Float32Array([-0.8, -0.8, 0.8, -0.8, 0.0, 0.8]);

const canvas = document.querySelector("canvas");

const PARTICLE_COUNT = 32;
const PARTICLE_EXTENT = 100.0;

const MOVE_SPEED = 1.0;
const ALIGNMENT_WEIGHT = 0.5;
const SEPARATION_WEIGHT = 0.5;
const TARGET_WEIGHT = 0.5;

const WORKGROUP_SIZE = 8;
const FRAMERATE = 60;
const FRAMETIME = 1000 / FRAMERATE;

const parameters = {
  deltaTime: 0.0,
  timeScale: 0.02,
};

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
      code: particleShaderCode,
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
        {
          binding: 2,
          visibility:
            GPUShaderStage.VERTEX |
            GPUShaderStage.FRAGMENT |
            GPUShaderStage.COMPUTE,
          buffer: {}, // grid uniform buffer
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

    // uniform buffer
    const uniformBufferSize = 2 * Float32Array.BYTES_PER_ELEMENT;
    this.uniformValues = new Float32Array([
      parameters.deltaTime,
      parameters.timeScale,
    ]);
    this.uniformBuffer = this.device.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformValues);

    this.particleStateArray = new Float32Array(PARTICLE_COUNT * 4);
    this.particleStateStorage = [
      this.device.createBuffer({
        label: "Particle state A",
        size: this.particleStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      this.device.createBuffer({
        label: "Particle state B",
        size: this.particleStateArray.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
    ];

    for (let i = 0; i < this.particleStateArray.length; i += 4) {
      this.particleStateArray[i] = (Math.random() * 2 - 1) * PARTICLE_EXTENT;
      this.particleStateArray[i + 1] =
        (Math.random() * 2 - 1) * PARTICLE_EXTENT;
      this.particleStateArray[i + 2] = 0.0;
      this.particleStateArray[i + 3] = 0.0;
    }
    this.device.queue.writeBuffer(
      this.particleStateStorage[0],
      0,
      this.particleStateArray
    );

    // create bind group
    this.bindGroups = [
      this.device.createBindGroup({
        label: "Cell renderer bind group A",
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: this.particleStateStorage[0] },
          },
          {
            binding: 1,
            resource: { buffer: this.particleStateStorage[1] },
          },
          {
            binding: 2,
            resource: { buffer: this.uniformBuffer },
          },
        ],
      }),
      this.device.createBindGroup({
        label: "Cell renderer bind group B",
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: this.particleStateStorage[1] },
          },
          {
            binding: 1,
            resource: { buffer: this.particleStateStorage[0] },
          },
          {
            binding: 2,
            resource: { buffer: this.uniformBuffer },
          },
        ],
      }),
    ];

    const simulationShaderModule = this.device.createShaderModule({
      label: "compute shader",
      code: computeShaderCode,
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

      this.uniformValues.set([deltaTime], 0);
      this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformValues);

      const encoder = this.device.createCommandEncoder();

      const computePass = encoder.beginComputePass();
      computePass.setPipeline(this.simulationPipeline);
      computePass.setBindGroup(0, this.bindGroups[step % 2]);

      const workgroupCount = Math.ceil(PARTICLE_COUNT / WORKGROUP_SIZE);
      computePass.dispatchWorkgroups(
        Math.ceil(PARTICLE_COUNT / WORKGROUP_SIZE),
        1,
        1
      );

      computePass.end();

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

      step++;
    }

    requestAnimationFrame(this.frame.bind(this));
  }
}
