export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(other) {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  subtract(other) {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  scale(s) {
    return new Vector2(this.x * s, this.y * s);
  }

  length() {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
  }

  static normalize(v) {
    const l = v.length();
    return new Vector2(v.x / l, v.y / l);
  }

  static distance(v1, v2) {
    const vResult = v2.subtract(v1);
    return vResult.length;
  }
}
