import { particleShaderCode } from "./particleShader.js";
import { computeShaderCode } from "./computeShader.js";
import { Vector2 } from "./vector2.js";

const vertices = new Float32Array([-0.01, -0.02, 0.01, -0.02, 0.0, 0.02]);

const canvas = document.querySelector("canvas");

const parameters = {
  deltaTime: 0, // updated in render loop
  timeScale: 5.0,
  maxSpeed: 0.1,
  r1d: 0.1,
  r2d: 0.025,
  r3d: 0.025,
  r1s: 0.02,
  r2s: 0.05,
  r3s: 0.005,
};

const performanceKeys = [
  "deltaTime",
  "timeScale",
  "maxSpeed",
  "r1d",
  "r2d",
  "r3d",
  "r1s",
  "r2s",
  "r3s",
];

let step = 0;

export class ParticleSimulation {
  constructor(particleCount, useGPU = true) {
    this.particleCount = particleCount;
    this.useGPU = useGPU;
    console.log(`Using ${this.useGPU ? "GPU" : "CPU"}`);

    this.setupUI();

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

    const particleShaderModule = this.device.createShaderModule({
      label: "Particle shader",
      code: particleShaderCode,
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      label: "Particle Bind Group Layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
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
        buffers: [
          {
            // vertex buffer
            arrayStride: 8,
            attributes: [
              {
                format: "float32x2",
                offset: 0,
                shaderLocation: 0, // Position, see vertex shader
              },
            ],
          },
          {
            // instance particle buffer
            arrayStride: 4 * 4,
            stepMode: "instance",
            attributes: [
              {
                // instance position
                shaderLocation: 1,
                offset: 0,
                format: "float32x2",
              },
              {
                // instance velocity
                shaderLocation: 2,
                offset: 2 * 4,
                format: "float32x2",
              },
            ],
          },
        ],
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
    const uniformBufferSize =
      Object.keys(parameters).length * Float32Array.BYTES_PER_ELEMENT;
    this.uniformValues = new Float32Array([
      parameters.deltaTime,
      parameters.timeScale,
      parameters.maxSpeed,
      parameters.r1d,
      parameters.r2d,
      parameters.r3d,
      parameters.r1s,
      parameters.r2s,
      parameters.r3s,
    ]);
    this.uniformBuffer = this.device.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformValues);

    this.particleStateArray = new Float32Array(this.particleCount * 4);
    this.particleStateStorage = [
      this.device.createBuffer({
        label: "Particle state A",
        size: this.particleStateArray.byteLength,
        usage:
          GPUBufferUsage.VERTEX |
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_DST,
      }),
      this.device.createBuffer({
        label: "Particle state B",
        size: this.particleStateArray.byteLength,
        usage:
          GPUBufferUsage.VERTEX |
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_DST,
      }),
    ];

    for (let i = 0; i < this.particleStateArray.length; i += 4) {
      this.particleStateArray[i] = 2 * (Math.random() - 0.5);
      this.particleStateArray[i + 1] = 2 * (Math.random() - 0.5);
      this.particleStateArray[i + 2] = 2 * (Math.random() - 0.5) * 0.1;
      this.particleStateArray[i + 3] = 2 * (Math.random() - 0.5) * 0.1;
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

  cpuSimulationStep() {
    const resultStateArray = new Float32Array(this.particleCount * 4);

    for (let i = 0; i < this.particleCount; i++) {
      let vPos = new Vector2(
        this.particleStateArray[i * 4 + 0],
        this.particleStateArray[i * 4 + 1]
      );
      let vVel = new Vector2(
        this.particleStateArray[i * 4 + 2],
        this.particleStateArray[i * 4 + 3]
      );

      let cMass = new Vector2();
      let cVel = new Vector2();
      let colVel = new Vector2();
      let cMassCount = 0;
      let cVelCount = 0;

      let pos, vel;

      for (let ii = 0; ii < this.particleCount; ii++) {
        if (i === ii) {
          continue;
        }

        pos = new Vector2(
          this.particleStateArray[ii * 4 + 0],
          this.particleStateArray[ii * 4 + 1]
        );
        vel = new Vector2(
          this.particleStateArray[ii * 4 + 2],
          this.particleStateArray[ii * 4 + 3]
        );

        if (Vector2.distance(pos, vPos) < parameters.r1d) {
          cMass = cMass.add(pos);
          cMassCount++;
        }

        if (Vector2.distance(pos, vPos) < parameters.r2d) {
          colVel = colVel.subtract(pos.subtract(vPos));
        }

        if (Vector2.distance(pos, vPos) < parameters.r3d) {
          cVel = cVel.add(vel);
          cVelCount++;
        }
      }

      if (cMassCount > 0) {
        cMass = cMass.scale(1 / cMassCount).subtract(vPos);
      }

      if (cVelCount > 0) {
        cVel = cVel.scale(1 / cVelCount);
      }

      vVel = vVel
        .add(cMass.scale(parameters.r1s))
        .add(colVel.scale(parameters.r2s))
        .add(cVel.scale(parameters.r3s));

      // clamp velocity
      const vVelLen = vVel.length();
      vVel = Vector2.normalize(vVel).scale(
        Math.min(Math.max(vVelLen, 0.0), parameters.maxSpeed)
      );

      // kinematic update
      vPos = vPos.add(
        vVel.scale(parameters.deltaTime).scale(parameters.timeScale)
      );

      // wrap around boundary
      if (vPos.x < -1.0) {
        vPos.x = 1.0;
      }

      if (vPos.x > 1.0) {
        vPos.x = -1.0;
      }

      if (vPos.y < -1.0) {
        vPos.y = 1.0;
      }

      if (vPos.y > 1.0) {
        vPos.y = -1.0;
      }

      resultStateArray[i * 4 + 0] = vPos.x;
      resultStateArray[i * 4 + 1] = vPos.y;
      resultStateArray[i * 4 + 2] = vVel.x;
      resultStateArray[i * 4 + 3] = vVel.y;
    }

    return resultStateArray;
  }

  updateUI() {
    const uiContainer = document.getElementById("ui-stats-container");

    const children = Array.from(uiContainer.children);
    for (const idx in children) {
      const child = children[idx];
      const span = child.querySelector("div[data-key]");
      const key = span.getAttribute("data-key");
      if (!key) continue;

      span.innerText = parameters[key];
    }
  }

  setupUI() {
    const uiContainer = document.getElementById("ui-stats-container");

    // remove all children from container
    while (uiContainer.firstChild) {
      uiContainer.removeChild(uiContainer.lastChild);
    }

    for (const idx in performanceKeys) {
      const key = performanceKeys[idx];
      const value = parameters[key];

      const uiRow = document.createElement("div");
      uiRow.classList.add("ui-row");

      const uiKey = document.createElement("div");
      uiKey.innerText = key;
      uiRow.appendChild(uiKey);

      const uiValue = document.createElement("div");
      uiValue.setAttribute("data-key", key);
      uiValue.innerText = value;
      uiRow.appendChild(uiValue);

      uiContainer.appendChild(uiRow);
    }

    setInterval(this.updateUI, 100);
  }

  frame() {
    parameters.deltaTime = (Date.now() - this.lastAnimationTime) / 1000;
    this.lastAnimationTime = Date.now();

    this.uniformValues.set([parameters.deltaTime], 0);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformValues);

    const commandEncoder = this.device.createCommandEncoder();

    if (this.useGPU) {
      // compute pass
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(this.simulationPipeline);
      pass.setBindGroup(0, this.bindGroups[step % 2]);
      pass.dispatchWorkgroups(Math.ceil(this.particleCount / 64), 1, 1);
      pass.end();
    } else {
      const stateArray = this.cpuSimulationStep();
      this.device.queue.writeBuffer(
        this.particleStateStorage[step % 2],
        0,
        stateArray
      );
      this.particleStateArray = stateArray;
    }

    {
      // render pass
      const pass = commandEncoder.beginRenderPass({
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
      pass.setVertexBuffer(1, this.particleStateStorage[step % 2]);
      pass.setBindGroup(0, this.bindGroups[step % 2]);
      pass.draw(vertices.length / 2, this.particleCount);
      pass.end();
    }

    // Finish the command buffer and immediately submit it.
    this.device.queue.submit([commandEncoder.finish()]);

    step++;

    requestAnimationFrame(this.frame.bind(this));
  }
}
