export const computeShaderCode = `
struct ParticleState {
  position: vec2f,
  velocity: vec2f
};

struct UniformParameter {
  deltaTime: f32,
  r1d: f32,
  r2d: f32,
  r3d: f32,
  r1s: f32,
  r2s: f32,
  r3s: f32,
};

@group(0) @binding(0) var<storage> particleStatesIn: array<ParticleState>;
@group(0) @binding(1) var<storage, read_write> particleStatesOut: array<ParticleState>; 

@group(0) @binding(2) var<uniform> params: UniformParameter;



@compute
@workgroup_size(64, 1, 1)
fn computeMain(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;

  var vPos = particleStatesIn[index].position;
  var vVel = particleStatesIn[index].velocity;
  var cMass = vec2(0.0);
  var cVel = vec2(0.0);
  var colVel = vec2(0.0);
  var cMassCount = 0u;
  var cVelCount = 0u;
  var pos: vec2f;
  var vel: vec2f;

  for(var i = 0u; i < arrayLength(&particleStatesIn); i++) {
    if(i == index) {
      continue;
    }

    pos = particleStatesIn[i].position;
    vel = particleStatesIn[i].velocity;

    if(distance(pos, vPos) < params.r1d) {
      cMass += pos;
      cMassCount++;
    }

    if(distance(pos, vPos) < params.r2d) {
      colVel -= pos - vPos;
    }

    if(distance(pos, vPos) < params.r3d) {
      cVel += vel;
      cVelCount++;
    }
  }
  
  if(cMassCount > 0) {
    cMass = (cMass / vec2(f32(cMassCount))) - vPos;
  }

  if(cVelCount > 0) {
    cVel /= f32(cVelCount);
  }

  vVel += (cMass * params.r1s) + (colVel * params.r2s) + (cVel * params.r3s);

  // clamp velocity
  vVel = normalize(vVel) * clamp(length(vVel), 0.0, 0.1);

  // kinematic update
  vPos = vPos + (vVel * params.deltaTime);

  // wrap around boundary
  if(vPos.x < -1.0) {
    vPos.x = 1.0;
  }

  if(vPos.x > 1.0) {
    vPos.x = -1.0;
  }

  if(vPos.y < -1.0) {
    vPos.y = 1.0;
  }

  if(vPos.y > 1.0) {
    vPos.y = -1.0;
  }

  var stateResult: ParticleState;

  stateResult.position = vPos;
  stateResult.velocity = vVel;

  particleStatesOut[index] = stateResult;
}
`;
