export const particleShaderCode = `
struct VertexAttributes {
  @location(0) pos: vec2f,
  @location(1) particlePos: vec2f,
  @location(2) particleVel: vec2f,
};

struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(3) color: vec4f,
};

@vertex
fn vertexMain(attr: VertexAttributes) -> VertexOutput {

  let angle = -atan2(attr.particleVel.x, attr.particleVel.y);
  
  let pos = vec2f(
    (attr.pos.x * cos(angle)) - (attr.pos.y * sin(angle)),
    (attr.pos.x * sin(angle)) + (attr.pos.y * cos(angle))
  );

  var output: VertexOutput;
  output.pos = vec4f((pos + attr.particlePos), 0, 1);
  output.color = vec4f(
    1.0 - sin(angle + 1.0) - attr.particleVel.y,
    pos.x * 100.0 - attr.particleVel.y + 0.1,
    attr.particleVel.x + cos(angle + 0.5),
    1.0
  );
  return output;
}


@fragment
fn fragmentMain(@location(3) color: vec4f) -> @location(0) vec4f {
  return color;
}
`;
