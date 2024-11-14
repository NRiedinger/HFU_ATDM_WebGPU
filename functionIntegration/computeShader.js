export const computeShaderCode = `
@binding(0) @group(0) var<storage, read_write> values: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalInvocationId: vec3u) {
  let id = globalInvocationId.x;

  values[id] = f32(id);
}
`;