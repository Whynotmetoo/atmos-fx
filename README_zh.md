# <img src="./docs/favicon.svg" width="36" height="36" align="center" alt="atmos-fx icon" /> atmos-fx

<div>
    <a href="README.md">English</a> · <b>简体中文</b>
</div>
<br>
atmos-fx是一个面向创意界面的 DOM 感知氛围特效 TypeScript 库，用来把类似天气的视觉效果真正融入 DOM，而不是只作为一个脱离内容的背景层。受 Apple Weather 启发：子级 UI 可以呈现玻璃质感、保持不透明，或作为粒子的碰撞表面。

![demo-high](https://atmosfx.carsonye.com/assets/demo-high.gif)

> **查看演示并使用 Playground，请访问 https://atmosfx.carsonye.com/**

[安装](#install) • [快速开始](#quick-start) • [API 参考](#api-reference) • [设计指南](#design--ui-guidelines)

## Install

```bash
npm i atmos-fx
```

## Quick start

### React

React 是封装组件所需的 peer dependency。

```tsx
import { AtmosFx, AtmosCard } from 'atmos-fx'

export function FunctionalDemo() {
  return (
    <AtmosFx preset="rain" density={0.7} className="functional-demo">
      <AtmosCard transMode="glass">
        <div>雨滴可以落在这个表面上，并从顶部边缘溅起。</div>
      </AtmosCard>
      
      {/* 使用 asChild，避免额外渲染一层包装元素 */}
      <AtmosCard asChild transMode="solid">
        <button>不透明操作按钮</button>
      </AtmosCard>

      <AtmosCard transMode="opacity" opacity={0.64}>
        <span>自定义透明度</span>
      </AtmosCard>
    </AtmosFx>
  )
}
```

### CDN

**使用打包工具（Vite、Webpack 等）：**
通过 `npm i atmos-fx` 安装并引入核心模块：

```ts
import { createAtmosphere } from 'atmos-fx'
```

**使用 CDN（无构建步骤）：**
如果你编写的是纯 HTML，没有打包工具，可以直接通过 ESM CDN 引入：

```html
<script type="module">
  import { createAtmosphere } from 'https://esm.sh/atmos-fx'

  const controller = createAtmosphere(document.querySelector('#container'), {
    preset: 'rain',
    density: 0.7
  })
  
  controller.start()
</script>
```

### Vanilla JS 示例

```html
<div id="container">
  <div data-atmos-collision data-atmos-glass data-atmos-liquid-dripping="true">
    <h1>交互式不透明卡片</h1>
    <p>降水粒子会在这里溅起。</p>
  </div>
</div>
```

```javascript
import { createAtmosphere } from 'atmos-fx'

const controller = createAtmosphere(document.querySelector('#container'), {
  preset: 'rain',
  density: 0.7,
  wind: -0.15,
  surfaceOpacity: 0.16,
})

controller.start()

// 如果在 React 之外移除 atmosphere 根元素，请记得销毁它：
// controller.destroy()
```

### Vue 示例

```html
<template>
  <div ref="containerRef" id="container">
    <!-- 使用 data 属性定义碰撞和玻璃表面 -->
    <div data-atmos-collision data-atmos-glass>
      <h1>交互式不透明卡片</h1>
      <p>降水粒子会在这里溅起。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { createAtmosphere } from 'atmos-fx'

const containerRef = ref(null)
let controller = null

onMounted(() => {
  if (containerRef.value) {
    controller = createAtmosphere(containerRef.value, {
      preset: 'rain',
      density: 0.7,
      wind: -0.15,
      surfaceOpacity: 0.16,
    })
    controller.start()
  }
})

onUnmounted(() => {
  if (controller) {
    controller.destroy()
  }
})
</script>
```

## API Reference

### `AtmosFx` Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `preset` | `'rain' \| 'snow' \| 'hail'` | `'rain'` | 应用预设的物理和视觉属性（别名：`mode`）。 |
| `particle` | `'rain' \| 'snow' \| 'hail'` | （继承预设） | 在不改变风速等物理预设的情况下，覆盖粒子的视觉渲染。 |
| `density` | `number` | `0.65` | 缩放预分配的粒子预算和生成数量，范围为 0 到 1。 |
| `speed` | `number` | `1.0` | 非负的重力和垂直下落速度系数。 |
| `wind` | `number` | `-0.12` | 影响水平方向摆动和粒子漂移的系数。 |
| `color` | `string` | `'#dcebffb7'` | CSS 颜色字符串，代表降水粒子的颜色。 |
| `quality` | `'auto' \| 'low' \| 'medium' \| 'high'` | `'auto'` | 限制粒子数量和设备像素比渲染精度。 |
| `transparency` | `'glass' \| 'opacity' \| 'none'` | `'glass'` | 子组件在根容器中的集成模式。 |
| `surfaceOpacity` | `number` | `0.14` | 全局玻璃表面透明度基准值。 |
| `contentOpacity` | `number` | `0.72` | 全局透明模式下的内容淡化程度。 |
| `snowAccumulation` | `number` | `0.55` | 控制积雪强度，范围为 0 到 1。 |
| `hailBounce` | `number` | `0.5` | 控制冰雹反弹恢复系数，范围为 0 到 1。 |
| `bottomCollision` | `boolean` | `true` | 决定粒子是否与容器底部边缘发生碰撞。 |
| `collisionSelector` | `string` | `[data-atmos-collision]` | 用于查找顶部边缘着陆表面的 CSS 选择器。 |
| `opaqueSelector` | `string` | `[data-atmos-opaque]` | 用于跳过透明度处理的不透明子级元素的 CSS 选择器。 |
| `liquidDripping` | `boolean` | `true` | 全局开关水汽凝结与滴落动画（仅在 Rain 模式下生效）。 |
| `liquidGatheringPoint` | `number` | 随机 | 设置水平汇合点，范围为 `0.33` 到 `0.66`；默认按卡片稳定随机。 |
| `pauseWhenHidden` | `boolean` | `true` | 当 document 不可见或根元素滑出视口时自动暂停动画。 |
| `respectReducedMotion`| `boolean` | `true` | 遵循操作系统的 `prefers-reduced-motion` 设置。 |
| `injectStyles` | `boolean` | `true` | 是否自动注入默认样式规则。 |
| `styleNonce` | `string` | `undefined` | 注入 style 标签时使用的 CSP nonce。 |

### `AtmosCard` Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `transMode` | `'glass' \| 'opacity' \| 'solid'` | `'glass'` | 应用于卡片的特定透明风格。 |
| `liquidDripping` | `boolean` | `true` | 开关水汽凝结与滴落动画。 |
| `liquidGatheringPoint` | `number` | 继承 / 随机 | 覆盖当前卡片的汇合点，范围为 `0.33` 到 `0.66`。 |
| `asChild` | `boolean` | `false` | 将属性合并到底层子元素上以避免额外渲染一层包装元素。 |
| `opacity` | `number` | `undefined` | 组件级别的自定义背景透明度覆盖值（0 到 1）。 |

### Vanilla JS `createAtmosphere` Options

`createAtmosphere(element, options)` 会返回一个 controller，包含 `start()`、`stop()`、`pause()`、`resume()`、`resize()`、`update(options)` 和 `destroy()`。

`options` 对象接受与 `AtmosFx` Props 完全相同的参数（除了 `mode` 别名）。

#### 使用 data attributes 为内部卡片定义 HTML：

- `data-atmos-opaque` 让元素跳过自动玻璃化或透明度处理。
- `data-atmos-opacity="0.64"` 为单个元素设置独立透明度。
- `data-atmos-glass` 让嵌套元素启用玻璃表面样式。
- `data-atmos-collision` 让元素顶部边缘成为降水粒子的碰撞表面。
- `data-atmos-liquid-dripping="true"` 开关水汽凝结与滴落动画（仅在 Rain 模式下生效）。
- `data-atmos-liquid-gathering-point="0.5"` 设置当前卡片的液体汇合点，范围为 `0.33` 到 `0.66`。

## Design & UI Guidelines

为了获得更真实自然的氛围效果，使用 `AtmosCard` 设计界面时建议遵循以下原则：

* **粒子分层与滴落**：粒子会在前景层和背景层中渲染。前景粒子会被可碰撞的 `AtmosCard` 元素阻挡。如果某个卡片启用了 `liquidDripping`，聚集的雨水会向下滴落，并与下方任何可碰撞的 `AtmosCard` 正确发生碰撞。
* **按宽度调整 Gathering**：卡片越宽，Gathering 越长（`900ms + 2ms × CSS 像素宽度`，最大 `4000ms`；`300px` 对应 `1500ms`）；后续滴落阶段保持固定时长。
* **避免过宽的阻挡卡片**：非常宽的可碰撞 `AtmosCard` 会像一把伞一样，挡住大部分前景雨滴。这会阻止雨滴到达下方元素，从而明显削弱它们的雨滴溅落动画。除非你有意实现这种“雨伞”效果，否则应避免使用过宽的碰撞表面。
* **避免嵌套卡片**：除非你有非常明确的视觉效果需求，否则不要将一个 `AtmosCard` 直接嵌套在另一个 `AtmosCard` 中。这可能导致碰撞边界和视觉行为相互冲突，产生不符合自然物理直觉的效果。
* **卡片模式（`transMode`）**：

  * `glass`：默认的磨砂玻璃效果，会触发高保真的背景模糊。
  * `opacity`：半透明模式，卡片依赖标准 CSS opacity 与天气背景融合。
  * `solid`：保留元素默认的不透明样式，允许你完全自定义外观，而不应用库提供的透明效果。

## Performance Notes

* 响应式页面建议优先使用 `quality: 'auto'`。
* 默认使用 WebGL 渲染；如果 WebGL 初始化失败，会自动静默降级为一个 dummy Canvas 2D context。
* 透明表面可以露出背景层的降水效果，同时前景降水仍然会与选定的 DOM 表面发生碰撞。
* 有意识地设置碰撞表面；目标元素的矩形区域会在动画帧循环之外刷新。
* 碰撞和滴落物理使用目标元素的轴对齐包围盒（AABB）。旋转元素（例如使用 `transform: rotate()`）会基于其外层包围矩形计算碰撞，而不是基于旋转后的视觉边界。
* 积雪效果会受到 quality、density 以及配置的堆积强度限制。
* 生产环境中建议保持 `respectReducedMotion` 启用。

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
```

当前实现包含项目基础结构、核心生命周期框架、WebGL 雨 / 雪 / 冰雹渲染器、静默 dummy Canvas 2D 降级方案、玻璃效果编排、雨滴顶部边缘碰撞溅起效果、卡片底部雨水汇聚与带张力拉伸 / 回弹的滴落物理、受限积雪、冰雹轻量反弹与受限堆积，以及一个静态 docs playground。

## Local Smoke Test

构建完成后，打开交互式 docs playground：

```bash
npm run build
npx vite --host 127.0.0.1 --port 4173
```

然后访问 `http://127.0.0.1:4173/docs/`，使用切换器体验并对比 rain、snow 和 hail。

## Contributing

构建和测试细节请参考 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

MIT
