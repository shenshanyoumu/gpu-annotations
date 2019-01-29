'use strict';

/**
 * gpu.js库使用的核心工具集合
 */
class UtilsCore {
  //判定参数是否是canvas元素
  static isCanvas(canvasObj) {
    return (
      canvasObj !== null &&
      ((canvasObj.nodeName &&
        canvasObj.getContext &&
        canvasObj.nodeName.toUpperCase() === 'CANVAS') ||
        (typeof OffscreenCanvas !== 'undefined' &&
          canvasObj instanceof OffscreenCanvas))
    );
  }

  //判断浏览器是否支持canvas
  static isCanvasSupported() {
    return _isCanvasSupported;
  }

  // 在浏览器环境下初始化canvas元素，如果不支持canvas则直接返回空
  static initCanvas() {
    // Fail fast if browser previously detected no support
    if (!_isCanvasSupported) {
      return null;
    }

    // Create a new canvas DOM
    const canvas =
      typeof document !== 'undefined'
        ? document.createElement('canvas')
        : new OffscreenCanvas(0, 0);

    // Default width and height, to fix webgl issue in safari
    canvas.width = 2;
    canvas.height = 2;

    // Returns the canvas
    return canvas;
  }

  //判断参数是否为WebGLContext，gpu.js的加速能力本质上是WebGL赋予的
  static isWebGl(webGlObj) {
    return webGlObj && typeof webGlObj.getExtension === 'function';
  }

  //   判断参数是否为WebGL2版本
  static isWebGl2(webGl2Obj) {
    return (
      webGl2Obj &&
      typeof WebGL2RenderingContext !== 'undefined' &&
      webGl2Obj instanceof WebGL2RenderingContext
    );
  }

  // 判断浏览器是否支持WebGL实现，目前主流浏览器都实现了WebGL标准
  static isWebGlSupported() {
    return _isWebGlSupported;
  }

  // 判断浏览器是否支持WebGL2
  static isWebGl2Supported() {
    return _isWebGl2Supported;
  }

  //   由于WebGL的不同实现细节在不同浏览器支持不一样，因此需要进行能力检测
  static isWebGlDrawBuffersSupported() {
    return _isWebGlDrawBuffersSupported;
  }

  // WebGL的一些默认配置，用于设置渲染图像的深度、抗锯齿等
  static initWebGlDefaultOptions() {
    return {
      alpha: false,
      depth: false,
      antialias: false
    };
  }

  //  基于给定的canvas元素，来初始化WebGL上下文环境
  static initWebGl(canvasObj) {
    // 先判定是否支持canvas特性
    if (typeof _isCanvasSupported !== 'undefined' || canvasObj === null) {
      if (!_isCanvasSupported) {
        return null;
      }
    }

    //判定参数是否为canvas元素
    if (!UtilsCore.isCanvas(canvasObj)) {
      throw new Error('Invalid canvas object - ' + canvasObj);
    }

    //下面canvas.getContext('experimental-webgl')是标准的获取WebGL上下文的代码
    let webGl = null;
    const defaultOptions = UtilsCore.initWebGlDefaultOptions();
    try {
      webGl = canvasObj.getContext('experimental-webgl', defaultOptions);
    } catch (e) {
      // 'experimental-webgl' is not a supported context type
      // fallback to 'webgl2' or 'webgl' below
    }

    // 如果不支持从canvas对象得到experimental-WebGL上下文，则采用下面形式
    if (webGl === null) {
      webGl =
        canvasObj.getContext('webgl2', defaultOptions) ||
        canvasObj.getContext('webgl', defaultOptions);
    }

    // 对WebGL上下文对象的扩展
    if (webGl) {
      // Get the extension that is needed
      webGl.OES_texture_float = webGl.getExtension('OES_texture_float');
      webGl.OES_texture_float_linear = webGl.getExtension(
        'OES_texture_float_linear'
      );
      webGl.OES_element_index_uint = webGl.getExtension(
        'OES_element_index_uint'
      );
    }

    // Returns the canvas
    return webGl;
  }

  //   初始化WebGL2上下文对象
  static initWebGl2(canvasObj) {
    // First time setup, does the browser support check memorizer
    if (typeof _isCanvasSupported !== 'undefined' || canvasObj === null) {
      if (!_isCanvasSupported) {
        return null;
      }
    }

    // Fail fast for invalid canvas object
    if (!UtilsCore.isCanvas(canvasObj)) {
      throw new Error('Invalid canvas object - ' + canvasObj);
    }

    // Create a new canvas DOM
    return canvasObj.getContext('webgl2', UtilsCore.initWebGlDefaultOptions());
  }

  //   检测计算结果是否合法，计算结果必须是数组，并且每个元素为数值型
  static checkOutput(output) {
    if (!output || !Array.isArray(output))
      throw new Error('kernel.output not an array');
    for (let i = 0; i < output.length; i++) {
      if (isNaN(output[i]) || output[i] < 1) {
        throw new Error(
          `kernel.output[${i}] incorrectly defined as \`${
            output[i]
          }\`, needs to be numeric, and greater than 0`
        );
      }
    }
  }
}

// 判断浏览器是否支持canvas
const _isCanvasSupported =
  typeof document !== 'undefined'
    ? UtilsCore.isCanvas(document.createElement('canvas'))
    : typeof OffscreenCanvas !== 'undefined';

//判定浏览器是否支持WebGL/WebGL2
const _testingWebGl = UtilsCore.initWebGl(UtilsCore.initCanvas());
const _testingWebGl2 = UtilsCore.initWebGl2(UtilsCore.initCanvas());

const _isWebGlSupported = UtilsCore.isWebGl(_testingWebGl);
const _isWebGl2Supported = UtilsCore.isWebGl2(_testingWebGl2);

// 判定浏览器是否支持buffer特性
const _isWebGlDrawBuffersSupported =
  _isWebGlSupported &&
  Boolean(_testingWebGl.getExtension('WEBGL_draw_buffers'));

// 如果支持WebGL上下文对象，则设置额外的属性
if (_isWebGlSupported) {
  UtilsCore.OES_texture_float = _testingWebGl.OES_texture_float;
  UtilsCore.OES_texture_float_linear = _testingWebGl.OES_texture_float_linear;
  UtilsCore.OES_element_index_uint = _testingWebGl.OES_element_index_uint;
} else {
  UtilsCore.OES_texture_float = false;
  UtilsCore.OES_texture_float_linear = false;
  UtilsCore.OES_element_index_uint = false;
}

module.exports = UtilsCore;
