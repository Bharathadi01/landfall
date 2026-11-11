/**
 * Small WebGL2 toolkit shared by the storm-desk custom layers (cloud deck, rain, wind, night).
 *
 * All layers render through MapLibre's own projection prelude, so they work on the globe AND on the flat map:
 * vertices are given as Web-Mercator coordinates (0..1) plus an altitude in metres, and the prelude's
 * `projectTileFor3D(pos, altitude)` places them on the sphere (or the plane) correctly, including horizon clipping.
 */
import type { CustomRenderMethodInput } from "maplibre-gl";

export type GL = WebGL2RenderingContext;

export const DEG = Math.PI / 180;

/** lng/lat (degrees) → Web-Mercator 0..1 (y grows southward). Latitude is clamped to the mercator limit. */
export function mercator(lng: number, lat: number): [number, number] {
  const la = Math.max(-85.05, Math.min(85.05, lat));
  const x = (lng + 180) / 360;
  const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + (la * DEG) / 2)) / (2 * Math.PI);
  return [x, y];
}

/** Unit vector for a lng/lat on the sphere (x toward 0°E on the equator, y toward 90°E, z north). */
export function unitVector(lngDeg: number, latDeg: number): [number, number, number] {
  const lng = lngDeg * DEG;
  const lat = latDeg * DEG;
  return [Math.cos(lat) * Math.cos(lng), Math.cos(lat) * Math.sin(lng), Math.sin(lat)];
}

/** Sub-solar point for a UTC date (good to ~1°, plenty for a terminator). */
export function subSolarPoint(date: Date): { lat: number; lng: number } {
  const dayMs = 86_400_000;
  const n = date.getTime() / dayMs + 2440587.5 - 2451545.0; // days since J2000
  const L = (280.46 + 0.9856474 * n) % 360; // mean longitude
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG; // mean anomaly
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG; // ecliptic longitude
  const eps = (23.439 - 0.0000004 * n) * DEG;
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = ((18.697374558 + 24.06570982441908 * n) % 24) * 15 * DEG; // Greenwich mean sidereal time
  let lng = (ra - gmst) / DEG;
  lng = ((((lng + 180) % 360) + 360) % 360) - 180;
  return { lat: decl / DEG, lng };
}

export function sunVector(date: Date): [number, number, number] {
  const s = subSolarPoint(date);
  return unitVector(s.lng, s.lat);
}

const HEADER = `#version 300 es
precision highp float;
precision highp int;
`;
// MapLibre's vertex prelude already declares PI; fragment shaders get it from here.
const FRAGMENT_HEADER = `${HEADER}#define PI 3.141592653589793
`;

function compile(gl: GL, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`[desk] shader compile failed: ${log}\n${src.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n")}`);
  }
  return sh;
}

export interface Program {
  prog: WebGLProgram;
  loc: Record<string, WebGLUniformLocation | null>;
}

/** Link a program whose vertex shader uses MapLibre's projection prelude. */
export function buildProgram(gl: GL, args: CustomRenderMethodInput, vertexBody: string, fragmentBody: string, uniforms: string[]): Program {
  const vs = compile(gl, gl.VERTEX_SHADER, `${HEADER}${args.shaderData.vertexShaderPrelude}\n${args.shaderData.define}\n${vertexBody}`);
  const fs = compile(gl, gl.FRAGMENT_SHADER, `${FRAGMENT_HEADER}${fragmentBody}`);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`[desk] program link failed: ${gl.getProgramInfoLog(prog)}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  const names = [
    "u_projection_matrix",
    "u_projection_fallback_matrix",
    "u_projection_tile_mercator_coords",
    "u_projection_clipping_plane",
    "u_projection_transition",
    ...uniforms,
  ];
  const loc: Program["loc"] = {};
  for (const n of names) loc[n] = gl.getUniformLocation(prog, n);
  return { prog, loc };
}

/** Feed MapLibre's projection uniforms to a program built with buildProgram. */
export function setProjectionUniforms(gl: GL, p: Program, args: CustomRenderMethodInput) {
  const d = args.defaultProjectionData;
  gl.uniformMatrix4fv(p.loc.u_projection_matrix, false, d.mainMatrix as unknown as Float32List);
  gl.uniformMatrix4fv(p.loc.u_projection_fallback_matrix, false, d.fallbackMatrix as unknown as Float32List);
  gl.uniform4f(p.loc.u_projection_tile_mercator_coords, d.tileMercatorCoords[0], d.tileMercatorCoords[1], d.tileMercatorCoords[2], d.tileMercatorCoords[3]);
  gl.uniform4f(p.loc.u_projection_clipping_plane, d.clippingPlane[0], d.clippingPlane[1], d.clippingPlane[2], d.clippingPlane[3]);
  gl.uniform1f(p.loc.u_projection_transition, d.projectionTransition);
}

/** Cache of programs per projection variant (globe vs mercator need different shader preludes). */
export class ProgramCache {
  private map = new Map<string, Program>();
  get(gl: GL, args: CustomRenderMethodInput, vertexBody: string, fragmentBody: string, uniforms: string[]): Program {
    const key = args.shaderData.variantName;
    let p = this.map.get(key);
    if (!p) {
      p = buildProgram(gl, args, vertexBody, fragmentBody, uniforms);
      this.map.set(key, p);
    }
    return p;
  }
  dispose(gl: GL) {
    this.map.forEach((p) => gl.deleteProgram(p.prog));
    this.map.clear();
  }
}

export function createTexture(gl: GL, filter: number = gl.LINEAR): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // 1×1 transparent placeholder so sampling before upload is harmless
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  return t;
}

export function uploadTexture(gl: GL, tex: WebGLTexture, src: TexImageSource) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
}

export interface SphereMesh {
  vbo: WebGLBuffer;
  ibo: WebGLBuffer;
  indexCount: number;
}

/**
 * Lat/lng grid covering the globe. Interleaved [mercX, mercY, u, v] where (u, v) index an equirectangular texture
 * (u: 0 at 180°W → 1 at 180°E, v: 0 at 90°N → 1 at 90°S).
 */
export function createSphereMesh(gl: GL, cols = 360, rows = 170, latLimit = 82): SphereMesh {
  const verts = new Float32Array((cols + 1) * (rows + 1) * 4);
  let k = 0;
  for (let j = 0; j <= rows; j++) {
    const lat = latLimit - (j / rows) * latLimit * 2;
    for (let i = 0; i <= cols; i++) {
      const lng = -180 + (i / cols) * 360;
      const [mx, my] = mercator(lng, lat);
      verts[k++] = mx;
      verts[k++] = my;
      verts[k++] = i / cols;
      verts[k++] = (90 - lat) / 180;
    }
  }
  const idx = new Uint32Array(cols * rows * 6);
  let n = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const c = a + (cols + 1);
      const d = c + 1;
      idx[n++] = a; idx[n++] = c; idx[n++] = b;
      idx[n++] = b; idx[n++] = c; idx[n++] = d;
    }
  }
  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
  const ibo = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  return { vbo, ibo, indexCount: idx.length };
}

/** GLSL snippets reused by several fragment shaders. */
export const GLSL_NOISE = `
float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  float a=hash21(i), b=hash21(i+vec2(1,0)), c=hash21(i+vec2(0,1)), d=hash21(i+vec2(1,1));
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fbm(vec2 p){
  float s=0.0, a=0.5;
  for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.7); a*=0.5; }
  return s;
}
`;
