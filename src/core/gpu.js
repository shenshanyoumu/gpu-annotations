'use strict';

const utils = require('./utils');
const WebGLRunner = require('../backend/web-gl/runner');
const WebGL2Runner = require('../backend/web-gl2/runner');
const CPURunner = require('../backend/cpu/runner');
const WebGLValidatorKernel = require('../backend/web-gl/validator-kernel');
const WebGL2ValidatorKernel = require('../backend/web-gl2/validator-kernel');
const GPUCore = require('./gpu-core');

// 完备的GPU库，基于WebGL上下文环境来创建执行函数；这样可以实现基于GPU的并行计算
class GPU extends GPUCore {
  constructor(settings) {
    super(settings);

    //GPU实例化的配置信息
    settings = settings || {};
    this._canvas = settings.canvas || null;
    this._webGl = settings.webGl || null;
    let mode = settings.mode;
    let detectedMode;
    // 如果浏览器不支持WebGL，而计算模式又不是CPU，则报错；否则回退到CPU执行JS代码
    if (!utils.isWebGlSupported()) {
      if (mode && mode !== 'cpu') {
        throw new Error(`A requested mode of "${mode}" and is not supported`);
      } else {
        console.warn('Warning: gpu not supported, falling back to cpu support');
        detectedMode = 'cpu';
      }
    } else {
      if (this._webGl) {
        // 判断浏览器支持的WebGL版本
        if (
          typeof WebGL2RenderingContext !== 'undefined' &&
          this._webGl.constructor === WebGL2RenderingContext
        ) {
          detectedMode = 'webgl2';
        } else if (
          typeof WebGLRenderingContext !== 'undefined' &&
          this._webGl.constructor === WebGLRenderingContext
        ) {
          detectedMode = 'webgl';
        } else {
          throw new Error('unknown WebGL Context');
        }
      } else {
        detectedMode = mode || 'gpu';
      }
    }

    // kernel函数定义了业务逻辑
    this.kernels = [];

    const runnerSettings = {
      canvas: this._canvas,
      webGl: this._webGl
    };

    // 在不同运行环境下的后端执行器
    switch (detectedMode) {
      // public options
      case 'cpu':
        this._runner = new CPURunner(runnerSettings);
        break;
      case 'gpu':
        const Runner = this.getGPURunner();
        this._runner = new Runner(runnerSettings);
        break;

      // private explicit options for testing
      case 'webgl2':
        this._runner = new WebGL2Runner(runnerSettings);
        break;
      case 'webgl':
        this._runner = new WebGLRunner(runnerSettings);
        break;

      // private explicit options for internal
      case 'webgl2-validator':
        this._runner = new WebGL2Runner(runnerSettings);
        this._runner.Kernel = WebGL2ValidatorKernel;
        break;
      case 'webgl-validator':
        this._runner = new WebGLRunner(runnerSettings);
        this._runner.Kernel = WebGLValidatorKernel;
        break;
      default:
        throw new Error(`"${mode}" mode is not defined`);
    }
  }
  /**
   *
   * This creates a callable function object to call the kernel function with the argument parameter set
   *
   * @name createKernel
   * @function
   * @memberOf GPU##
   *
   * @param {Function} fn - The calling to perform the conversion
   * @param {Object} [settings] - The parameter configuration object
   * @property {String} settings.dimensions - Thread dimension array (Defaults to [1024])
   * @property {String} settings.mode - CPU / GPU configuration mode (Defaults to null)
   *
   * The following modes are supported
   * *'falsey'* : Attempts to build GPU mode, else fallbacks
   * *'gpu'* : Attempts to build GPU mode, else fallbacks
   * *'cpu'* : Forces JS fallback mode only
   *
   *
   * @returns {Function} callable function to run
   *
   */
  createKernel(fn, settings) {
    //
    // basic parameters safety checks
    //
    if (typeof fn === 'undefined') {
      throw 'Missing fn parameter';
    }
    if (!utils.isFunction(fn) && typeof fn !== 'string') {
      throw 'fn parameter not a function';
    }

    const mergedSettings = Object.assign(
      {
        webGl: this._webGl,
        canvas: this._canvas
      },
      settings || {}
    );

    const kernel = this._runner.buildKernel(fn, mergedSettings);

    //if canvas didn't come from this, propagate from kernel
    if (!this._canvas) {
      this._canvas = kernel.getCanvas();
    }
    if (!this._runner.canvas) {
      this._runner.canvas = kernel.getCanvas();
    }

    this.kernels.push(kernel);

    return kernel;
  }

  //  kernelMap,可以在同一个超级kernel函数中执行多个操作过程，并且将每个操作过程结果进行独立保存
  createKernelMap() {
    let fn;
    let settings;
    if (typeof arguments[arguments.length - 2] === 'function') {
      fn = arguments[arguments.length - 2];
      settings = arguments[arguments.length - 1];
    } else {
      fn = arguments[arguments.length - 1];
    }

    if (!utils.isWebGlDrawBuffersSupported()) {
      this._runner = new CPURunner(settings);
    }

    const kernel = this.createKernel(fn, settings);
    if (Array.isArray(arguments[0])) {
      const functions = arguments[0];
      for (let i = 0; i < functions.length; i++) {
        kernel.addSubKernel(functions[i]);
      }
    } else {
      const functions = arguments[0];
      for (let p in functions) {
        if (!functions.hasOwnProperty(p)) continue;
        kernel.addSubKernelProperty(p, functions[p]);
      }
    }

    return kernel;
  }

  //   将多个kernel组合为一个超级kernel函数
  combineKernels() {
    const lastKernel = arguments[arguments.length - 2];
    const combinedKernel = arguments[arguments.length - 1];
    if (this.getMode() === 'cpu') return combinedKernel;

    const canvas = arguments[0].getCanvas();
    let webGl = arguments[0].getWebGl();

    for (let i = 0; i < arguments.length - 1; i++) {
      arguments[i]
        .setCanvas(canvas)
        .setWebGl(webGl)
        .setOutputToTexture(true);
    }

    return function() {
      combinedKernel.apply(null, arguments);
      const texSize = lastKernel.texSize;
      const gl = lastKernel.getWebGl();
      const threadDim = lastKernel.threadDim;
      let result;
      if (lastKernel.floatOutput) {
        const w = texSize[0];
        const h = Math.ceil(texSize[1] / 4);
        result = new Float32Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, result);
      } else {
        const bytes = new Uint8Array(texSize[0] * texSize[1] * 4);
        gl.readPixels(
          0,
          0,
          texSize[0],
          texSize[1],
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          bytes
        );
        result = new Float32Array(bytes.buffer);
      }

      result = result.subarray(0, threadDim[0] * threadDim[1] * threadDim[2]);

      if (lastKernel.output.length === 1) {
        return result;
      } else if (lastKernel.output.length === 2) {
        return utils.splitArray(result, lastKernel.output[0]);
      } else if (lastKernel.output.length === 3) {
        const cube = utils.splitArray(
          result,
          lastKernel.output[0] * lastKernel.output[1]
        );
        return cube.map(function(x) {
          return utils.splitArray(x, lastKernel.output[0]);
        });
      }
    };
  }

  getGPURunner() {
    if (
      typeof WebGL2RenderingContext !== 'undefined' &&
      utils.isWebGl2Supported()
    )
      return WebGL2Runner;
    if (typeof WebGLRenderingContext !== 'undefined') return WebGLRunner;
  }

  /**
   *
   * Adds additional functions, that the kernel may call.
   *
   * @name addFunction
   * @function
   * @memberOf GPU#
   *
   * @param {Function|String} fn - JS Function to do conversion
   * @param {Object} options
   *
   * @returns {GPU} returns itself
   *
   */
  addFunction(fn, options) {
    this._runner.functionBuilder.addFunction(null, fn, options);
    return this;
  }

  /**
   *
   * Adds additional native functions, that the kernel may call.
   *
   * @name addNativeFunction
   * @function
   * @memberOf GPU#
   *
   * @param {String} name - native function name, used for reverse lookup
   * @param {String} nativeFunction - the native function implementation, as it would be defined in it's entirety
   *
   * @returns {GPU} returns itself
   *
   */
  addNativeFunction(name, nativeFunction) {
    this._runner.functionBuilder.addNativeFunction(name, nativeFunction);
    return this;
  }

  // 获得gpu.js的运行后端，比如CPU、GPU、WebGL等
  getMode() {
    return this._runner.getMode();
  }

  //   判定浏览器是否支持canvas和WebGL
  isWebGlSupported() {
    return utils.isWebGlSupported();
  }

  /**
   *
   * Return TRUE, if system has integer division accuracy issue
   *
   * @name get hasIntegerDivisionAccuracyBug
   * @function
   * @memberOf GPU#
   *
   * Note: This function can also be called directly `GPU.hasIntegerDivisionAccuracyBug()`
   *
   * @returns {Boolean} TRUE if system has integer division accuracy issue
   *
   *
   */
  hasIntegerDivisionAccuracyBug() {
    return utils.hasIntegerDivisionAccuracyBug();
  }

  //  在当前GPU实例对象获得canvas 上下文对象
  getCanvas() {
    return this._canvas;
  }

  //  在当前GPU实例对象获得WebGL 上下文对象
  getWebGl() {
    return this._webGl;
  }

  //  当任务执行完毕后，调用destroy销毁GPU实例与WebGL环境的资源
  destroy() {
    setTimeout(() => {
      const { kernels } = this;
      const destroyWebGl = !this._webGl && kernels.length && kernels[0]._webGl;
      for (let i = 0; i < this.kernels.length; i++) {
        this.kernels[i].destroy(true); // remove canvas if exists
      }

      if (destroyWebGl) {
        destroyWebGl.OES_texture_float = null;
        destroyWebGl.OES_texture_float_linear = null;
        destroyWebGl.OES_element_index_uint = null;
        const loseContextExt = destroyWebGl.getExtension('WEBGL_lose_context');
        if (loseContextExt) {
          loseContextExt.loseContext();
        }
      }
    }, 0);
  }
}

// This ensure static methods are "inherited"
// See: https://stackoverflow.com/questions/5441508/how-to-inherit-static-methods-from-base-class-in-javascript
Object.assign(GPU, GPUCore);

module.exports = GPU;
