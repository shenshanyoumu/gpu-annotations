'use strict';

const utils = require('../core/utils');

// acorn是JS源代码解释器，babel等工具基于此构建AST
const acorn = require('acorn');

module.exports = class BaseFunctionNode {
  /**
   * @constructor FunctionNodeBase
   *
   * @desc在JS、WebGL或者OpenGL表示的单函数
   *
   *
   * @prop {String} functionName -函数名称
   * @prop {Function} jsFunction - AST节点表示的JS函数
   * @prop {String} jsFunctionString - jsFunction.toString()
   * @prop {String[]} paramNames - 函数参数列表
   * @prop {String[]} paramTypes - 参数类型
   * @prop {Boolean} isRootKernel - 针对kernel函数的特殊指示器
   * @prop {String} webglFunctionString - 经过WebGL处理后的函数字符串
   * @prop {String} openglFunctionString - 经过OpenGL处理后的函数字符串
   * @prop {String[]} calledFunctions - 被调用的函数列表
   * @param {String} functionName -  函数名
   * @param {Function|String} jsFunction - JS Function to do conversion
   * @param {Object} options 配置项
   *
   */
  constructor(functionName, jsFunction, options) {
    this.calledFunctions = [];
    this.calledFunctionsArguments = {};
    this.builder = null;
    this.isRootKernel = false;
    this.isSubKernel = false;
    this.parent = null;
    this.debug = null;
    this.prototypeOnly = null;
    this.constants = null;
    this.output = null;
    this.declarations = {};
    this.states = [];
    this.fixIntegerDivisionAccuracy = null;

    let paramTypes;
    let returnType;

    // 在README文档中，创建kernel函数可以附带options参数
    if (options) {
      if (options.hasOwnProperty('debug')) {
        this.debug = options.debug;
      }
      if (options.hasOwnProperty('prototypeOnly')) {
        this.prototypeOnly = options.prototypeOnly;
      }

      //   控制kernel函数中迭代最大次数
      if (options.hasOwnProperty('constants')) {
        this.constants = options.constants;
      }
      if (options.hasOwnProperty('output')) {
        this.output = options.output;
      }

      //   控制kernel函数中迭代最大次数
      if (options.hasOwnProperty('loopMaxIterations')) {
        this.loopMaxIterations = options.loopMaxIterations;
      }

      //   控制kernel函数中参数类型
      if (options.hasOwnProperty('paramTypes')) {
        this.paramTypes = paramTypes = options.paramTypes;
      }

      //   控制kernel函数中迭代最大次数
      if (options.hasOwnProperty('constantTypes')) {
        this.constantTypes = options.constantTypes;
      } else {
        this.constantTypes = {};
      }

      //控制强类型函数的返回值类型
      if (options.hasOwnProperty('returnType')) {
        returnType = options.returnType;
      }
      if (options.hasOwnProperty('fixIntegerDivisionAccuracy')) {
        this.fixIntegerDivisionAccuracy = options.fixIntegerDivisionAccuracy;
      }
    }

    //
    // Missing jsFunction object exception
    //
    if (!jsFunction) {
      throw 'jsFunction, parameter is missing';
    }

    //
    // Setup jsFunction and its string property + validate them
    //
    this.jsFunctionString = jsFunction.toString();
    if (!utils.isFunctionString(this.jsFunctionString)) {
      console.error(
        'jsFunction, to string conversion check failed: not a function?',
        this.jsFunctionString
      );
      throw 'jsFunction, to string conversion check failed: not a function?';
    }

    if (!utils.isFunction(jsFunction)) {
      //throw 'jsFunction, is not a valid JS Function';
      this.jsFunction = null;
    } else {
      this.jsFunction = jsFunction;
    }

    //
    // Setup the function name property
    //
    this.functionName =
      functionName ||
      (jsFunction && jsFunction.name) ||
      utils.getFunctionNameFromString(this.jsFunctionString);

    if (!this.functionName) {
      throw 'jsFunction, missing name argument or value';
    }

    // 从函数字符串中提取参数列表

    this.paramNames = utils.getParamNamesFromString(this.jsFunctionString);
    if (paramTypes) {
      if (Array.isArray(paramTypes)) {
        if (paramTypes.length !== this.paramNames.length) {
          throw 'Invalid argument type array length, against function length -> (' +
            paramTypes.length +
            ',' +
            this.paramNames.length +
            ')';
        }
        this.paramTypes = paramTypes;
      } else if (typeof paramTypes === 'object') {
        const paramVariableNames = Object.keys(paramTypes);
        if (paramTypes.hasOwnProperty('returns')) {
          this.returnType = paramTypes.returns;
          paramVariableNames.splice(paramVariableNames.indexOf('returns'), 1);
        }
        if (
          paramVariableNames.length > 0 &&
          paramVariableNames.length !== this.paramNames.length
        ) {
          throw 'Invalid argument type array length, against function length -> (' +
            paramVariableNames.length +
            ',' +
            this.paramNames.length +
            ')';
        } else {
          this.paramTypes = this.paramNames.map(key => {
            if (paramTypes.hasOwnProperty(key)) {
              return paramTypes[key];
            } else {
              return 'Number';
            }
          });
        }
      }
    } else {
      this.paramTypes = [];
    }

    // 函数返回值类型
    if (!this.returnType) {
      this.returnType = returnType || 'Number';
    }
  }

  isIdentifierConstant(paramName) {
    if (!this.constants) return false;
    return this.constants.hasOwnProperty(paramName);
  }

  isInput(paramName) {
    return this.paramTypes[this.paramNames.indexOf(paramName)] === 'Input';
  }

  setBuilder(builder) {
    this.builder = builder;
    return this;
  }

  pushState(state) {
    this.states.push(state);
  }

  popState(state) {
    if (this.state !== state) {
      throw new Error(`Cannot popState ${state} when in ${this.state}`);
    }
    this.states.pop();
  }

  isState(state) {
    return this.state === state;
  }

  get state() {
    return this.states[this.states.length - 1];
  }
  /**
   *
   * Core Functions
   *
   */

  //   返回在不同运行环境的JS函数，如果内部是JS函数字符串则转换为函数
  getJsFunction() {
    if (this.jsFunction) {
      return this.jsFunction;
    }

    if (this.jsFunctionString) {
      this.jsFunction = eval(this.jsFunctionString);
      return this.jsFunction;
    }

    throw 'Missing jsFunction, and jsFunctionString parameter';
  }

  //   针对AST语法树的节点进行处理
  astMemberExpressionUnroll(ast) {
    if (ast.type === 'Identifier') {
      return ast.name;
    } else if (ast.type === 'ThisExpression') {
      return 'this';
    }

    if (ast.type === 'MemberExpression') {
      if (ast.object && ast.property) {
        //babel sniffing
        if (ast.object.hasOwnProperty('name') && ast.object.name[0] === '_') {
          return this.astMemberExpressionUnroll(ast.property);
        }

        return (
          this.astMemberExpressionUnroll(ast.object) +
          '.' +
          this.astMemberExpressionUnroll(ast.property)
        );
      }
    }

    //babel sniffing
    if (ast.hasOwnProperty('expressions')) {
      const firstExpression = ast.expressions[0];
      if (
        firstExpression.type === 'Literal' &&
        firstExpression.value === 0 &&
        ast.expressions.length === 2
      ) {
        return this.astMemberExpressionUnroll(ast.expressions[1]);
      }
    }

    // Failure, unknown expression
    throw this.astErrorOutput('Unknown CallExpression_unroll', ast);
  }

  getJsAST(inParser) {
    // 如果kernel函数已经被解析为AST，则直接返回
    if (this.jsFunctionAST) {
      return this.jsFunctionAST;
    }

    inParser = inParser || acorn;
    if (inParser === null) {
      throw 'Missing JS to AST parser';
    }

    // 根据函数字符串，解析生成AST
    const ast = inParser.parse(
      'var ' + this.functionName + ' = ' + this.jsFunctionString + ';',
      {
        locations: true
      }
    );

    if (ast === null) {
      throw 'Failed to parse JS code';
    }

    // take out the function object, outside the var declarations
    const funcAST = ast.body[0].declarations[0].init;
    this.jsFunctionAST = funcAST;

    return funcAST;
  }

  /**
   * @memberOf FunctionNodeBase#
   * @function
   * @name getFunctionString
   *
   * @desc Returns the converted webgl shader function equivalent of the JS function
   *
   * @returns {String} webgl function string, result is cached under this.webGlFunctionString
   *
   */
  getFunctionString() {
    this.generate();
    return this.functionString;
  }

  /**
   * @memberOf FunctionNodeBase#
   * @function
   * @name setFunctionString
   *
   * @desc Set the functionString value, overwriting it
   *
   * @param {String} functionString - Shader code string, representing the function
   *
   */
  setFunctionString(functionString) {
    this.functionString = functionString;
  }

  /**
   * @memberOf FunctionNodeBase#
   * @function
   * @name getParamType
   *
   * @desc Return the type of parameter sent to subKernel/Kernel.
   *
   * @param {String} paramName - Name of the parameter
   *
   * @returns {String} Type of the parameter
   *
   */
  getParamType(paramName) {
    const paramIndex = this.paramNames.indexOf(paramName);
    if (paramIndex === -1) {
      if (this.declarations.hasOwnProperty(paramName)) {
        return this.declarations[paramName];
      } else {
        return 'Number';
      }
    } else {
      if (!this.parent) {
        if (this.paramTypes[paramIndex]) return this.paramTypes[paramIndex];
      } else {
        if (this.paramTypes[paramIndex]) return this.paramTypes[paramIndex];
        const calledFunctionArguments = this.parent.calledFunctionsArguments[
          this.functionName
        ];
        for (let i = 0; i < calledFunctionArguments.length; i++) {
          const calledFunctionArgument = calledFunctionArguments[i];
          if (calledFunctionArgument[paramIndex] !== null) {
            return (this.paramTypes[paramIndex] =
              calledFunctionArgument[paramIndex].type);
          }
        }
      }
    }
    return 'Number';
  }

  getConstantType(constantName) {
    if (this.constantTypes[constantName]) {
      return this.constantTypes[constantName];
    }
    return null;
  }

  /**
   * @memberOf FunctionNodeBase#
   * @function
   * @name getUserParamName
   *
   * @desc Return the name of the *user parameter*(subKernel parameter) corresponding
   * to the parameter supplied to the kernel
   *
   * @param {String} paramName - Name of the parameter
   *
   * @returns {String} Name of the parameter
   *
   */
  getUserParamName(paramName) {
    const paramIndex = this.paramNames.indexOf(paramName);
    if (paramIndex === -1) return null;
    if (!this.parent || !this.isSubKernel) return null;
    const calledFunctionArguments = this.parent.calledFunctionsArguments[
      this.functionName
    ];
    for (let i = 0; i < calledFunctionArguments.length; i++) {
      const calledFunctionArgument = calledFunctionArguments[i];
      const param = calledFunctionArgument[paramIndex];
      if (param !== null && param.type !== 'Integer') {
        return param.name;
      }
    }
    return null;
  }

  generate(options) {
    throw new Error('generate not defined on BaseFunctionNode');
  }

  /**
   * @memberOf FunctionNodeBase#
   * @function
   * @name astGeneric
   *
   * @desc Parses the abstract syntax tree for generically to its respective function
   *
   * @param {Object} ast - the AST object to parse
   * @param {Array} retArr - return array string
   *
   * @returns {Array} the parsed string array
   */
  astGeneric(ast, retArr) {
    if (ast === null) {
      throw this.astErrorOutput('NULL ast', ast);
    } else {
      if (Array.isArray(ast)) {
        for (let i = 0; i < ast.length; i++) {
          this.astGeneric(ast[i], retArr);
        }
        return retArr;
      }

      switch (ast.type) {
        case 'FunctionDeclaration':
          return this.astFunctionDeclaration(ast, retArr);
        case 'FunctionExpression':
          return this.astFunctionExpression(ast, retArr);
        case 'ReturnStatement':
          return this.astReturnStatement(ast, retArr);
        case 'Literal':
          return this.astLiteral(ast, retArr);
        case 'BinaryExpression':
          return this.astBinaryExpression(ast, retArr);
        case 'Identifier':
          return this.astIdentifierExpression(ast, retArr);
        case 'AssignmentExpression':
          return this.astAssignmentExpression(ast, retArr);
        case 'ExpressionStatement':
          return this.astExpressionStatement(ast, retArr);
        case 'EmptyStatement':
          return this.astEmptyStatement(ast, retArr);
        case 'BlockStatement':
          return this.astBlockStatement(ast, retArr);
        case 'IfStatement':
          return this.astIfStatement(ast, retArr);
        case 'BreakStatement':
          return this.astBreakStatement(ast, retArr);
        case 'ContinueStatement':
          return this.astContinueStatement(ast, retArr);
        case 'ForStatement':
          return this.astForStatement(ast, retArr);
        case 'WhileStatement':
          return this.astWhileStatement(ast, retArr);
        case 'DoWhileStatement':
          return this.astDoWhileStatement(ast, retArr);
        case 'VariableDeclaration':
          return this.astVariableDeclaration(ast, retArr);
        case 'VariableDeclarator':
          return this.astVariableDeclarator(ast, retArr);
        case 'ThisExpression':
          return this.astThisExpression(ast, retArr);
        case 'SequenceExpression':
          return this.astSequenceExpression(ast, retArr);
        case 'UnaryExpression':
          return this.astUnaryExpression(ast, retArr);
        case 'UpdateExpression':
          return this.astUpdateExpression(ast, retArr);
        case 'LogicalExpression':
          return this.astLogicalExpression(ast, retArr);
        case 'MemberExpression':
          return this.astMemberExpression(ast, retArr);
        case 'CallExpression':
          return this.astCallExpression(ast, retArr);
        case 'ArrayExpression':
          return this.astArrayExpression(ast, retArr);
        case 'DebuggerStatement':
          return this.astDebuggerStatement(ast, retArr);
      }

      throw this.astErrorOutput('Unknown ast type : ' + ast.type, ast);
    }
  }

  //    当AST解析出错，则抛出错误即其位置
  astErrorOutput(error, ast) {
    console.error(utils.getAstString(this.jsFunctionString, ast));
    console.error(error, ast, this);
    return error;
  }

  astDebuggerStatement(arrNode, retArr) {
    return retArr;
  }
  astFunctionDeclaration(ast, retArr) {
    return retArr;
  }
  astFunctionExpression(ast, retArr) {
    return retArr;
  }
  astReturnStatement(ast, retArr) {
    return retArr;
  }
  astLiteral(ast, retArr) {
    return retArr;
  }
  astBinaryExpression(ast, retArr) {
    return retArr;
  }
  astIdentifierExpression(ast, retArr) {
    return retArr;
  }
  astAssignmentExpression(ast, retArr) {
    return retArr;
  }
  astExpressionStatement(ast, retArr) {
    return retArr;
  }
  astEmptyStatement(ast, retArr) {
    return retArr;
  }
  astBlockStatement(ast, retArr) {
    return retArr;
  }
  astIfStatement(ast, retArr) {
    return retArr;
  }
  astBreakStatement(ast, retArr) {
    return retArr;
  }
  astContinueStatement(ast, retArr) {
    return retArr;
  }
  astForStatement(ast, retArr) {
    return retArr;
  }
  astWhileStatement(ast, retArr) {
    return retArr;
  }
  astDoWhileStatement(ast, retArr) {
    return retArr;
  }
  astVariableDeclaration(ast, retArr) {
    return retArr;
  }
  astVariableDeclarator(ast, retArr) {
    return retArr;
  }
  astThisExpression(ast, retArr) {
    return retArr;
  }
  astSequenceExpression(ast, retArr) {
    return retArr;
  }
  astUnaryExpression(ast, retArr) {
    return retArr;
  }
  astUpdateExpression(ast, retArr) {
    return retArr;
  }
  astLogicalExpression(ast, retArr) {
    return retArr;
  }
  astMemberExpression(ast, retArr) {
    return retArr;
  }
  astCallExpression(ast, retArr) {
    return retArr;
  }
  astArrayExpression(ast, retArr) {
    return retArr;
  }

  /**
   * @ignore
   * @function
   * @name pushParameter
   *
   * @desc [INTERNAL] pushes a fn parameter onto retArr and 'casts' to int if necessary
   *  i.e. deal with force-int-parameter state
   *
   * @param {Array} retArr - return array string
   * @param {String} parameter - the parameter name
   *
   */

  pushParameter(retArr, parameter) {
    if (this.isState('in-get-call-parameters')) {
      retArr.push(`int(${parameter})`);
    } else {
      retArr.push(parameter);
    }
  }
};
