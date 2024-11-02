export const particleShaderCode = `
struct VertexInput {
  @location(0) pos: vec2f,
  @builtin(instance_index) instance: u32,
};

struct VertexOutput {
  @builtin(position) pos: vec4f,
};

struct ParticleState {
  position: vec2f,
  velocity: vec2f
};

@group(0) @binding(0) var<storage> particleStates: array<ParticleState>;


@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  let state = particleStates[input.instance];

  let angle = -atan2(state.velocity.x, state.velocity.y);
  
  let pos = vec2f(
    (input.pos.x * cos(angle)) - (input.pos.y * sin(angle)),
    (input.pos.x * sin(angle)) + (input.pos.y * cos(angle))
  );

  var output: VertexOutput;
  output.pos = vec4f((pos + state.position), 0, 1);
  return output;
}


@fragment
fn fragmentMain() -> @location(0) vec4f {
  return vec4f(1, 1, 1, 1);
}
`;
