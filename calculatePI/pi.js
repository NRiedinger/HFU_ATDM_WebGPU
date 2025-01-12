import { computeShaderCode } from "./computeShader.js";

let adapter;
let device;
let hasTimestampQuery;

export async function run(numGPUPasses, numIterations, numGPUThreads) {
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
  };

  for (let i = 0; i < numGPUPasses; i++) {
    const passResult = await runGPUPass(numIterations, numGPUThreads);
    result.totalSamples += passResult.totalSamples;
    result.positiveSamples += passResult.positiveSamples;
  }

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

  const valueCount = parameters.numParallelCalculations;
  const valueArray = new Int32Array(valueCount);
  for (let i = 0; i < valueArray.length; i++) {
    valueArray[i] = 0;
  }

  const computeBuffer = device.createBuffer({
    label: "compute buffer",
    size: valueArray.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const computeResultBuffer = device.createBuffer({
    label: "compute result buffer",
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

  const startTime = performance.now();

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass(computePassDescriptor);

  passEncoder.setPipeline(computePipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(valueCount / 64));
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

  if (hasTimestampQuery) {
    timestampResultBuffer.mapAsync(GPUMapMode.READ).then(() => {
      const times = new BigInt64Array(timestampResultBuffer.getMappedRange());
      const computePassDuration = Number(times[1] - times[0]);

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
    });
  }

  await computeResultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Int32Array(computeResultBuffer.getMappedRange());

  let positiveSamples = 0;
  for (let i = 0; i < result.length; i++) {
    positiveSamples += result[i];
  }

  const totalSamples = valueCount * parameters.iterations;
  /* const calcPi = 4.0 * (positiveSamples / totalSamples); */

  const duration = performance.now() - startTime;

  //console.log(result);
  /* console.log("count:", count);
  console.log("samples:", samples);
  console.log("My PI:", calcPi);
  console.log("JS PI:", Math.PI); */

  /*   document.getElementById("result").textContent = `\
samples in circle: ${count}
total samples:     ${samples}

calculated PI: ${calcPi}
Math.PI:       ${Math.PI}

Javascript duration:   ${duration.toFixed(0)} ms`; */

  return {
    positiveSamples: positiveSamples,
    totalSamples: totalSamples,
  };
}
