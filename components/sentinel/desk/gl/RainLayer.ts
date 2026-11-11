/**
 * RainLayer — falling rain streaks, only where precipitation actually is.
 *
 * Seeds are drawn by rejection sampling against a precipitation sampler (real radar for observed time,
 * model precipitation for forecast time) inside the current view. Each streak falls on the GPU
 * (altitude = fract(time·speed + phase)), so there is no per-frame CPU work except reseeding after the
 * camera or the field changes.
 */
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MLMap } from "maplibre-gl";
import { GL, ProgramCache, mercator, setProjectionUniforms } from "./glKit";
import type { PrecipSampler } from "../fields";

const VERT = `
in vec2 a_pos;     // mercator
in vec3 a_seed;    // phase, intensity, end (0 = tail/bottom, 1 = head/top)
uniform float u_time;
uniform float u_fall;   // metres: height of the rain column
uniform float u_len;    // metres: streak length
uniform float u_speed;
out float v_alpha;
void main() {
  float ph = fract(a_seed.x + u_time * u_speed);
  float alt = (1.0 - ph) * u_fall + a_seed.z * u_len;
  v_alpha = a_seed.y * smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.85, 1.0, ph)) * (0.35 + 0.65 * (1.0 - a_seed.z));
  gl_Position = projectTileFor3D(a_pos, alt);
}`;

const FRAG = `
in float v_alpha;
uniform float u_opacity;
out vec4 outColor;
void main() {
  float a = v_alpha * u_opacity;
  outColor = vec4(vec3(0.72, 0.86, 1.0) * a, a);
}`;

const UNIFORMS = ["u_time", "u_fall", "u_len", "u_speed", "u_opacity"];
const MAX = 16000;

export class RainLayer implements CustomLayerInterface {
  id: string;
  type = "custom" as const;
  renderingMode = "3d" as const;
  visible = true;
  opacity = 0.7;

  private map: MLMap | null = null;
  private programs = new ProgramCache();
  private vbo: WebGLBuffer | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private count = 0;
  private sampler: PrecipSampler | null = null;
  private dirty = false;
  private t0 = performance.now();
  private warned = false;

  constructor(id = "desk-rain") {
    this.id = id;
  }

  setSampler(s: PrecipSampler | null) {
    this.sampler = s;
    this.dirty = true;
    this.map?.triggerRepaint();
  }

  /** Call after the camera settles. */
  reseed() {
    this.dirty = true;
    this.map?.triggerRepaint();
  }

  onAdd(map: MLMap, gl: GL) {
    this.map = map;
    this.vbo = gl.createBuffer();
    this.vao = gl.createVertexArray();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, MAX * 2 * 5 * 4, gl.DYNAMIC_DRAW);
  }

  private seed(gl: GL) {
    const map = this.map!;
    const s = this.sampler;
    if (!s) { this.count = 0; return; }
    const b = map.getBounds();
    // when the whole globe is in view, bounds are huge; clamp to a sane window around the center
    let w = b.getWest(), e = b.getEast(), so = b.getSouth(), n = b.getNorth();
    if (e - w > 120 || e < w) { const c = map.getCenter(); w = c.lng - 45; e = c.lng + 45; so = c.lat - 28; n = c.lat + 28; }
    so = Math.max(-80, so); n = Math.min(80, n);
    const data = new Float32Array(MAX * 2 * 5);
    let k = 0, tries = 0;
    let count = 0;
    while (count < MAX && tries < MAX * 40) {
      tries++;
      const lng = w + Math.random() * (e - w);
      const lat = so + Math.random() * (n - so);
      const inten = s.sample(((lng + 540) % 360) - 180, lat);
      const q = Math.pow(inten, 1.6);
      if (q < 0.05 || Math.random() > q * 1.4) continue;
      const [mx, my] = mercator(lng, lat);
      const phase = Math.random();
      for (let end = 0; end < 2; end++) {
        data[k++] = mx; data[k++] = my; data[k++] = phase; data[k++] = Math.min(1, q); data[k++] = end;
      }
      count++;
    }
    this.count = count * 2;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, k));
  }

  render(gl: GL, args: CustomRenderMethodInput) {
    if (!this.visible || !this.map) return;
    try {
      if (this.dirty) { this.seed(gl); this.dirty = false; }
      if (this.count === 0) return;
      const p = this.programs.get(gl, args, VERT, FRAG, UNIFORMS);
      gl.useProgram(p.prog);
      setProjectionUniforms(gl, p, args);

      const zoom = this.map.getZoom();
      const lat = this.map.getCenter().lat;
      const mpp = (156543 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom; // metres per pixel
      gl.uniform1f(p.loc.u_time, (performance.now() - this.t0) / 1000);
      gl.uniform1f(p.loc.u_len, Math.min(60_000, 11 * mpp));
      gl.uniform1f(p.loc.u_fall, Math.min(220_000, 70 * mpp));
      gl.uniform1f(p.loc.u_speed, 0.55);
      gl.uniform1f(p.loc.u_opacity, this.opacity);

      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      const aPos = gl.getAttribLocation(p.prog, "a_pos");
      const aSeed = gl.getAttribLocation(p.prog, "a_seed");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(aSeed);
      gl.vertexAttribPointer(aSeed, 3, gl.FLOAT, false, 20, 8);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
      gl.drawArrays(gl.LINES, 0, this.count);
      gl.bindVertexArray(null);
      this.map.triggerRepaint(); // keep falling
    } catch (err) {
      if (!this.warned) { this.warned = true; console.warn("[desk] rain render failed:", err); }
    }
  }

  onRemove(_m: MLMap, gl: GL) {
    this.programs.dispose(gl);
    if (this.vbo) gl.deleteBuffer(this.vbo);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.map = null;
  }
}
