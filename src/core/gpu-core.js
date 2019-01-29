'use strict';

const UtilsCore = require('./utils-core');

// 极简GPU.js库使用的核心版本，用于运行precompiled的GPU.js代码，即在CPU上执行JS代码
module.exports = class GPUCore {
  //验证kernel函数的配置项参数
  static validateKernelObj(kernelObj) {
    // 不能为空
    if (kernelObj === null) {
      throw 'KernelObj being validated is NULL';
    }

    // 将字符串形式转换为JSON
    if (typeof kernelObj === 'string') {
      try {
        kernelObj = JSON.parse(kernelObj);
      } catch (e) {
        console.error(e);
        throw 'Failed to convert KernelObj from JSON string';
      }

      // NULL validation
      if (kernelObj === null) {
        throw 'Invalid (NULL) KernelObj JSON string representation';
      }
    }

    // 检查kernel的标志
    if (kernelObj.isKernelObj !== true) {
      throw 'Failed missing isKernelObj flag check';
    }

    // 返回合法的kernelObj
    return kernelObj;
  }

  //验证kernel对象
  static loadKernelObj(kernelObj, inOpt) {
    kernelObj = validateKernelObj(kernelObj);
  }
};
