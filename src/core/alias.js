'use strict';

const utils = require('./utils');

/**
 * name 表示函数名
 * fn 表示原有的函数字符串
 * 返回函数名称转换后的函数
 */
module.exports = function alias(name, fn) {
  const fnString = fn.toString();
  return new Function(
    `return function ${name} (${utils
      .getParamNamesFromString(fnString)
      .join(', ')}) {${utils.getFunctionBodyFromString(fnString)}}`
  )();
};
