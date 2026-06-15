# atmos-fx

[🇺🇸 English](./README.md) | [🇨🇳 简体中文](./README_zh.md)

[安装](#安装) • [快速开始](#快速开始) • [API 文档](#api-文档) • [设计与 UI 指南](#设计与-ui-指南)

> **查看演示并使用 Playground，请前往 [https://atmosfx.carsonye.com/](https://atmosfx.carsonye.com/)**

![demo-high](https://atmosfx.carsonye.com/assets/demo-high.gif)

为创意界面提供感知 DOM 的环境天气特效。

atmos-fx 是一个早期的 TypeScript 库，旨在将类似于天气的视觉效果作为 DOM 的一部分，而不是独立的背景。首个特效是类似苹果天气的降水效果，子级 UI 可以呈现玻璃质感、保持不透明，或者作为雨雪碰撞表面。

## 安装

```bash
npm i atmos-fx
```

## 快速开始

### React 用法

React 是包装器组件的必须 peer dependency。

```tsx
import { useRef } from 'react'
import { AtmosFx, AtmosCard } from 'atmos-fx'

export function WeatherPanel() {
  const rootRef = useRef<HTMLDivElement>(null)

  return (
    <AtmosFx ref={rootRef} mode="rain" density={0.7} className="weather-panel">
      <AtmosCard transMode="glass">
        <div>雨滴会落在这个表面上并在顶部边缘溅起水花。</div>
      </AtmosCard>
      
      {/* 使用 asChild 的多态元素示例 */}
      <AtmosCard asChild transMode="solid">
        <button>不透明的交互元素</button>
      </AtmosCard>

      <AtmosCard transMode="opacity" opacity={0.64}>
        <span>自定义透明度</span>
      </AtmosCard>
    </AtmosFx>
  )
}
```

### 原生 JS 用法

```ts
import { createAtmosphere } from 'atmos-fx'

const controller = createAtmosphere(document.querySelector('#hero')!, {
  preset: 'rain',
  density: 0.7,
  wind: -0.15,
  surfaceOpacity: 0.16,
})

controller.start()

// 如果在 React 之外移除 atmosphere 根节点，请确保销毁它：
// controller.destroy()
```

### DOM 控制属性 (原生 JS)

在初始化时，会自动向 document head 注入样式规则，无需手动引入样式表。

- `data-atmos-opaque` 使元素不受自动玻璃化或透明度处理的影响。
- `data-atmos-opacity="0.64"` 为单个元素应用透明度值。
- `data-atmos-glass` 使嵌套元素应用玻璃表面样式。
- `data-atmos-collision` 使元素的顶部边缘成为降水碰撞表面。
- `transparency: 'glass' | 'opacity' | 'none'` 控制根集成模式。

## API 文档

### React 组件

#### `AtmosFx` 组件参数

| 属性 | 类型 | 默认值 | 描述 |
| --- | --- | --- | --- |
| `mode` | `'rain' \| 'snow' \| 'hail'` | `'rain'` | 天气预设效果。 |
| `density` | `number` | `0.5` | 特效强度 (0 到 1)。 |
| `speed` | `number` | `1.0` | 非负的运动速度标量。 |
| `wind` | `number` | `0.0` | 水平运动标量，通常为 -1 到 1。 |
| `color` | `string` | `'#ffffff'` | 画布粒子的颜色。 |
| `quality` | `'auto' \| 'low' \| 'medium' \| 'high'` | `'auto'` | 渲染保真度和粒子数量。 |
| `transMode` | `'glass' \| 'opacity' \| 'none'` | `'glass'` | 子组件的根集成模式。 |
| `surfaceOpacity` | `number` | `0.12` | 玻璃表面基础透明度。 |
| `contentOpacity` | `number` | `0.2` | 控制透明模式下内容的淡化程度。 |
| `snowAccumulation` | `number` | `0` | 控制积雪强度 (0 到 1)。 |
| `hailBounce` | `number` | `0.85` | 控制冰雹反弹系数标量 (0 到 1)。 |
| `bottomCollision` | `boolean` | `true` | 控制容器底部边界的碰撞。 |
| `pauseWhenHidden` | `boolean` | `true` | 在页面隐藏时自动暂停动画。 |
| `respectReducedMotion`| `boolean` | `true` | 尊重操作系统的“减少动态效果”设置。 |
| `injectStyles` | `boolean` | `true` | 是否自动注入默认的样式表规则。 |
| `styleNonce` | `string` | `undefined` | 用于注入样式标签的 CSP nonce。 |

#### `AtmosCard` 组件参数

| 属性 | 类型 | 默认值 | 描述 |
| --- | --- | --- | --- |
| `transMode` | `'glass' \| 'opacity' \| 'solid'` | `'glass'` | 应用于卡片的透明度行为。 |
| `liquidDripping` | `boolean` | `true` | 切换水珠凝结和滴落的动画（仅在 Rain 模式下生效）。 |
| `asChild` | `boolean` | `false` | 将属性合并到基础子元素上，而不是渲染一个包装节点。**如果你想避免渲染额外的包装元素，你也可以使用 asChild。** |
| `opacity` | `number` | `undefined` | 组件级别的自定义背景透明度覆盖值 (0 到 1)。 |

### 原生 JS `createAtmosphere` 配置选项

`createAtmosphere(element, options)` 返回一个带有 `start()`, `stop()`, `pause()`, `resume()`, `resize()`, `update(options)` 和 `destroy()` 方法的控制器。

`options` 对象接受与 React 组件类似的属性：

| 选项 | 类型 | 描述 |
| --- | --- | --- |
| `preset` | `'rain' \| 'snow' \| 'hail'` | 天气预设效果 |
| `density` | `number` | `0` 到 `1` |
| `speed` | `number` | 非负运动标量 |
| `wind` | `number` | 水平运动标量，通常 `-1` 到 `1` |
| `color` | `string` | 画布颜色字符串 |
| `quality` | `'auto' \| 'low' \| 'medium' \| 'high'` | 渲染保真度 |
| `transparency` | `'glass' \| 'opacity' \| 'none'` | 控制根集成模式 |
| `surfaceOpacity` | `number` | `0` 到 `1`，控制玻璃表面的透明度 |
| `contentOpacity` | `number` | `0` 到 `1`，控制透明模式的内容淡化 |
| `snowAccumulation` | `number` | `0` 到 `1`，控制积雪强度 |
| `hailBounce` | `number` | `0` 到 `1`，控制冰雹反弹系数标量 |
| `bottomCollision` | `boolean` | 控制容器底部边界碰撞 |
| `liquidDripping` | `boolean` | 控制卡片底部是否激活雨水滴落效果 |
| `collisionSelector` | `string` | 降水着陆表面的选择器 |
| `opaqueSelector` | `string` | 实心子控件的选择器 |
| `injectStyles` | `boolean` | 控制是否自动注入默认样式规则 |
| `styleNonce` | `string` | 用于注入样式的 CSP nonce |
| `pauseWhenHidden` | `boolean` | 生产环境性能开关 |
| `respectReducedMotion`| `boolean` | 生产环境无障碍访问开关 |

## 设计与 UI 指南

为了确保大气特效在视觉上更逼真，请在设计 `AtmosCard` 时遵循以下指南：

- **粒子分层与滴落**: 粒子分为前景和背景渲染层。前景粒子会被可碰撞的 `AtmosCard` 元素阻挡。如果卡片开启了 `liquidDripping`，积累的雨水会向下滴落并与下方任何可碰撞的 `AtmosCard` 正确发生碰撞。
- **避免过宽的遮挡卡片**: 过宽的可碰撞 `AtmosCard` 会像伞一样阻挡大部分前景雨水。这会导致雨水无法到达其下方元素，明显减少其下方的水花溅起动画。除非有意制造这种“伞”效应，否则请避免使用过宽的碰撞表面。
- **避免嵌套卡片**: 除非你有高度特定的视觉效果需求，否则请避免将一个 `AtmosCard` 直接嵌套在另一个 `AtmosCard` 内。这会导致冲突的碰撞边界和违反自然物理规律的视觉行为。
- **卡片模式 (`transMode`)**:
  - `glass`: 默认的磨砂玻璃效果，触发高保真度的背景模糊。
  - `opacity`: 半透明模式，卡片依靠标准的 CSS 透明度与天气背景融合。
  - `solid`: 保留元素的默认不透明样式，允许你完全自定义外观，而无需应用库提供的透明效果。

## 性能说明

- 对于响应式页面，建议优先使用 `quality: 'auto'`。
- 渲染默认使用 WebGL，如果 WebGL 初始化失败，会自动回退到静默的虚拟 Canvas 2D 上下文。
- 透明表面可以透出背景层的降水，而前景降水仍能与所选的 DOM 表面发生碰撞。
- 请保持碰撞表面的目标明确；目标矩形在动画帧循环之外刷新。
- 碰撞和滴落物理使用目标元素的轴对齐包围盒 (AABB)。如果元素被旋转（例如使用 `transform: rotate()`），碰撞计算将针对其外部边界矩形，而不是旋转后的视觉边界。
- 积雪受限于质量、密度和配置的积雪强度。
- 在生产环境中请保持启用 `respectReducedMotion`。

## 本地开发

```bash
npm install
npm run typecheck
npm run build
npm test
```

当前的实现包含了项目基础结构、核心生命周期外壳、WebGL 雨、雪和冰雹渲染器、静默虚拟 Canvas 2D 回退、玻璃效果编排、雨的顶部边缘碰撞水花、沿着卡片底部积累并带有张力拉伸和快速滴落物理的雨水、有限制的积雪、冰雹的光线反弹和受限积累，以及一个静态文档 Playground。

## 本地冒烟测试

构建完成后，打开交互式文档 playground：

```bash
npm run build
npx vite --host 127.0.0.1 --port 4173
```

然后访问 `http://127.0.0.1:4173/docs/` 使用切换器并比较雨、雪和冰雹。

## 贡献指南

有关构建和测试的详细信息，请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 协议

MIT
