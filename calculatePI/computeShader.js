export const computeShaderCode = `
struct UniformParameter {
  iterations: i32,
  seed: i32,
}

@group(0) @binding(0) var<storage, read_write> values: array<u32>;
@group(0) @binding(1) var<uniform> params: UniformParameter;

fn random(seed: vec3<i32>) -> vec2<f32> {
  // Konstanten für das Hashing
  let k1: f32 = 12.9898;
  let k2: f32 = 78.233;
  let k3: f32 = 45.164;
  let large_prime: f32 = 43758.5453;

  // Hash für den ersten Zufallswert
  let hash1 = sin(f32(seed.x) * k1 + f32(seed.y) * k2 + f32(seed.z) * k3) * large_prime;
  let random1 = fract(hash1);

  // Hash für den zweiten Zufallswert (leicht veränderte Kombination der Konstanten)
  let hash2 = sin(f32(seed.x + seed.z) * k2 + f32(seed.y * 2) * k3 + f32(seed.z - seed.x) * k1) * large_prime;
  let random2 = fract(hash2);

  return vec2<f32>(random1, random2);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalInvocationId: vec3u) {
  let id = i32(globalInvocationId.x);

  for(var i = 0; i < params.iterations; i++) {
    let coords = random(vec3<i32>(id, i, params.seed));
    values[id] += 1 - u32(coords.x * coords.x + coords.y * coords.y);
  }

  //values[id] = u32(params.seed);
}
`;
