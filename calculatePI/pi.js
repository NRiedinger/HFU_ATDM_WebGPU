import { computeShaderCode } from "./computeShader.js";

const parameters = {
  iterations: 1_000_000,
  numParallelCalculations: 100_000,
  seed: Math.floor(Math.random() * 9999),
};

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

  const uniformValues = new Int32Array([
    parameters.iterations,
    parameters.seed,
  ]);
  const uniformBuffer = device.createBuffer({
    size: uniformValues.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

  const startTime = performance.now();

  const valueCount = parameters.numParallelCalculations;
  const valueArray = new Int32Array(valueCount);
  for (let i = 0; i < valueArray.length; i++) {
    valueArray[i] = 0;
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
    entries: [
      { binding: 0, resource: { buffer: computeBuffer } },
      { binding: 1, resource: { buffer: uniformBuffer } },
    ],
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
  const result = new Int32Array(resultBuffer.getMappedRange());

  let count = 0;
  for (let i = 0; i < result.length; i++) {
    count += result[i];
  }

  const samples = valueCount * parameters.iterations;
  const calcPi = 4.0 * (count / samples);

  const duration = performance.now() - startTime;

  //console.log(result);
  console.log("count:", count);
  console.log("samples:", samples);
  console.log("My PI:", calcPi);
  console.log("JS PI:", Math.PI);

  const el = document.getElementById('result');
  el.textContent = `\
  samples in circle: ${count}
  total samples: ${samples}
  calculated PI: ${calcPi}
  Math.PI:       ${Math.PI}

  duration: ${duration.toFixed(0)} ms;
  `;
}
