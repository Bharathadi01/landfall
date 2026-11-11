/**
 * CloudDeckLayer — real satellite clouds, lifted into 3D.
 *
 * The cloud mask and height come from the real GOES/Himawari infrared composite: colder cloud tops are brighter
 * (and, in this product's palette, coloured), and colder means higher. We draw three stacked shells whose
 * altitude and alpha threshold differ, which gives a volumetric look with parallax when the camera tilts.
 * Fine puffy detail is added with fractal noise — it modulates the real data, it never invents clouds where
 * the satellite sees none.
 *
 * Two frames are blended in the shader (`mix`), so a time-lapse crossfades smoothly instead of popping.
 */
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MLMap } from "maplibre-gl";
import {
  GL, GLSL_NOISE, ProgramCache, SphereMesh, createSphereMesh, createTexture, setProjectionUniforms, uploadTexture, sunVector,
} from "./glKit";
import type { CompositeFrame } from "../satelliteComposite";

const VERT = `
in vec4 a_pos;            // mercX, mercY, u, v
uniform sampler2D u_a;
uniform sampler2D u_b;
uniform float u_t;
uniform float u_layer;    // 0,1,2
uniform float u_height;   // metres at full cold
uniform vec3 u_tune;      // lum base, lum gain, saturation gain
out vec2 v_uv;
out float v_cold;
out float v_cover;

float coldness(vec4 c){
  float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  float sat = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
  return clamp((lum - u_tune.x) * u_tune.y + sat * u_tune.z, 0.0, 1.0);
}

void main() {
  vec4 ca = textureLod(u_a, a_pos.zw, 0.0);
  vec4 cb = textureLod(u_b, a_pos.zw, 0.0);
  vec4 c = mix(ca, cb, u_t);
  float k = coldness(c);
  v_cold = k;
  v_cover = c.a;
  v_uv = a_pos.zw;
  float shell = 0.30 + 0.35 * u_layer;
  float h = u_height * shell * (0.18 + 0.82 * k);
  gl_Position = projectTileFor3D(a_pos.xy, h);
}`;

const FRAG = `
in vec2 v_uv;
in float v_cold;
in float v_cover;
uniform float u_layer;
uniform float u_opacity;
uniform float u_detail;
uniform float u_time;
uniform vec3 u_sun;
uniform float u_nightMix;
out vec4 outColor;
${GLSL_NOISE}

void main() {
  if (v_cover < 0.04) discard;

  float lng = (v_uv.x * 360.0 - 180.0) * PI / 180.0;
  float lat = (90.0 - v_uv.y * 180.0) * PI / 180.0;
  vec3 n = vec3(cos(lat) * cos(lng), cos(lat) * sin(lng), sin(lat));

  // fine puffy detail, only strong when zoomed in
  vec2 q = v_uv * vec2(1100.0, 550.0);
  float d = fbm(q + vec2(u_time * 0.015, 0.0)) - 0.5;
  float dens = v_cold + d * (0.18 + 0.5 * u_detail);

  float lo = 0.30 + u_layer * 0.17;
  float a = smoothstep(lo, lo + 0.22, dens) * v_cover;
  if (a < 0.01) discard;

  float sunDot = dot(n, u_sun);
  float day = mix(1.0, smoothstep(-0.12, 0.22, sunDot), u_nightMix);
  // taller, colder tops catch more light; the underside of the stack is shaded
  float top = clamp(v_cold, 0.0, 1.0);
  vec3 lit = mix(vec3(0.60, 0.66, 0.76), vec3(1.0, 0.985, 0.96), 0.25 + 0.75 * top);
  lit *= mix(0.78, 1.0, u_layer / 2.0);
  vec3 night = vec3(0.30, 0.36, 0.52) * (0.55 + 0.6 * top);
  // warm rim near the terminator
  float rim = smoothstep(0.0, 0.18, sunDot) * (1.0 - smoothstep(0.18, 0.5, sunDot));
  vec3 col = mix(night, lit, day) + vec3(0.30, 0.13, 0.03) * rim * 0.5;

  float alpha = a * u_opacity * (0.55 + 0.15 * u_layer);
  outColor = vec4(col * alpha, alpha);
}`;

const UNIFORMS = ["u_a", "u_b", "u_t", "u_layer", "u_height", "u_opacity", "u_detail", "u_time", "u_sun", "u_tune", "u_nightMix"];

export class CloudDeckLayer implements CustomLayerInterface {
  id: string;
  type = "custom" as const;
  renderingMode = "3d" as const;

  private map: MLMap | null = null;
  private programs = new ProgramCache();
  private mesh: SphereMesh | null = null;
  private tex: [WebGLTexture | null, WebGLTexture | null] = [null, null];
  private pending: [CompositeFrame | null, CompositeFrame | null] = [null, null];
  private vao: WebGLVertexArrayObject | null = null;

  /** 0 = frame A, 1 = frame B. */
  mix = 0;
  opacity = 1;
  /** Peak cloud-top height in metres at full coldness (exaggerated for readability). */
  height = 90_000;
  visible = true;
  /** 0 = always daylight (default, keeps clouds legible), 1 = real sun terminator. */
  nightMix = 0;
  tune = { base: 0.34, gain: 2.4, sat: 1.35 };
  private t0 = performance.now();

  constructor(id = "desk-cloud-deck") {
    this.id = id;
  }

  setFrame(slot: 0 | 1, frame: CompositeFrame | null) {
    this.pending[slot] = frame;
    this.map?.triggerRepaint();
  }

  onAdd(map: MLMap, gl: GL) {
    this.map = map;
    this.mesh = createSphereMesh(gl);
    this.tex = [createTexture(gl), createTexture(gl)];
    this.vao = gl.createVertexArray();
  }

  private warned = false;
  render(gl: GL, args: CustomRenderMethodInput) {
    if (!this.visible || !this.mesh || !this.map) return;
    try {
      this.draw(gl, args);
    } catch (err) {
      if (!this.warned) {
        this.warned = true;
        console.warn("[desk] cloud deck render failed:", err);
      }
    }
  }

  private draw(gl: GL, args: CustomRenderMethodInput) {
    if (!this.mesh || !this.map) return;

    for (const s of [0, 1] as const) {
      const f = this.pending[s];
      if (f && this.tex[s]) {
        gl.bindTexture(gl.TEXTURE_2D, this.tex[s]);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, f.w, f.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, f.data);
        this.pending[s] = null;
      }
    }

    const p = this.programs.get(gl, args, VERT, FRAG, UNIFORMS);
    gl.useProgram(p.prog);
    setProjectionUniforms(gl, p, args);

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.mesh.ibo);
    const loc = gl.getAttribLocation(p.prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 16, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[0]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[1]);
    gl.uniform1i(p.loc.u_a, 0);
    gl.uniform1i(p.loc.u_b, 1);
    gl.uniform1f(p.loc.u_t, this.mix);
    gl.uniform1f(p.loc.u_height, this.height);
    gl.uniform3f(p.loc.u_tune, this.tune.base, this.tune.gain, this.tune.sat);
    gl.uniform1f(p.loc.u_nightMix, this.nightMix);

    const zoom = this.map.getZoom();
    // fade the deck out as the camera gets close so radar and ground detail show through
    const zoomFade = 1 - Math.min(1, Math.max(0, (zoom - 5.2) / 2.2));
    gl.uniform1f(p.loc.u_opacity, this.opacity * zoomFade);
    gl.uniform1f(p.loc.u_detail, Math.min(1, Math.max(0, (zoom - 2) / 4)));
    gl.uniform1f(p.loc.u_time, (performance.now() - this.t0) / 1000);
    const sun = sunVector(new Date());
    gl.uniform3f(p.loc.u_sun, sun[0], sun[1], sun[2]);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);

    for (let layer = 0; layer < 3; layer++) {
      gl.uniform1f(p.loc.u_layer, layer);
      gl.drawElements(gl.TRIANGLES, this.mesh.indexCount, gl.UNSIGNED_INT, 0);
    }

    gl.depthMask(true);
    gl.bindVertexArray(null);
  }

  onRemove(_map: MLMap, gl: GL) {
    this.programs.dispose(gl);
    if (this.mesh) {
      gl.deleteBuffer(this.mesh.vbo);
      gl.deleteBuffer(this.mesh.ibo);
    }
    this.tex.forEach((t) => t && gl.deleteTexture(t));
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.map = null;
  }
}
