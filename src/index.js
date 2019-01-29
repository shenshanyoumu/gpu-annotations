'use strict';

const GPU = require('./core/gpu');

// 对函数进行别名处理
const alias = require('./core/alias');

// gpu库的辅助类库
const utils = require('./core/utils');

// 处理数值输入的类
const Input = require('./core/input');

// 用于实现kernel函数间数据流动的纹理技术
const Texture = require('./core/texture');

// CPU执行后端，将不同运行时的JS函数，比如WebGL环境下/OpenGL环境下的JS函数体转换后，在CPU上执行
const CPUFunctionBuilder = require('./backend/cpu/function-builder');
const CPUFunctionNode = require('./backend/cpu/function-node');
const CPUKernel = require('./backend/cpu/kernel');
const CPURunner = require('./backend/cpu/runner');

// 将kernel函数处理为在WebGL环境下的形式，并编译为GLSL在GPU执行
const WebGLFunctionBuilder = require('./backend/web-gl/function-builder');
const WebGLFunctionNode = require('./backend/web-gl/function-node');
const WebGLKernel = require('./backend/web-gl/kernel');
const WebGLRunner = require('./backend/web-gl/runner');

// 将kernel函数处理为在WebGL2环境下的形式，并编译为GLSL在GPU执行
const WebGL2FunctionBuilder = require('./backend/web-gl2/function-builder');
const WebGL2FunctionNode = require('./backend/web-gl2/function-node');
const WebGL2Kernel = require('./backend/web-gl2/kernel');
const WebGL2Runner = require('./backend/web-gl2/runner');

GPU.alias = alias;
GPU.utils = utils;
GPU.Texture = Texture;
GPU.Input = Input;
GPU.input = (value, size) => {
  return new Input(value, size);
};

GPU.CPUFunctionBuilder = CPUFunctionBuilder;
GPU.CPUFunctionNode = CPUFunctionNode;
GPU.CPUKernel = CPUKernel;
GPU.CPURunner = CPURunner;

GPU.WebGLFunctionBuilder = WebGLFunctionBuilder;
GPU.WebGLFunctionNode = WebGLFunctionNode;
GPU.WebGLKernel = WebGLKernel;
GPU.WebGLRunner = WebGLRunner;

GPU.WebGL2FunctionBuilder = WebGL2FunctionBuilder;
GPU.WebGL2FunctionNode = WebGL2FunctionNode;
GPU.WebGL2Kernel = WebGL2Kernel;
GPU.WebGL2Runner = WebGL2Runner;

// 不同运行环境下的模块输出形式
if (typeof module !== 'undefined') {
  module.exports = GPU;
}
if (typeof window !== 'undefined') {
  window.GPU = GPU;
}
if (typeof self !== 'undefined') {
  self.GPU = GPU;
}
