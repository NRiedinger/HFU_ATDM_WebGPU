import { computeShaderCode } from "./computeShader.js";

let adapter;
let device;
let hasTimestampQuery;

export async function runGPUbySamples(numSamples, numGPUThreads) {
  const iterations = numSamples / numGPUThreads;
  return runGPU(1, iterations, numGPUThreads);
}

export async function runGPU(numGPUPasses, numIterations, numGPUThreads) {

  if (numIterations * numGPUThreads > 4_294_967_295) {
    console.warn(
      "numIterations * numGPUThreads is exceeding maximum u32 value and results might be wrong"
    );
  }

  if (!navigator.gpu) {
    throw new Error("WebGPU is not supported on this browser");
  }

  adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("No appropriate GPU adapter found.");
  }

  hasTimestampQuery = adapter.features.has("timestamp-query");
  device = await adapter.requestDevice({
    requiredFeatures: hasTimestampQuery ? ["timestamp-query"] : [],
  });

  const result = {
    totalSamples: 0,
    positiveSamples: 0,
    pi: 0,
    duration: 0,
    computePassDuration: 0,
  };

  const startTime = performance.now();

  for (let i = 0; i < numGPUPasses; i++) {
    const passResult = await runGPUPass(numIterations, numGPUThreads);
    result.totalSamples += passResult.totalSamples;
    result.positiveSamples += passResult.positiveSamples;
    result.computePassDuration += passResult.computePassDuration;
  }

  const duration = performance.now() - startTime;
  result.duration = duration;

  if (result.totalSamples > 0) {
    result.pi = 4.0 * (result.positiveSamples / result.totalSamples);
  }

  return result;
}

async function runGPUPass(numIterations, numGPUThreads) {
  const parameters = {
    iterations: numIterations,
    numParallelCalculations: numGPUThreads,
    seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
  };

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

  const computePassDescriptor = {};
  let querySet, resolveBuffer;
  const spareResultBuffers = [];
  if (hasTimestampQuery) {
    querySet = device.createQuerySet({
      type: "timestamp",
      count: 2,
    });

    resolveBuffer = device.createBuffer({
      label: "resolve buffer",
      size: 2 * BigInt64Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });

    computePassDescriptor.timestampWrites = {
      querySet: querySet,
      beginningOfPassWriteIndex: 0,
      endOfPassWriteIndex: 1,
    };
  }

  const uniformValues = new Int32Array([
    parameters.iterations,
    parameters.seed,
  ]);
  const uniformBuffer = device.createBuffer({
    label: "uniform buffer",
    size: uniformValues.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniformValues);

  // test
  const sumValue = new Uint32Array(1);
  const computeBuffer = device.createBuffer({
    label: "compute buffer",
    size: sumValue.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const computeResultBuffer = device.createBuffer({
    label: "compute result buffer",
    size: sumValue.byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: computeBuffer } },
    ],
  });

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass(computePassDescriptor);

  passEncoder.setPipeline(computePipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(
    Math.ceil(parameters.numParallelCalculations / 64)
  );
  passEncoder.end();

  commandEncoder.copyBufferToBuffer(
    computeBuffer,
    0,
    computeResultBuffer,
    0,
    computeResultBuffer.size
  );

  let timestampResultBuffer;
  if (hasTimestampQuery) {
    timestampResultBuffer =
      spareResultBuffers.pop() ||
      device.createBuffer({
        label: "timestamp result buffer",
        size: 2 * BigInt64Array.BYTES_PER_ELEMENT,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });

    commandEncoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
    commandEncoder.copyBufferToBuffer(
      resolveBuffer,
      0,
      timestampResultBuffer,
      0,
      timestampResultBuffer.size
    );
  }

  device.queue.submit([commandEncoder.finish()]);

  let computePassDuration = 0;
  if (hasTimestampQuery) {
    await timestampResultBuffer.mapAsync(GPUMapMode.READ);
    const times = new BigInt64Array(timestampResultBuffer.getMappedRange());
    computePassDuration = Number(times[1] - times[0]);

    if (computePassDuration > 0) {
      /* document.getElementById(
          "result_GPUtime"
        ).textContent = `compute pass duration: ${
          computePassDuration / 1000
        } µs`; */
    }

    /* console.log(computePassDuration / 1000); */

    timestampResultBuffer.unmap();
    spareResultBuffers.push(timestampResultBuffer);
  }

  await computeResultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Int32Array(computeResultBuffer.getMappedRange());

  let positiveSamples = result[0];

  const totalSamples =
    parameters.numParallelCalculations * parameters.iterations;

  return {
    positiveSamples: positiveSamples,
    totalSamples: totalSamples,
    computePassDuration: computePassDuration / 1000 / 1000,
  };
}

export async function runCPU(numIterations) {

  const startTime = performance.now();

  let count = 0;
  for(let i = 0; i < numIterations; i++) {
    const x = Math.random();
    const y = Math.random();
    if(x * x + y * y <= 1.0) {
      count++;
    }
  }

  const duration = performance.now() - startTime;

  return {
    totalSamples: numIterations,
    positiveSamples: count,
    pi: 4.0 * (count / numIterations),
    duration: duration,
  }
}
