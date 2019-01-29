"use strict";

module.exports = "__HEADER__;\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\n\nconst float LOOP_MAX = __LOOP_MAX__;\n\n__CONSTANTS__;\n\nvarying vec2 vTexCoord;\n\nvec4 round(vec4 x) {\n  return floor(x + 0.5);\n}\n\nfloat round(float x) {\n  return floor(x + 0.5);\n}\n\nvec2 integerMod(vec2 x, float y) {\n  vec2 res = floor(mod(x, y));\n  return res * step(1.0 - floor(y), -res);\n}\n\nvec3 integerMod(vec3 x, float y) {\n  vec3 res = floor(mod(x, y));\n  return res * step(1.0 - floor(y), -res);\n}\n\nvec4 integerMod(vec4 x, vec4 y) {\n  vec4 res = floor(mod(x, y));\n  return res * step(1.0 - floor(y), -res);\n}\n\nfloat integerMod(float x, float y) {\n  float res = floor(mod(x, y));\n  return res * (res > floor(y) - 1.0 ? 0.0 : 1.0);\n}\n\nint integerMod(int x, int y) {\n  return x - (y * int(x / y));\n}\n\n__DIVIDE_WITH_INTEGER_CHECK__;\n\n// Here be dragons!\n// DO NOT OPTIMIZE THIS CODE\n// YOU WILL BREAK SOMETHING ON SOMEBODY'S MACHINE\n// LEAVE IT AS IT IS, LEST YOU WASTE YOUR OWN TIME\nconst vec2 MAGIC_VEC = vec2(1.0, -256.0);\nconst vec4 SCALE_FACTOR = vec4(1.0, 256.0, 65536.0, 0.0);\nconst vec4 SCALE_FACTOR_INV = vec4(1.0, 0.00390625, 0.0000152587890625, 0.0); // 1, 1/256, 1/65536\nfloat decode32(vec4 rgba) {\n  __DECODE32_ENDIANNESS__;\n  rgba *= 255.0;\n  vec2 gte128;\n  gte128.x = rgba.b >= 128.0 ? 1.0 : 0.0;\n  gte128.y = rgba.a >= 128.0 ? 1.0 : 0.0;\n  float exponent = 2.0 * rgba.a - 127.0 + dot(gte128, MAGIC_VEC);\n  float res = exp2(round(exponent));\n  rgba.b = rgba.b - 128.0 * gte128.x;\n  res = dot(rgba, SCALE_FACTOR) * exp2(round(exponent-23.0)) + res;\n  res *= gte128.y * -2.0 + 1.0;\n  return res;\n}\n\nvec4 encode32(float f) {\n  float F = abs(f);\n  float sign = f < 0.0 ? 1.0 : 0.0;\n  float exponent = floor(log2(F));\n  float mantissa = (exp2(-exponent) * F);\n  // exponent += floor(log2(mantissa));\n  vec4 rgba = vec4(F * exp2(23.0-exponent)) * SCALE_FACTOR_INV;\n  rgba.rg = integerMod(rgba.rg, 256.0);\n  rgba.b = integerMod(rgba.b, 128.0);\n  rgba.a = exponent*0.5 + 63.5;\n  rgba.ba += vec2(integerMod(exponent+127.0, 2.0), sign) * 128.0;\n  rgba = floor(rgba);\n  rgba *= 0.003921569; // 1/255\n  __ENCODE32_ENDIANNESS__;\n  return rgba;\n}\n// Dragons end here\n\nfloat decode(vec4 rgba, int x, int bitRatio) {\n  if (bitRatio == 1) {\n    return decode32(rgba);\n  }\n  __DECODE32_ENDIANNESS__;\n  int channel = integerMod(x, bitRatio);\n  if (bitRatio == 4) {\n    if (channel == 0) return rgba.r * 255.0;\n    if (channel == 1) return rgba.g * 255.0;\n    if (channel == 2) return rgba.b * 255.0;\n    if (channel == 3) return rgba.a * 255.0;\n  }\n  else {\n    if (channel == 0) return rgba.r * 255.0 + rgba.g * 65280.0;\n    if (channel == 1) return rgba.b * 255.0 + rgba.a * 65280.0;\n  }\n}\n\nint index;\nivec3 threadId;\n\nivec3 indexTo3D(int idx, ivec3 texDim) {\n  int z = int(idx / (texDim.x * texDim.y));\n  idx -= z * int(texDim.x * texDim.y);\n  int y = int(idx / texDim.x);\n  int x = int(integerMod(idx, texDim.x));\n  return ivec3(x, y, z);\n}\n\nfloat get(sampler2D tex, ivec2 texSize, ivec3 texDim, int bitRatio,  int z, int y, int x) {\n  ivec3 xyz = ivec3(x, y, z);\n  __GET_WRAPAROUND__;\n  int index = xyz.x + texDim.x * (xyz.y + texDim.y * xyz.z);\n  __GET_TEXTURE_CHANNEL__;\n  int w = texSize.x;\n  vec2 st = vec2(float(integerMod(index, w)), float(index / w)) + 0.5;\n  __GET_TEXTURE_INDEX__;\n  vec4 texel = texture2D(tex, st / vec2(texSize));\n  __GET_RESULT__;\n  \n}\n\nvec4 getImage2D(sampler2D tex, ivec2 texSize, ivec3 texDim, int z, int y, int x) {\n  ivec3 xyz = ivec3(x, y, z);\n  __GET_WRAPAROUND__;\n  int index = xyz.x + texDim.x * (xyz.y + texDim.y * xyz.z);\n  __GET_TEXTURE_CHANNEL__;\n  int w = texSize.x;\n  vec2 st = vec2(float(integerMod(index, w)), float(index / w)) + 0.5;\n  __GET_TEXTURE_INDEX__;\n  return texture2D(tex, st / vec2(texSize));\n}\n\nfloat get(sampler2D tex, ivec2 texSize, ivec3 texDim, int bitRatio, int y, int x) {\n  return get(tex, texSize, texDim, bitRatio, int(0), y, x);\n}\n\nvec4 getImage2D(sampler2D tex, ivec2 texSize, ivec3 texDim, int y, int x) {\n  return getImage2D(tex, texSize, texDim, int(0), y, x);\n}\n\nfloat get(sampler2D tex, ivec2 texSize, ivec3 texDim, int bitRatio, int x) {\n  return get(tex, texSize, texDim, bitRatio, int(0), int(0), x);\n}\n\nvec4 getImage2D(sampler2D tex, ivec2 texSize, ivec3 texDim, int x) {\n  return getImage2D(tex, texSize, texDim, int(0), int(0), x);\n}\n\n\nvec4 actualColor;\nvoid color(float r, float g, float b, float a) {\n  actualColor = vec4(r,g,b,a);\n}\n\nvoid color(float r, float g, float b) {\n  color(r,g,b,1.0);\n}\n\nvoid color(sampler2D image) {\n  actualColor = texture2D(image, vTexCoord);\n}\n\n__MAIN_PARAMS__;\n__MAIN_CONSTANTS__;\n__KERNEL__;\n\nvoid main(void) {\n  index = int(vTexCoord.s * float(uTexSize.x)) + int(vTexCoord.t * float(uTexSize.y)) * uTexSize.x;\n  __MAIN_RESULT__;\n}";