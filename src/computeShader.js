export const computeShaderCode = `
struct ParticleState {
  position: vec2f,
  forward: vec2f
};

struct UniformParameter {
  deltaTime: f32,
  timeScale: f32
};

@group(0) @binding(0) var<storage> particleStatesIn: array<ParticleState>;
@group(0) @binding(1) var<storage, read_write> particleStatesOut: array<ParticleState>; 

@group(0) @binding(2) var<uniform> params: UniformParameter;

const alignmentWeight = 0.5;
const separationWeight = 0.5;
const targetWeight = 0.5;
const targetPosition = vec2f(0);
const moveSpeed = 1.0;

fn normalizeSafe(v: vec2f) -> vec2f {
  if(length(v) > 0) {
    return normalize(v);
  }
  return vec2f(0);
}

@compute
@workgroup_size(8, 1, 1)
fn computeMain(@builtin(global_invocation_id) id: vec3u) {

  let particleIndex = id.x;
  let stateSelf = particleStatesIn[particleIndex];
  let numParticles = arrayLength(&particleStatesIn);
  var cellAlignment: vec2f;
  var cellSeparation: vec2f;

  for(var i = 0u; i < numParticles; i++) {
    if (i == particleIndex) {
      continue;
    }

    let stateOther = particleStatesIn[i];
    cellAlignment += stateOther.forward;
    cellSeparation += stateOther.position;
  }

  let alignmentResult = alignmentWeight * normalizeSafe((cellAlignment / f32(numParticles)) - stateSelf.forward);
  let separationResult = separationWeight * normalizeSafe((stateSelf.position / f32(numParticles)) - cellSeparation);
  let targetHeading = targetWeight * normalizeSafe(targetPosition - stateSelf.position);

  let normalHeading = normalizeSafe(alignmentResult + separationResult + targetHeading);
  let nextHeading = normalizeSafe(stateSelf.forward + params.deltaTime * params.timeScale * (normalHeading - stateSelf.forward));
  // let nextHeading = normalizeSafe(stateSelf.forward + (normalHeading - stateSelf.forward));


  var stateResult: ParticleState;
  stateResult.position = stateSelf.position + (nextHeading * moveSpeed * params.deltaTime * params.timeScale);
  // stateResult.position = stateSelf.position + (nextHeading * moveSpeed);
  stateResult.forward = nextHeading;
  particleStatesOut[particleIndex] = stateResult;
}
`;
