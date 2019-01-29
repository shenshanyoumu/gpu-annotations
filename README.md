[![Logo](http://gpu.rocks/img/ogimage.png)](http://gpu.rocks/)

# GPU.js

GPU.js 是一个面向 GPGPU 的 Javascript 加速库，其工作原理就是将 JS 代码编译成着色器语言然后在 GPU 上运行。如果 GPU 不支持着色器语言的执行，则回退到普通的 JS 执行模式

[![Join the chat at https://gitter.im/gpujs/gpu.js](https://badges.gitter.im/gpujs/gpu.js.svg)](https://gitter.im/gpujs/gpu.js?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

[![Slack](https://slack.bri.im/badge.svg)](https://slack.bri.im)

# What is this sorcery?

基于 GPU.js 编写的矩阵乘法:

```js
const gpu = new GPU();

// 注意下面参数a、b表示两个512*512的矩阵，而this.thread由gpu.js库编译后充分利用GPU的多核来并行计算
const matMult = gpu
  .createKernel(function(a, b) {
    var sum = 0;
    for (var i = 0; i < 512; i++) {
      sum += a[this.thread.y][i] * b[i][this.thread.x];
    }
    return sum;
  })
  .setOutput([512, 512]);

const c = matMult(a, b);
```

可以执行 benchMark [这里](http://gpu.rocks). 其加速性能根据硬件环境而定.

也可以使用 [kernel playground here](http://gpu.rocks/playground)进行在线尝试

# Table of Contents

- [Installation](#installation)
- [`GPU` Options](#gpu-options)
- [`gpu.createKernel` Options](#gpu-createkernel-options)
- [Creating and Running Functions](#creating-and-running-functions)
- [Accepting Input](#accepting-input)
- [Graphical Output](#graphical-output)
- [Combining Kernels](#combining-kernels)
- [Create Kernel Map](#create-kernel-map)
- [Adding Custom Functions](#adding-custom-functions)
- [Adding Custom Functions Directly to Kernel](#adding-custom-functions-directly-to-kernel)
- [Loops](#loops)
- [Pipelining](#pipelining)
- [Offscreen Canvas](#offscreen-canvas)
- [Cleanup](#cleanup)
- [Flattened typed array support](#flattened-typed-array-support)
- [Supported Math functions](#supported-math-functions)
- [Full API reference](#full-api-reference)
- [Automatically-built Documentation](#automatically-built-documentation)
- [Contributors](#contributors)
- [Contributing](#contributing)
- [Terms Explained](#terms-explained)
- [License](#license)

## Installation

### npm

```bash
npm install gpu.js --save #安装gpu.js模块
```

### yarn

```bash
yarn add gpu.js #基于yarn工具来安装
```

[npm package](https://www.npmjs.com/package/gpu.js)

### Browser

也可以在 HTML 页面的 scripts 引入:

```html
<script src="/path/to/js/gpu.min.js"></script>
```

初始化库:

```js
const gpu = new GPU();
```

## `GPU` Options

用于创建 `GPU`实例的配置项. 比如 `new GPU(options)`

- `canvas`: `HTMLCanvasElement`. 可选配置，用于在同一个 canvas 上下文环境共享，比如在 Three 和 gpu.js 共享
- `webGl`: `WebGL2RenderingContext` or `WebGLRenderingContext`. 用于共享渲染上下文环境

## `gpu.createKernel` Options

用于创建 `kernel` 或者 `kernelMap`的配置对象. 比如 `gpu.createKernel(options)`

- `output`: 数组/对象，用于描述 kernel 的输出.
  - 数组形式: `[width]`, `[width, height]`, or `[width, height, depth]`
  - 对象形式: `{ x: width, y: height, z: depth }`
- outputToTexture: 是否将输出结果载通过纹理转换，这样可以基于 gpu.js 来完成 Three 的一些功能
- graphical: 是否输出为图像
- loopMaxIterations: 迭代输出次数
- constants: object
- wraparound: boolean
- hardcodeConstants: boolean
- floatTextures: boolean - input/working textures use float32 for each colour channel
- floatOutput: boolean - output texture uses float32 for each colour channel
- fixIntegerDivisionAccuracy: boolean - some cards have accuracy issues dividing by factors of three and some other primes (most apple kit?). Default on for affected cards, disable if accuracy not required.
- functions: array or boolean
- nativeFunctions: object
- subKernels: array
- outputImmutable: boolean

  - default to `false`

## Creating and Running Functions

基于输出类型来定义输出维度，必须显式定义输出维度才能进行加速计算过程

| Output size | How to specify output size | How to reference in kernel                           |
| ----------- | -------------------------- | ---------------------------------------------------- |
| 1D          | `[length]`                 | `myVar[this.thread.x]`                               |
| 2D          | `[width, height]`          | `myVar[this.thread.y][this.thread.x]`                |
| 3D          | `[width, height, depth]`   | `myVar[this.thread.z][this.thread.y][this.thread.x]` |

```js
const opt = {
  output: [100]
};
```

or

```js
// You can also use x, y, and z
const opt = {
  output: { x: 100 }
};
```

创建能够在 GPU 上执行的函数，`creeateKernel`函数接受的一个参数为 kernel 函数，将基于 GPU 的核来计算，比如 `this.thread.x`, `this.thread.y` or `this.thread.z` 来决定输出结构

```js
const myFunc = gpu.createKernel(function() {
  return this.thread.x;
}, opt);
```

```js
myFunc();
// Result: [0, 1, 2, 3, ... 99]
```

```js
const myFunc = gpu
  .createKernel(function() {
    return this.thread.x;
  })
  .setOutput([100]); // 设置输出为长度为100的一维数组

myFunc();
// Result: [0, 1, 2, 3, ... 99]
```

### Declaring variables

GPU.js 支持在 kernel 函数中参与运算的数据类型包括:
Numbers
Array(2)
Array(3)
Array(4)

数值型:

```js
const myFunc = gpu
  .createKernel(function() {
    const i = 1;
    const j = 0.89;
    return i + j;
  })
  .setOutput([100]);
```

长度为 2 的数组:

```js
const myFunc = gpu
  .createKernel(function() {
    const array2 = [0.08, 2];
    return array2;
  })
  .setOutput([100]);
```

长度为 3 的数组:

```js
const myFunc = gpu
  .createKernel(function() {
    const array2 = [0.08, 2, 0.1];
    return array2;
  })
  .setOutput([100]);
```

长度为 4 的数组:

```js
const myFunc = gpu
  .createKernel(function() {
    const array2 = [0.08, 2, 0.1, 3];
    return array2;
  })
  .setOutput([100]);
```

## Accepting Input

### kernel 函数接受参数类型

- 数值型
- 一维数组
- 二维数组
- 三维数组
- HTML Image
- Array of HTML Images

### 输出参数例子

```js
const myFunc = gpu
  .createKernel(function(x) {
    return x;
  })
  .setOutput([100]);

myFunc(42);
// Result: [42, 42, 42, 42, ... 42]
```

参数为数组形式:

```js
const myFunc = gpu
  .createKernel(function(x) {
    return x[this.thread.x % 3];
  })
  .setOutput([100]);

myFunc([1, 2, 3]);
// Result: [1, 2, 3, 1, ... 1 ]
```

接受 HTML Image 作为参数:

```js
const myFunc = gpu
  .createKernel(function(image) {
    const pixel = image[this.thread.y][this.thread.x];
    this.color(pixel[0], pixel[1], pixel[2], pixel[3]);
  })
  .setGraphical(true)
  .setOutput([100]);

const image = new document.createElement('img');
image.src = 'my/image/source.png';
image.onload = () => {
  myFunc(image);
  // Result: colorful image
};
```

接受 HTML Images 数组作为参数:

```js
const myFunc = gpu
  .createKernel(function(image) {
    const pixel = image[this.thread.z][this.thread.y][this.thread.x];
    this.color(pixel[0], pixel[1], pixel[2], pixel[3]);
  })
  .setGraphical(true) // 输出为图像
  .setOutput([100]);

const image1 = new document.createElement('img');
image1.src = 'my/image/source1.png';
image1.onload = onload;
const image2 = new document.createElement('img');
image2.src = 'my/image/source2.png';
image2.onload = onload;
const image3 = new document.createElement('img');
image3.src = 'my/image/source3.png';
image3.onload = onload;
const totalImages = 3;
let loadedImages = 0;
function onload() {
  loadedImages++;
  if (loadedImages === totalImages) {
    myFunc([image1, image2, image3]);
    // Result: colorful image composed of many images
  }
}
```

## 图像格式输出

有时需要生成 `canvas` 图像而不是单纯进行数值计算. 为了实现这个功能，需要设置 `graphical`标记为`true`，并且 setOutput 为 `[width, height]`. 在自定义的 kernel 函数内部, 使用`this.color(r,g,b)` 或者 `this.color(r,g,b,a)` 来定义图像相应像素的颜色.

```js
const render = gpu
  .createKernel(function() {
    this.color(0, 0, 0, 1);
  })
  .setOutput([20, 20])
  .setGraphical(true);

// 渲染一个黑色的20*20区域的图像，然后绘制到canvas元素上
render();

const canvas = render.getCanvas();
document.getElementsByTagName('body')[0].appendChild(canvas);
```

### Alpha

基于`premultipliedAlpha`来进行图像通道设置:

```js
const canvas = DOM.canvas(500, 500);
const gl = canvas.getContext('webgl2', { premultipliedAlpha: false });

const gpu = new GPU({
  canvas,
  webGl: gl
});
const krender = gpu
  .createKernel(function(x) {
    this.color(this.thread.x / 500, this.thread.y / 500, x[0], x[1]);
  })
  .setOutput([500, 500])
  .setGraphical(true);
```

## Combining kernels

基于 `combineKernels` 方法可以整合多个 kernel 函数，而不需要数据在 CPU 和 GPU 之间的多次流动.
_**Note:**_ Kernels can have different output sizes.

```js
const add = gpu
  .createKernel(function(a, b) {
    return a + b;
  })
  .setOutput([20]);

const multiply = gpu
  .createKernel(function(a, b) {
    return a * b;
  })
  .setOutput([20]);

// 先进行数组加法，然后乘法
const superKernel = gpu.combineKernels(add, multiply, function(a, b, c) {
  return multiply(add(a[this.thread.x], b[this.thread.x]), c[this.thread.x]);
});

superKernel(a, b, c);
```

## Create Kernel Map

有时候需要在同一个 kernel 函数进行多种运算过程, 并且独立保存每个独立过程的执行结果，因此 gpu.js 提供 `createKernelMap`方法来实现.

### object outputs

```js
const megaKernel = gpu.createKernelMap(
  {
    addResult: function add(a, b) {
      return a + b;
    },
    multiplyResult: function multiply(a, b) {
      return a * b;
    }
  },
  function(a, b, c) {
    return multiply(add(a[this.thread.x], b[this.thread.x]), c[this.thread.x]);
  }
);

megaKernel(a, b, c);
// Result: { addResult: [], multiplyResult: [], result: [] }
```

### array outputs

```js
const megaKernel = gpu.createKernelMap(
  [
    function add(a, b) {
      return a + b;
    },
    function multiply(a, b) {
      return a * b;
    }
  ],
  function(a, b, c) {
    return multiply(add(a[this.thread.x], b[this.thread.x]), c[this.thread.x]);
  }
);

megaKernel(a, b, c);
// Result: [ [], [] ].result []
```

## Adding custom functions

使用 `gpu.addFunction(function() {}, options)`来添加自定义函数:

```js
gpu.addFunction(function mySuperFunction(a, b) {
  return a - b;
});
function anotherFunction(value) {
  return value + 1;
}
gpu.addFunction(anotherFunction);
const kernel = gpu
  .createKernel(function(a, b) {
    return anotherFunction(mySuperFunction(a[this.thread.x], b[this.thread.x]));
  })
  .setOutput([20]);
```

### Adding strongly typed functions

强类型函数定义了返回值类型和参数类似:

- 'Array'
- 'Array(2)'
- 'Array(3)'
- 'Array(4)'
- 'HTMLImage'
- 'HTMLImageArray'
- 'Number'
- 'NumberTexture'
- 'ArrayTexture(4)'

```js
gpu.addFunction(
  function mySuperFunction(a, b) {
    return [a - b[1], b[0] - a];
  },
  //下面表示参数a为数值型、参数b为数组，而返回值为数组类型
  { paramTypes: { a: 'Number', b: 'Array(2)' }, returnType: 'Array(2)' }
);
```

## Adding custom functions directly to kernel

```js
function mySuperFunction(a, b) {
  return a - b;
}
const kernel = gpu
  .createKernel(function(a, b) {
    return mySuperFunction(a[this.thread.x], b[this.thread.x]);
  })
  .setOutput([20])
  .setFunctions([mySuperFunction]);
```

## Loops

- 定义在 kernel 函数中的循环过程必须设置最大迭代次数，可以通过`loopMaxIterations`配置选项设置
- 除此之外，还可以通过内置的 constants 对象和固定值来设置迭代次数 [Dynamic sized via constants](dynamic-sized-via-constants)

### 基于 constants 来设置迭代次数

```js
const matMult = gpu.createKernel(
  function(a, b) {
    var sum = 0;
    for (var i = 0; i < this.constants.size; i++) {
      sum += a[this.thread.y][i] * b[i][this.thread.x];
    }
    return sum;
  },
  {
    constants: { size: 512 },
    output: [512, 512]
  }
);
```

### 固定值 512 表示最大迭代次数

```js
const matMult = gpu
  .createKernel(function(a, b) {
    var sum = 0;
    for (var i = 0; i < 512; i++) {
      sum += a[this.thread.y][i] * b[i][this.thread.x];
    }
    return sum;
  })
  .setOutput([512, 512]);
```

## Pipelining

基于 [管道](<https://en.wikipedia.org/wiki/Pipeline_(computing)>)技术，可将 kernel 函数的执行结果通过纹理对象直接输入到另一个 kernel 函数。为了开启管道，可以通过设置 `outputToTexture: boolean` 选项或者调用`kernel.setOutputToTexture(true)`

## Offscreen Canvas

GPU.js 支持离线 canva，下面例子:

文件: `gpu-worker.js`

```js
importScripts('path/to/gpu.js');
onmessage = function() {
  // define gpu instance
  const gpu = new GPU();

  // input values
  const a = [1, 2, 3];
  const b = [3, 2, 1];

  // setup kernel
  const kernel = gpu
    .createKernel(function(a, b) {
      return a[this.thread.x] - b[this.thread.x];
    })
    .setOutput([3]);

  // output some results!
  postMessage(kernel(a, b));
};
```

file: `index.js`

```js
var worker = new Worker('gpu-worker.js');
worker.onmessage = function(e) {
  var result = e.data;
  console.log(result);
};
```

## 清理工作

- 针对 `GPU` 实例对象，使用`gpu.destroy()`方法进行清理
- 针对 `Kernel`实例对象，使用 `kernel.destroy()`方法进行清理

## 扁平化类型数组功能

基于 Input 类来处理扁平化类型数组，从而方便开发者传参:

```js
import GPU, { input } from 'gpu.js';
const gpu = new GPU();
const kernel = gpu
  .createKernel(function(a, b) {
    return a[this.thread.y][this.thread.x] + b[this.thread.y][this.thread.x];
  })
  .setOutput([3, 3]);

// 基于input辅助类来对扁平化的类型数组进行处理，以方便在kernel函数内部计算。
// 记住input方法的第二个参数size，表示内部使用的数组维度
kernel(
  input(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), [3, 3]),
  input(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), [3, 3])
);
```

## gpu.js 支持的 Math 方法

由于在 kernel 函数中定义的代码最终被转换为 GLSL 代码并输入 GPU 执行，因此并不会支持全量的 Math 方法，下面列举了部分支持的 Math 方法:

```
abs
acos
asin
atan
atan2
ceil
cos
exp
floor
log
log2
max
min
round
sign
sin
sqrt
tan
```

## API 文档

可以在 [API 完全手册](https://doxdox.org/gpujs/gpu.js/1.2.0)参考.

## 自动构建文档

代码文档在 [automatically built](https://github.com/gpujs/gpu.js/wiki/Automatic-Documentation).

## 贡献者

- Fazli Sapuan
- Eugene Cheah
- Matthew Saw
- Robert Plummer
- Abhishek Soni
- Juan Cazala
- Daniel X Moore
- Mark Theng
- Varun Patro

## 贡献 PR

基于项目的`develop`开发，并提交 PR 到`develop`分支.

## 术语解释

- Kernel - 基于 Graphic Processor 处理的自定义函数
- Texture - 打包数据的图像结构, 在 GPU.js 中每个图像像素由 32 位表示

## License

The MIT License

Copyright (c) 2018 GPU.js Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
