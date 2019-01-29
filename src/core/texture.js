'use strict';

module.exports = class Texture {
  /**
   *
   * @param {*} texture 纹理图片
   * @param {*} size 纹理图片尺寸
   * @param {*} dimensions 纹理映射维度
   * @param {*} output 纹理映射输出
   * @param {*} webGl WebGL上下文环境
   * @param {*} type 纹理映射类型
   */
  constructor(
    texture,
    size,
    dimensions,
    output,
    webGl,
    type = 'NumberTexture'
  ) {
    this.texture = texture;
    this.size = size;
    this.dimensions = dimensions;
    this.output = output;
    this.webGl = webGl;
    this.kernel = null;
    this.type = type;
  }

  /*
   * 将gpu实例对象转换为数组形式，其中kernel数组每个元素对应GPU的一个运算核
   */
  toArray(gpu) {
    if (!gpu)
      throw new Error('You need to pass the GPU object for toArray to work.');
    if (this.kernel) return this.kernel(this);

    // 这一段代码是核心功能
    this.kernel = gpu
      .createKernel(function(x) {
        return x[this.thread.z][this.thread.y][this.thread.x];
      })
      .setOutput(this.output);

    return this.kernel(this);
  }

  /**
   * 删除WebGL上下文环境的纹理
   */
  delete() {
    return this.webGl.deleteTexture(this.texture);
  }
};
