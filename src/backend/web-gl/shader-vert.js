// 顶点着色器，对模型的顶点进行位置、颜色等变换
module.exports = `precision highp float;
precision highp int;
precision highp sampler2D;

attribute vec2 aPos;
attribute vec2 aTexCoord;

varying vec2 vTexCoord;
uniform vec2 ratio;

void main(void) {
  gl_Position = vec4((aPos + vec2(1)) * ratio + vec2(-1), 0, 1);
  vTexCoord = aTexCoord;
}`;
