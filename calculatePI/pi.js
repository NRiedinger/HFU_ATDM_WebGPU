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

  const hasTimestampQuery = adapter.features.has("timestamp-query");
  const device = await adapter.requestDevice({
    requiredFeatures: hasTimestampQuery ? ["timestamp-query"] : [],
  });

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
    size: valueArray.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const computeResultBuffer = device.createBuffer({
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
        document.getElementById(
          "result_GPUtime"
        ).textContent = `compute pass duration: ${
          computePassDuration / 1000
        } µs`;
      }

      timestampResultBuffer.unmap();
      spareResultBuffers.push(timestampResultBuffer);
    });
  }

  await computeResultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Int32Array(computeResultBuffer.getMappedRange());

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

  document.getElementById("result").textContent = `\
samples in circle: ${count}
total samples:     ${samples}

calculated PI: ${calcPi}
Math.PI:       ${Math.PI}

Javascript duration:   ${duration.toFixed(0)} ms`;
}
