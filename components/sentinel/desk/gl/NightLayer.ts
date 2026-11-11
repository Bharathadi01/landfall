/**
 * NightLayer — darkens the side of the planet that is facing away from the sun.
 * Uses the real sub-solar point for the current UTC time; the terminator is soft (twilight).
 */
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MLMap } from "maplibre-gl";
import { GL, ProgramCache, SphereMesh, createSphereMesh, setProjectionUniforms, sunVector } from "./glKit";

const VERT = `
in vec4 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos.zw;
  gl_Position = projectTileFor3D(a_pos.xy, 400.0);
}`;

const FRAG = `
in vec2 v_uv;
uniform vec3 u_sun;
uniform float u_opacity;
out vec4 outColor;
void main() {
  float lng = (v_uv.x * 360.0 - 180.0) * PI / 180.0;
  float lat = (90.0 - v_uv.y * 180.0) * PI / 180.0;
  vec3 n = vec3(cos(lat) * cos(lng), cos(lat) * sin(lng), sin(lat));
  float d = dot(n, u_sun);
  float night = 1.0 - smoothstep(-0.14, 0.12, d);
  // faint warm band along the terminator
  float twilight = smoothstep(-0.16, -0.02, d) * (1.0 - smoothstep(-0.02, 0.1, d));
  vec3 col = vec3(0.01, 0.015, 0.045) * night + vec3(0.22, 0.09, 0.02) * twilight * 0.35;
  float a = (night * 0.78 + twilight * 0.12) * u_opacity;
  outColor = vec4(col, a);
}`;

export class NightLayer implements CustomLayerInterface {
  id: string;
  type = "custom" as const;
  renderingMode = "3d" as const;
  visible = false;
  opacity = 1;

  private map: MLMap | null = null;
  private programs = new ProgramCache();
  private mesh: SphereMesh | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private warned = false;

  constructor(id = "desk-night") {
    this.id = id;
  }

  onAdd(map: MLMap, gl: GL) {
    this.map = map;
    this.mesh = createSphereMesh(gl, 240, 120);
    this.vao = gl.createVertexArray();
  }

  render(gl: GL, args: CustomRenderMethodInput) {
    if (!this.visible || !this.mesh || !this.map) return;
    try {
      const p = this.programs.get(gl, args, VERT, FRAG, ["u_sun", "u_opacity"]);
      gl.useProgram(p.prog);
      setProjectionUniforms(gl, p, args);
      const sun = sunVector(new Date());
      gl.uniform3f(p.loc.u_sun, sun[0], sun[1], sun[2]);
      // fade out as the camera closes in so street-level imagery isn't dimmed
      const z = this.map.getZoom();
      gl.uniform1f(p.loc.u_opacity, this.opacity * (1 - Math.min(1, Math.max(0, (z - 4.5) / 3))));
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh.vbo);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.mesh.ibo);
      const loc = gl.getAttribLocation(p.prog, "a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 16, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(false);
      gl.drawElements(gl.TRIANGLES, this.mesh.indexCount, gl.UNSIGNED_INT, 0);
      gl.depthMask(true);
      gl.bindVertexArray(null);
    } catch (err) {
      if (!this.warned) { this.warned = true; console.warn("[desk] night render failed:", err); }
    }
  }

  onRemove(_m: MLMap, gl: GL) {
    this.programs.dispose(gl);
    if (this.mesh) { gl.deleteBuffer(this.mesh.vbo); gl.deleteBuffer(this.mesh.ibo); }
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.map = null;
  }
}
