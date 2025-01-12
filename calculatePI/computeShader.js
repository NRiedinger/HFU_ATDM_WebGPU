export const computeShaderCode = `
struct UniformParameter {
  iterations: i32,
  seed: i32,
}

@group(0) @binding(0) var<uniform> params: UniformParameter;
@group(0) @binding(1) var<storage, read_write> sumValue: array<atomic<u32>>;

// https://en.wikipedia.org/wiki/Linear_congruential_generator
fn lcg(seed: ptr<function, u32>) -> f32 {
  let a: u32 = 1664525;
  let c: u32 = 1013904223;

  *seed = a * (*seed) + c;

  return f32(*seed) / f32(0xFFFFFFFFu); 
}

fn generate_random_pair(seed1: i32, seed2: i32, seed3: i32) -> vec2<f32> {
  var combined_seed: u32 = u32((seed1 * 31 + seed2 * 37 + seed3 * 41) & 0x7FFFFFFF);

  let random1: f32 = lcg(&combined_seed);
  let random2: f32 = lcg(&combined_seed);

  return vec2<f32>(random1, random2);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalInvocationId: vec3u) {
  let id = i32(globalInvocationId.x);

  var count: u32 = 0;
  for(var i = 0; i < params.iterations; i++) {
    let coords = generate_random_pair(id, i, params.seed);
    count += 1 - u32(coords.x * coords.x + coords.y * coords.y);
  }

  atomicAdd(&sumValue[0], count);
}
`;
