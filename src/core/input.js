// 输入类，其中参数value表示输入数值，一般为一维数组；而size表示对输入数值的维度裁剪
// 如果size表示数组，则构造表示三维结构的数组形式；如果size为对象，则同样构造为表示三维结构的数组形式
module.exports = class Input {
  constructor(value, size) {
    this.value = value;
    if (Array.isArray(size)) {
      this.size = [];
      for (let i = 0; i < size.length; i++) {
        this.size[i] = size[i];
      }
      while (this.size.length < 3) {
        this.size.push(1);
      }
    } else {
      if (size.z) {
        this.size = [size.x, size.y, size.z];
      } else if (size.y) {
        this.size = [size.x, size.y, 1];
      } else {
        this.size = [size.x, 1, 1];
      }
    }
  }
};
