import { DROP_DEPTH_LEVELS, HIGHLIGHT_AREA_LEVELS, MAX_DROP_DEPTH } from './dropTextures'

export const VERT_SRC = /* glsl */ `
precision mediump float;
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

export const FRAG_SRC = /* glsl */ `
precision mediump float;

uniform sampler2D u_waterMap;
uniform sampler2D u_shineTexture;
uniform sampler2D u_refractionTexture;

uniform vec2  u_resolution;
uniform vec2  u_origin;
uniform bool  u_renderShine;
uniform bool  u_renderShadow;
uniform float u_minRefraction;
uniform float u_refractionDelta;
uniform float u_brightness;
uniform float u_alphaMultiply;
uniform float u_alphaSubtract;
uniform float u_bodyOpacity;
uniform float u_highlightOpacity;
uniform float u_highlightAreaMin;
uniform float u_highlightAreaMax;
uniform float u_shadowOpacity;
uniform float u_shadowOffset;
uniform float u_refractionTextureRatio;
uniform vec3  u_bodyColor;
uniform vec3  u_highlightColor;
uniform vec3  u_lightDirection;

vec4 blend(vec4 bg, vec4 fg) {
  vec3 bgC = bg.rgb * bg.a;
  vec3 fgC = fg.rgb * fg.a;
  float ia  = 1.0 - fg.a;
  float a   = fg.a + bg.a * ia;
  if (a == 0.0) return vec4(0.0);
  return vec4((fgC + bgC * ia) / a, a);
}

vec2 pixelSize()  { return vec2(1.0) / u_resolution; }
vec2 canvasUv() {
  vec2 local = gl_FragCoord.xy - u_origin;
  return vec2(local.x, u_resolution.y - local.y) / u_resolution;
}

vec2 coverUv(vec2 uv) {
  float cr = u_resolution.x / u_resolution.y;
  if (cr > u_refractionTextureRatio)
    uv.y = 0.5 + (uv.y - 0.5) * (u_refractionTextureRatio / cr);
  else
    uv.x = 0.5 + (uv.x - 0.5) * (cr / u_refractionTextureRatio);
  return uv;
}

vec4 waterSample(vec2 offset) {
  return texture2D(u_waterMap, canvasUv() + pixelSize() * offset);
}

void main() {
  vec4 water = waterSample(vec2(0.0));

  float packedVal   = floor(water.b * 255.0 + 0.5);
  float thickness  = (floor(packedVal / ${HIGHLIGHT_AREA_LEVELS}.0) / ${DROP_DEPTH_LEVELS - 1}.0) * ${MAX_DROP_DEPTH};
  float hlLevel    = mod(packedVal, ${HIGHLIGHT_AREA_LEVELS}.0) / ${HIGHLIGHT_AREA_LEVELS - 1}.0;
  float hlScale    = mix(u_highlightAreaMin, u_highlightAreaMax, hlLevel);
  float alpha      = clamp(water.a * u_alphaMultiply - u_alphaSubtract, 0.0, 1.0);

  vec2  n2d        = (vec2(water.g, water.r) - 0.5) * 2.0;
  float nZ         = sqrt(max(0.0, 1.0 - dot(n2d, n2d)));
  vec3  normal     = vec3(n2d, nZ);

  vec2  refUv      = canvasUv() + pixelSize() * n2d * (u_minRefraction + thickness * u_refractionDelta);
  vec3  refColor   = texture2D(u_refractionTexture, coverUv(refUv)).rgb;

  float hlShift    = ((1.0 - hlScale) / 0.20) * 0.0225;
  float hlMask     = 1.0 - smoothstep(-0.322 - hlShift, -0.082 - hlShift, n2d.y);

  vec3  bodyColor  = mix(refColor, u_bodyColor, 0.65);
  vec3  bright     = mix(u_highlightColor, vec3(1.0), 0.82) * 1.5;
  vec3  dropColor  = mix(bodyColor, bright, hlMask);
  dropColor       *= 1.0 + thickness * 0.35;

  float fresnel    = pow(1.0 - normal.z, 3.0);
  vec3  edgeColor  = mix(u_highlightColor, vec3(1.0), 0.35);
  dropColor        = mix(dropColor, edgeColor, fresnel * 0.45);

  vec3  lightDir   = normalize(u_lightDirection);
  vec3  halfDir    = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float specular   = pow(max(0.0, dot(normal, halfDir)), 65.0) * thickness;
  dropColor       += mix(u_highlightColor, vec3(1.0), 0.7) * specular * 0.45;

  vec4 shaded = vec4(dropColor, 1.0);
  if (u_renderShine) {
    float maxS = 490.0, minS = maxS * 0.18;
    vec2 shineUv = vec2(0.5) + (n2d / 512.0) * -(minS + (maxS - minS) * thickness);
    shaded = blend(shaded, texture2D(u_shineTexture, shineUv));
  }

  float baseAlpha = mix(u_bodyOpacity, u_highlightOpacity, hlMask);
  vec4  out_color  = vec4(shaded.rgb * u_brightness, alpha * baseAlpha);

  if (u_renderShadow) {
    float shadowA = waterSample(vec2(0.0, -thickness * u_shadowOffset)).a;
    shadowA = clamp(shadowA * u_alphaMultiply - (u_alphaSubtract + 0.5), 0.0, 1.0) * u_shadowOpacity;
    out_color = blend(vec4(0.0, 0.0, 0.0, shadowA), out_color);
  }

  gl_FragColor = out_color;
}
`
