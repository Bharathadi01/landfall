/**
 * WindFlowLayer — thousands of particles advected through the model wind field, drawn as short comet streaks
 * (tail → head) and coloured by wind speed in knots.
 */
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MLMap } from "maplibre-gl";
import { GL, ProgramCache, mercator, setProjectionUniforms } from "./glKit";
import type { WindField } from "../fields";

const VERT = `
in vec2 a_pos;     // mercator
in vec2 a_attr;    // speed (kt), alpha
uniform float u_alt;
out float v_speed;
out float v_alpha;
void main() {
  v_speed = a_attr.x;
  v_alpha = a_attr.y;
  gl_Position = projectTileFor3D(a_pos, u_alt);
}`;

const FRAG = `
in float v_speed;
in float v_alpha;
uniform float u_opacity;
out vec4 outColor;
vec3 ramp(float s) {
  vec3 c0 = vec3(0.45, 0.80, 1.00);   // light air
  vec3 c1 = vec3(0.92, 0.98, 1.00);   // 15 kt
  vec3 c2 = vec3(1.00, 0.90, 0.45);   // 28 kt
  vec3 c3 = vec3(1.00, 0.52, 0.22);   // 40 kt
  vec3 c4 = vec3(1.00, 0.28, 0.62);   // 55 kt+
  if (s < 15.0) return mix(c0, c1, s / 15.0);
  if (s < 28.0) return mix(c1, c2, (s - 15.0) / 13.0);
  if (s < 40.0) return mix(c2, c3, (s - 28.0) / 12.0);
  return mix(c3, c4, clamp((s - 40.0) / 15.0, 0.0, 1.0));
}
void main() {
  float a = v_alpha * u_opacity;
  outColor = vec4(ramp(v_speed) * a, a);
}`;

const UNIFORMS = ["u_alt", "u_opacity"];
const N = 7000;
const KT_TO_MS = 0.5144;

export class WindLayer implements CustomLayerInterface {
  id: string;
  type = "custom" as const;
  renderingMode = "3d" as const;
  visible = true;
  opacity = 0.9;

  private map: MLMap | null = null;
  private programs = new ProgramCache();
  private vbo: WebGLBuffer | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private field: WindField | null = null;
  private lng = new Float32Array(N);
  private lat = new Float32Array(N);
  private age = new Float32Array(N);
  private life = new Float32Array(N);
  private buf = new Float32Array(N * 2 * 4);
  private last = performance.now();
  private warned = false;

  constructor(id = "desk-wind") {
    this.id = id;
    for (let i = 0; i < N; i++) this.life[i] = 0; // respawn on first frame
  }

  setField(f: WindField | null) {
    this.field = f;
    this.map?.triggerRepaint();
  }

  onAdd(map: MLMap, gl: GL) {
    this.map = map;
    this.vbo = gl.createBuffer();
    this.vao = gl.createVertexArray();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.buf.byteLength, gl.DYNAMIC_DRAW);
  }

  private spawn(i: number) {
    const f = this.field!;
    const [w, s, e, n] = f.u.bbox;
    this.lng[i] = w + Math.random() * (e - w);
    this.lat[i] = s + Math.random() * (n - s);
    this.age[i] = 0;
    this.life[i] = 1.6 + Math.random() * 3.2;
  }

  render(gl: GL, args: CustomRenderMethodInput) {
    if (!this.visible || !this.map || !this.field) return;
    try {
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      const f = this.field;
      // keep apparent motion ~8 px/s for a 10 kt wind at any zoom: hours-per-second ∝ metres-per-pixel
      const hps = Math.max(0.2, Math.min(14, 60 / 2 ** this.map.getZoom()));
      const hoursDt = dt * hps;
      const trail = 1.0; // seconds of motion drawn behind the head
      // invisible at planet scale, full strength from regional zoom
      const zoomVis = Math.max(0, Math.min(1, (this.map.getZoom() - 2.6) / 1.4));
      const [bw, bs, be, bn] = f.u.bbox;
      const sm = (x: number) => { const t = Math.max(0, Math.min(1, x / 3)); return t * t * (3 - 2 * t); };

      let k = 0;
      for (let i = 0; i < N; i++) {
        if (this.age[i] >= this.life[i]) this.spawn(i);
        const u = f.u.at(this.lng[i], this.lat[i]);
        const v = f.v.at(this.lng[i], this.lat[i]);
        if (u === null || v === null) { this.age[i] = this.life[i]; continue; }
        const cos = Math.max(0.2, Math.cos((this.lat[i] * Math.PI) / 180));
        const kmPerHour = 3.6 * KT_TO_MS;
        const dLng = ((u * kmPerHour * hoursDt) / (111.32 * cos));
        const dLat = ((v * kmPerHour * hoursDt) / 110.57);
        this.lng[i] += dLng;
        this.lat[i] += dLat;
        this.age[i] += dt;
        const sp = Math.hypot(u, v);
        const edge = Math.min(sm(this.lng[i] - bw), sm(be - this.lng[i]), sm(this.lat[i] - bs), sm(bn - this.lat[i]));
        const fade = Math.min(1, this.age[i] / 0.4) * Math.min(1, (this.life[i] - this.age[i]) / 0.5) * edge * zoomVis;
        const tl = trail / Math.max(dt, 0.001);
        const [hx, hy] = mercator(this.lng[i], this.lat[i]);
        const [tx, ty] = mercator(this.lng[i] - dLng * tl, this.lat[i] - dLat * tl);
        this.buf[k++] = tx; this.buf[k++] = ty; this.buf[k++] = sp; this.buf[k++] = 0;
        this.buf[k++] = hx; this.buf[k++] = hy; this.buf[k++] = sp; this.buf[k++] = fade * 0.95;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.buf.subarray(0, k));

      const p = this.programs.get(gl, args, VERT, FRAG, UNIFORMS);
      gl.useProgram(p.prog);
      setProjectionUniforms(gl, p, args);
      gl.uniform1f(p.loc.u_alt, 7000);
      gl.uniform1f(p.loc.u_opacity, this.opacity);

      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      const aPos = gl.getAttribLocation(p.prog, "a_pos");
      const aAttr = gl.getAttribLocation(p.prog, "a_attr");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(aAttr);
      gl.vertexAttribPointer(aAttr, 2, gl.FLOAT, false, 16, 8);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.disable(gl.DEPTH_TEST);
      gl.drawArrays(gl.LINES, 0, k / 4);
      gl.bindVertexArray(null);
      this.map.triggerRepaint();
    } catch (err) {
      if (!this.warned) { this.warned = true; console.warn("[desk] wind render failed:", err); }
    }
  }

  onRemove(_m: MLMap, gl: GL) {
    this.programs.dispose(gl);
    if (this.vbo) gl.deleteBuffer(this.vbo);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.map = null;
  }
}
