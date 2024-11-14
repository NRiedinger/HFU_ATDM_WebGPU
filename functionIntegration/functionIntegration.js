import { computeShaderCode } from "./computeShader.js";

export async function run() {
  if (!navigator.gpu) {
    throw new Error("WebGPU is not supported on this browser");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("No appropriate GPU adapter found.");
  }

  const device = await adapter.requestDevice();

  const computePipeline = device.createComputePipeline({
    label: "compute pipeline",
    layout: "auto",
    compute: {
      module: device.createShaderModule({
        label: "compute shader",
        code: computeShaderCode,
      }),
    },
  });

  const valueCount = 100;
  const valueArray = new Float32Array(valueCount);
  for (let i = 0; i < valueArray.length; i++) {
    valueArray[i] = 0.0;
  }

  const computeBuffer = device.createBuffer({
    size: valueArray.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const resultBuffer = device.createBuffer({
    size: valueArray.byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: computeBuffer } }],
  });

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();

  passEncoder.setPipeline(computePipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(valueCount / 64));
  passEncoder.end();

  commandEncoder.copyBufferToBuffer(
    computeBuffer,
    0,
    resultBuffer,
    0,
    resultBuffer.size
  );

  device.queue.submit([commandEncoder.finish()]);

  await resultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(resultBuffer.getMappedRange());

  console.log(result);
}
