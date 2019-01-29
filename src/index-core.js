'use strict';

// 基于gpu-core实现的precompiled代码执行器，其实就是退化到CPU的JS执行器
const GPUCore = require('./core/gpu-core');
if (typeof module !== 'undefined') {
  module.exports = GPUCore;
}
if (typeof window !== 'undefined') {
  window.GPUCore = GPUCore;
  if (window.GPU === null) {
    window.GPU = GPUCore;
  }
}
