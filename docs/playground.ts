import { createAtmosphere } from '../src/index.ts'

const showcaseRoot = document.querySelector('#showcase-stage') as HTMLElement
const playgroundRoot = document.querySelector('#playground-stage') as HTMLElement

// Translations Dictionary
const TRANSLATIONS: Record<'en' | 'zh', Record<string, string>> = {
  en: {
    "nav-brand": "atmos-fx",
    "intro-desc": "A high-performance DOM-aware WebGL atmosphere engine for weather animations, card overlays, and creative styling.",
    "showcase-hero-eyebrow": "DOM-aware atmosphere lab",
    "showcase-hero-title": "atmos-fx",
    "showcase-hero-desc": "A high-performance DOM-aware WebGL atmosphere engine for weather animations, card overlays, and creative styling.",
    "showcase-deck-title": "Live controls",
    "showcase-deck-density": "Density",
    "showcase-deck-wind": "Wind",
    "showcase-deck-transparency": "Transparency",
    "showcase-deck-particle": "Particle",
    "showcase-deck-collision": "Collision",
    "showcase-deck-collision-val": "bottom + DOM",
    "showcase-forecast-title": "Translucent Layering",
    "showcase-forecast-desc": "Background particles render underneath text content, preserving perfect readability.",
    "showcase-ticket-title": "Collision Physics",
    "showcase-ticket-val-rain": "Splashing",
    "showcase-ticket-val-snow": "Accumulating",
    "showcase-ticket-val-hail": "Bouncing",
    "showcase-tilt-title": "Wind Vector Force",
    "showcase-tilt-east": "Drifting East",
    "showcase-tilt-west": "Drifting West",
    "showcase-micro-1-title": "Interactive Glass Card",
    "showcase-micro-1-desc": "Generates dynamic backdrop blur and registers collision top-edges.",
    "showcase-micro-2-title": "Solid Opaque Island",
    "showcase-micro-2-desc": "Opaque cards block precipitation without any blur shaders.",
    "showcase-micro-3-title": "Faded Opacity Card",
    "showcase-micro-3-desc": "Fades particle density beneath text overlays dynamically.",
    "showcase-micro-4-title": "Physical Ledge Rail",
    "showcase-micro-4-desc": "Acts as a landing shelf for snow accumulation and hail bounces.",
    "playground-title": "Playground",
    "playground-info-desc": "Displays live meteorological status readings and configuration logs. Fully reactive to transparency and collision options.",
    "form-placeholder": "Type here...",
    "form-submit": "Submit",
    "control-weather-preset": "Weather Preset",
    "control-preset-rain": "Rain",
    "control-preset-snow": "Snow",
    "control-preset-hail": "Hail",
    "control-density": "Density",
    "control-speed": "Speed",
    "control-wind": "Wind",
    "control-snow-accum": "Snow Accumulation",
    "control-hail-bounce": "Hail Bounce",
    "control-bottom-collision": "Bottom Collision",
    "control-liquid-dripping": "Liquid Dripping",
    "control-quality": "Quality",
    "control-quality-auto": "Auto (Adaptive)",
    "control-quality-high": "High",
    "control-quality-medium": "Medium",
    "control-quality-low": "Low",
    "control-transparency": "Transparency Mode",
    "control-transparency-glass": "Glass (Standard Blurs)",
    "control-transparency-opacity": "Opacity (Translucent)",
    "control-transparency-none": "None (Solid Cards)",
    "control-surface-opacity": "Alpha",
    "control-content-opacity": "Content Opacity",
    "control-color": "Precipitation Color",
    "quick-start-title": "Quick Start",
    "quick-start-step1": "1. Install package via npm:",
    "quick-start-step2": "2. Import and wrap your app with AtmosFx and AtmosCard:",
    "quick-start-step3": "3. Or use Vanilla JavaScript directly:",
    "quick-start-step3-html": "Define HTML with data attributes for inner cards:",
    "quick-start-step3-js": "Initialize and start the atmosphere:",
    "quick-start-step4": "4. Vue Example:",
    "api-ref-title": "API Reference",
    "api-atmosfx-title": "AtmosFx Component Config / Props",
    "api-atmoscard-title": "AtmosCard Card Config / Props",
    "th-option": "Option",
    "th-type": "Type / Values",
    "th-desc": "Description",
    "api-vanilla-title": "Vanilla JS createAtmosphere Options",
    "api-vanilla-desc": "createAtmosphere(element, options) returns a controller with methods to start, pause, resume, and destroy the atmosphere. The options object accepts exactly the same parameters as the AtmosFx Props (excluding the mode alias).",
    "api-vanilla-data-attr-title": "Define HTML with data attributes for inner cards:",
    "api-data-opaque": "keeps an element out of automatic glass or opacity treatment.",
    "api-data-opacity": "applies a per-element opacity value.",
    "api-data-glass": "opts nested elements into the glass surface style.",
    "api-data-collision": "makes the element's top edge a precipitation collision surface.",
    "api-data-liquid-dripping": "toggles the water condensation and dripping animation (only in Rain mode).",
    "api-data-liquid-gathering-point": "sets this card's liquid gathering point from 0.33 to 0.66.",
    "methods-title": "Controller Methods",
    "methods-intro": "For direct vanilla JavaScript control, initialize the atmosphere and use the available methods:",
    "method-th-method": "Method",
    "method-th-desc": "Description",
    "api-desc-preset": "Applies preset default physical and visual values.",
    "api-desc-particle": "Overrides preset particle rendering without overwriting speed/wind presets.",
    "api-desc-density": "Controls particles per unit area. 0 disables particles; 1 uses the full quality-tier rate.",
    "api-desc-speed": "Scalar multiplier for gravity and vertical fall speed.",
    "api-desc-wind": "Affects horizontal sway and particle drift.",
    "api-desc-color": "CSS color representation for precipitation particles.",
    "api-desc-quality": "Manual tiers set particle rate; auto starts at medium and adapts to measured frame performance.",
    "api-desc-autoScaleQuality": "Enables frame-performance adaptation. When disabled, auto stays at medium and manual tiers keep the full DPR cap.",
    "api-desc-transparency": "The root integration mode for children components.",
    "api-desc-surfaceOpacity": "Global glass surface opacity base for AtmosCards.",
    "api-desc-contentOpacity": "Global opacity-mode content fade for AtmosCards.",
    "api-desc-bottomCollision": "Determines whether particles collide with the bottom edge of the container.",
    "api-desc-collisionSelector": "Query selector for discovering top-edge landing surfaces. Defaults to [data-atmos-collision].",
    "api-desc-opaqueSelector": "Query selector for elements that skip transparency blurs. Defaults to [data-atmos-opaque].",
    "api-desc-globalLiquidDripping": "Globally toggles the water condensation and dripping animation (only in Rain mode).",
    "api-desc-globalLiquidGatheringPoint": "Sets the liquid gathering point from 0.33 to 0.66. Defaults to stable-random per card.",
    "api-desc-pauseWhenHidden": "Automatically pause animation when document is hidden or the root element is out of the viewport.",
    "api-desc-respectReducedMotion": "Honors OS prefers-reduced-motion settings.",
    "api-desc-injectStyles": "Whether default stylesheet rules are automatically injected.",
    "api-desc-styleNonce": "CSP nonce for the injected style tag.",
    "api-desc-transMode": "Specifies card integration style. glass: default frosted glass effect; opacity: translucent mode; solid: default element style without transparency, fully customizable.",
    "api-desc-liquidDripping": "Toggles the water condensation and dripping animation.",
    "api-desc-liquidGatheringPoint": "Overrides this card's liquid gathering point from 0.33 to 0.66.",
    "api-desc-asChild": "Merges the AtmosCard properties directly onto the underlying child element instead of rendering a wrapper node.",
    "api-desc-opacity": "Component-level custom backdrop opacity override (specifically used in opacity mode).",
    "method-desc-start": "Initializes canvas layers, starts the requestAnimationFrame loop and rendering.",
    "method-desc-stop": "Stops the animation loop and clears canvases. Does not remove layers.",
    "method-desc-pause": "Pauses the animation execution while keeping the active frame buffer.",
    "method-desc-resume": "Resumes execution from a paused state.",
    "method-desc-resize": "Manually triggers context bounds measurement and canvas resizing.",
    "method-desc-update": "Dynamically updates atmosphere parameters on the fly without resetting state.",
    "method-desc-destroy": "Cleans up DOM nodes, listeners, context properties, and cancels loops.",
    "best-practices-title": "Design & UI Guidelines",
    "bp-intro": "To ensure visually realistic atmosphere effects, keep the following guidelines in mind when designing with AtmosCard:",
    "bp-dripping": "Particle Layering & Dripping: Particles are rendered in foreground and background layers. Foreground particles are blocked by collidable AtmosCard elements. If liquidDripping is enabled, accumulated rainwater will drip down and correctly collide with any collidable cards positioned below it.",
    "bp-blocking": "Avoid Wide Blocking Cards: A very wide collidable AtmosCard will act like an umbrella, blocking most foreground rain. This prevents rain from reaching elements below, significantly reducing their splash animations. Unless this is intended, avoid overly wide collision surfaces.",
    "bp-nesting": "Avoid Nesting Cards: Unless you have a highly specific visual effect in mind, avoid nesting an AtmosCard inside another AtmosCard. This can cause conflicting collision bounds and visual behaviors that defy natural physics.",
    "footer-text": "© 2026 Carson Ye. Built with passion and curiosity."
  },
zh: {
  "nav-brand": "atmos-fx",
  "intro-desc": "一个能感知页面结构的高性能 WebGL 氛围引擎，用于天气动画、卡片叠层与创意视觉效果。",
  "showcase-hero-eyebrow": "DOM-aware 氛围实验室",
  "showcase-hero-title": "atmos-fx",
  "showcase-hero-desc": "一个能感知页面结构的高性能 WebGL 氛围引擎，用于天气动画、卡片叠层与创意视觉效果。",
  "showcase-deck-title": "实时控制",
  "showcase-deck-density": "密度",
  "showcase-deck-wind": "风向",
  "showcase-deck-transparency": "透明度",
  "showcase-deck-particle": "粒子",
  "showcase-deck-collision": "碰撞",
  "showcase-deck-collision-val": "底部 + DOM",
  "showcase-forecast-title": "半透明叠层",
  "showcase-forecast-desc": "粒子在文字内容下方渲染，保留氛围感的同时不影响阅读。",
  "showcase-ticket-title": "碰撞物理",
  "showcase-ticket-val-rain": "溅落",
  "showcase-ticket-val-snow": "堆积",
  "showcase-ticket-val-hail": "回弹",
  "showcase-tilt-title": "风向偏移",
  "showcase-tilt-east": "向东飘移",
  "showcase-tilt-west": "向西飘移",
  "showcase-micro-1-title": "交互式玻璃卡片",
  "showcase-micro-1-desc": "生成动态背景模糊，并将卡片顶边注册为碰撞表面。",
  "showcase-micro-2-title": "不透明内容岛",
  "showcase-micro-2-desc": "不透明卡片可以遮挡降水粒子，无需额外的模糊着色器。",
  "showcase-micro-3-title": "半透明内容卡片",
  "showcase-micro-3-desc": "在文字叠层下方动态降低粒子密度，提升内容可读性。",
  "showcase-micro-4-title": "物理承载边缘",
  "showcase-micro-4-desc": "作为粒子的落点，可承接积雪，也能触发冰雹回弹。",
  "playground-title": "Playground",
  "playground-info-desc": "展示实时状态读数与配置日志，并会根据透明度和碰撞选项即时更新。",
  "form-placeholder": "输入一些内容...",
  "form-submit": "提交",
  "control-weather-preset": "天气预设",
  "control-preset-rain": "雨",
  "control-preset-snow": "雪",
  "control-preset-hail": "冰雹",
  "control-density": "密度",
  "control-speed": "速度",
  "control-wind": "风向",
  "control-snow-accum": "积雪",
  "control-hail-bounce": "冰雹回弹",
  "control-bottom-collision": "底部碰撞",
  "control-liquid-dripping": "液滴下落",
  "control-quality": "渲染质量",
  "control-quality-auto": "自动性能调节",
  "control-quality-high": "高",
  "control-quality-medium": "中",
  "control-quality-low": "低",
  "control-transparency": "透明模式",
  "control-transparency-glass": "玻璃模式（标准模糊）",
  "control-transparency-opacity": "透明度模式（半透明）",
  "control-transparency-none": "关闭透明（实体卡片）",
  "control-surface-opacity": "通透度",
  "control-content-opacity": "内容透明度",
  "control-color": "降水颜色",
  "quick-start-title": "快速开始",
  "quick-start-step1": "1. 使用 npm 安装：",
  "quick-start-step2": "2. 引入 AtmosFx 和 AtmosCard，并包裹你的应用：",
  "quick-start-step3": "3. 也可以直接使用原生 JavaScript：",
  "quick-start-step3-html": "使用 data attributes 为内部卡片定义 HTML：",
  "quick-start-step3-js": "初始化并启动引擎：",
  "quick-start-step4": "4. Vue 示例：",
  "api-ref-title": "API 参考",
  "api-atmosfx-title": "AtmosFx 组件配置 / Props",
  "api-atmoscard-title": "AtmosCard 卡片配置 / Props",
  "th-option": "配置项",
  "th-type": "类型 / 可选值",
  "th-desc": "说明",
  "api-vanilla-title": "Vanilla JS createAtmosphere Options",
  "api-vanilla-desc": "createAtmosphere(element, options) 会返回一个 controller，包含控制状态的方法。options 对象接受与 AtmosFx Props 完全相同的参数（除了 mode 别名）。",
  "api-vanilla-data-attr-title": "使用 data attributes 为内部卡片定义 HTML：",
  "api-data-opaque": "让元素跳过自动玻璃化或透明度处理。",
  "api-data-opacity": "为单个元素设置独立透明度。",
  "api-data-glass": "让嵌套元素启用玻璃表面样式。",
  "api-data-collision": "让元素顶部边缘成为降水粒子的碰撞表面。",
  "api-data-liquid-dripping": "开关水汽凝结与滴落动画（仅在 Rain 模式下生效）。",
  "api-data-liquid-gathering-point": "设置当前卡片的液体汇合点，范围为 0.33 到 0.66。",
  "methods-title": "控制器方法",
  "methods-intro": "使用原生 JavaScript 时，可以先初始化 atmosphere，再调用以下控制器方法：",
  "method-th-method": "方法",
  "method-th-desc": "说明",
  "api-desc-preset": "应用预设的默认物理和视觉效果参数。",
  "api-desc-particle": "覆盖预设的粒子渲染类型，但不影响速度和风向的预设设置。",
  "api-desc-density": "控制单位面积内的粒子数量；0 表示关闭粒子，1 表示使用当前渲染质量档位的完整密度。",
  "api-desc-speed": "重力和垂直下落速度的乘数因子。",
  "api-desc-wind": "影响粒子的水平摇摆和飘移风向。",
  "api-desc-color": "降水粒子的 CSS 颜色。",
  "api-desc-quality": "手动档位决定粒子密度；auto 从中档开始，并根据实测帧性能自动调节。",
  "api-desc-autoScaleQuality": "开关基于帧性能的自适应调节。关闭后，auto 固定为中档，手动档位保持完整 DPR 上限。",
  "api-desc-transparency": "子组件在根容器中的集成模式。",
  "api-desc-surfaceOpacity": "全局玻璃表面透明度基准值。",
  "api-desc-contentOpacity": "全局透明模式下的内容淡化程度。",
  "api-desc-bottomCollision": "决定粒子是否与容器底部边缘发生碰撞。",
  "api-desc-collisionSelector": "用于查找顶边碰撞落面的查询选择器。默认为 [data-atmos-collision]。",
  "api-desc-opaqueSelector": "用于指定不进行背景模糊处理的元素的查询选择器。默认为 [data-atmos-opaque]。",
  "api-desc-globalLiquidDripping": "全局控制水滴在卡片上冷凝、聚集并滴落的动画（仅在雨模式下有效）。",
  "api-desc-globalLiquidGatheringPoint": "设置液体汇合点，范围为 0.33 到 0.66；默认按卡片稳定随机。",
  "api-desc-pauseWhenHidden": "当 document 不可见或根元素滑出视口时自动暂停动画。",
  "api-desc-respectReducedMotion": "遵循操作系统的 prefers-reduced-motion 设置。",
  "api-desc-injectStyles": "是否自动注入默认样式规则。",
  "api-desc-styleNonce": "注入 style 标签时使用的 CSP nonce。",
  "api-desc-transMode": "指定卡片透明融合样式。glass：默认毛玻璃效果；opacity：半透明模式；solid：保持元素默认样式（无透明处理），用户可完全自定义。",
  "api-desc-liquidDripping": "控制水滴在卡片上冷凝、聚集并滴落的动画。",
  "api-desc-liquidGatheringPoint": "覆盖当前卡片的液体汇合点，范围为 0.33 到 0.66。",
  "api-desc-asChild": "将 AtmosCard 的属性直接合并到其子元素上，而不是渲染一个包装 DOM 节点。",
  "api-desc-opacity": "组件级别的自定义背景透明度覆盖（专门用于 opacity 模式）。",
  "method-desc-start": "初始化 Canvas 图层，并启动 requestAnimationFrame 渲染循环。",
  "method-desc-stop": "停止动画循环并清空 Canvas，但不移除 DOM 图层。",
  "method-desc-pause": "暂停动画执行，同时保留当前帧画面。",
  "method-desc-resume": "从暂停状态恢复动画执行。",
  "method-desc-resize": "手动触发容器边界测量与 Canvas 尺寸重置。",
  "method-desc-update": "在不重置状态的前提下，实时动态更新氛围参数。",
  "method-desc-destroy": "清理 DOM 节点、监听器、上下文属性并取消动画循环。",
  "best-practices-title": "设计与 UI 最佳实践",
  "bp-intro": "为确保最佳的视觉效果，在使用 AtmosCard 时请遵循以下指南：",
  "bp-dripping": "粒子分层与滴落：粒子分为前景和背景渲染。前景粒子会被可碰撞的 AtmosCard 阻挡。如果开启了 liquidDripping（液滴下落），积聚的雨水会向下滴落，并继续与下方任何可碰撞的卡片发生物理碰撞。",
  "bp-blocking": "避免过宽的遮挡卡片：如果设置了一个非常宽的可碰撞 AtmosCard，它会像伞一样挡住大部分前景雨水。这会导致下方的元素无法接触到雨水，其表面的雨水溅落动画会大幅减少。除非出于特定的视觉设计意图，否则尽量避免设置过宽的碰撞表面。",
  "bp-nesting": "避免卡片嵌套：除非有特意设计的视觉效果，否则尽量避免出现 AtmosCard 包裹 AtmosCard 的情况。这会导致冲突的碰撞边界与不符合自然物理常识的动画效果。",
  "footer-text": "© 2026 Carson Ye. Built with passion and curiosity."
  }
}

// ----------------------------------------------------
// 1. Showcase Stage State & Setup
// ----------------------------------------------------
interface ShowcaseState {
  preset: string
  density: number
  wind: number
  [key: string]: string | number
}

const showcaseState: ShowcaseState = {
  preset: 'rain',
  density: 0.74,
  wind: -0.22
}

const showcaseAtmosphere = createAtmosphere(showcaseRoot, {
  preset: showcaseState.preset,
  particle: showcaseState.preset,
  density: showcaseState.density,
  wind: showcaseState.wind,
  speed: 1.0,
  quality: 'high',
  bottomCollision: true,
  liquidDripping: true,
  collisionSelector: '[data-atmos-collision]',
  opaqueSelector: '[data-atmos-opaque]',
  pauseWhenHidden: true
})
showcaseAtmosphere.start()

function applyShowcase() {
  const lang = currentLang

  // Update slider labels
  const densVal = document.querySelector('#showcase-density-val') as HTMLElement
  const windVal = document.querySelector('#showcase-wind-val') as HTMLElement
  if (densVal) densVal.textContent = showcaseState.density.toFixed(2)
  if (windVal) windVal.textContent = showcaseState.wind.toFixed(2)

  // Update button active state
  document.querySelectorAll('#showcase-preset-row button').forEach(btn => {
    btn.setAttribute('aria-pressed', String((btn as HTMLElement).dataset.value === showcaseState.preset))
  })

  // Update stats deck
  const particleReadout = document.querySelector('#showcase-readout-particle') as HTMLElement
  const actionReadout = document.querySelector('#showcase-readout-action') as HTMLElement
  const driftReadout = document.querySelector('#showcase-readout-drift') as HTMLElement

  if (particleReadout) {
    const presetLabelKey = `control-preset-${showcaseState.preset}`
    particleReadout.textContent = TRANSLATIONS[lang][presetLabelKey]
  }

  if (actionReadout) {
    const actionKey = `showcase-ticket-val-${showcaseState.preset}`
    actionReadout.textContent = TRANSLATIONS[lang][actionKey]
  }

  if (driftReadout) {
    if (showcaseState.wind > 0) {
      driftReadout.textContent = TRANSLATIONS[lang]['showcase-tilt-east']
    } else {
      driftReadout.textContent = TRANSLATIONS[lang]['showcase-tilt-west']
    }
  }

  // Sync sliders value
  const dSlider = document.querySelector('#showcase-density') as HTMLInputElement
  const wSlider = document.querySelector('#showcase-wind') as HTMLInputElement
  if (dSlider) dSlider.value = String(showcaseState.density)
  if (wSlider) wSlider.value = String(showcaseState.wind)

  // Push updates to controller
  showcaseAtmosphere.update({
    preset: showcaseState.preset,
    particle: showcaseState.preset,
    density: showcaseState.density,
    wind: showcaseState.wind
  })
}

// Bind showcase event listeners
document.querySelector('#showcase-preset-row')?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button')
  if (btn) {
    showcaseState.preset = btn.dataset.value || 'rain'
    applyShowcase()
  }
})

document.querySelector('#showcase-density')?.addEventListener('input', (e) => {
  showcaseState.density = Number((e.target as HTMLInputElement).value)
  applyShowcase()
})

document.querySelector('#showcase-wind')?.addEventListener('input', (e) => {
  showcaseState.wind = Number((e.target as HTMLInputElement).value)
  applyShowcase()
})


// ----------------------------------------------------
// 2. Interactive Playground State & Setup
// ----------------------------------------------------
interface PlaygroundState {
  preset: string
  density: number
  speed: number
  wind: number
  quality: string
  transparency: string
  surfaceOpacity: number
  contentOpacity: number
  bottomCollision: boolean
  liquidDripping: boolean
  color: string
  [key: string]: string | number | boolean
}

const playgroundState: PlaygroundState = {
  preset: 'rain',
  density: 0.65,
  speed: 1.00,
  wind: -0.12,
  quality: 'high',
  transparency: 'glass',
  surfaceOpacity: 48,
  contentOpacity: 0.72,
  bottomCollision: true,
  liquidDripping: true,
  color: 'rgba(220, 235, 255, 0.72)'
}

const playgroundAtmosphere = createAtmosphere(playgroundRoot, {
  ...playgroundState,
  surfaceOpacity: 0.3 - (playgroundState.surfaceOpacity / 100) * 0.22,
  pauseWhenHidden: true
})
playgroundAtmosphere.start()
;(window as any).playgroundAtmosphere = playgroundAtmosphere


function syncSliderValue(id: string) {
  const valueElement = document.querySelector(`#${id}-val`)
  if (valueElement) {
    if (id === 'surfaceOpacity') {
      valueElement.textContent = Number(playgroundState[id]).toFixed(0) + '%'
    } else {
      valueElement.textContent = Number(playgroundState[id]).toFixed(2)
    }
  }
  const slider = document.querySelector(`#${id}`) as HTMLInputElement
  if (slider) {
    slider.value = String(playgroundState[id])
  }
}

function syncButtonGroup(controlName: string, activeVal: string) {
  const buttons = document.querySelectorAll(`[data-control="${controlName}"] button`)
  buttons.forEach(btn => {
    btn.setAttribute('aria-pressed', String((btn as HTMLElement).dataset.value === activeVal))
  })
}

function updateReactCodePreview() {
  const codeDisplay = document.querySelector('#core-code-display') as HTMLElement
  if (!codeDisplay) return

  const p = playgroundState
  const indent = '  '

  const props: string[] = []
  props.push(`preset="${p.preset}"`)
  props.push(`density={${p.density.toFixed(2)}}`)
  props.push(`speed={${p.speed.toFixed(2)}}`)
  props.push(`wind={${p.wind.toFixed(2)}}`)
  if (p.color !== 'rgba(220, 235, 255, 0.72)') {
    props.push(`color="${p.color}"`)
  }
  if (p.quality !== 'medium') {
    props.push(`quality="${p.quality}"`)
  }
  if (p.bottomCollision) {
    props.push(`bottomCollision={true}`)
  }
  if (p.transparency === 'glass') {
    const mappedAlpha = 0.3 - (p.surfaceOpacity / 100) * 0.22
    props.push(`surfaceOpacity={${mappedAlpha.toFixed(2)}}`)
  }

  const atmosFxPropsStr = props.join('\n' + indent)

  const cardOpacityProp = p.transparency === 'opacity' ? ` opacity={${p.contentOpacity.toFixed(2)}}` : ''

  const code = `<AtmosFx
  ${atmosFxPropsStr}
>
  <AtmosCard transMode="${p.transparency}"${cardOpacityProp}${p.preset === 'rain' ? ` liquidDripping={${p.liquidDripping}}` : ''}>
    <div>A high-performance DOM-aware WebGL atmosphere engine.</div>
  </AtmosCard>

  <AtmosCard transMode="${p.transparency}"${cardOpacityProp}>
    <input type="text" placeholder="Type here..." />
  </AtmosCard>
</AtmosFx>`

  codeDisplay.textContent = code
  
  if (typeof (window as any).Prism !== 'undefined') {
    (window as any).Prism.highlightElement(codeDisplay)
  }
}

function applyPlayground() {
  // Display preset conditional options
  ;(document.querySelector('#liquid-dripping-container') as HTMLElement).style.display = playgroundState.preset === 'rain' ? 'flex' : 'none'

  // Display transparency conditional options
  ;(document.querySelector('#surface-opacity-control') as HTMLElement).style.display = playgroundState.transparency === 'glass' ? 'flex' : 'none'
  ;(document.querySelector('#content-opacity-control') as HTMLElement).style.display = playgroundState.transparency === 'opacity' ? 'flex' : 'none'

  // Sync sliders
  syncSliderValue('density')
  syncSliderValue('speed')
  syncSliderValue('wind')
  syncSliderValue('surfaceOpacity')
  syncSliderValue('contentOpacity')

  // Sync checkboxes
  ;(document.querySelector('#bottomCollision') as HTMLInputElement).checked = playgroundState.bottomCollision
  ;(document.querySelector('#liquidDripping') as HTMLInputElement).checked = playgroundState.liquidDripping

  // Apply card configs and layout attributes
  const infoCard = document.querySelector('#playground-info-card') as HTMLElement
  const inputCard = document.querySelector('#playground-input-card') as HTMLElement
  const stage = document.querySelector('#playground-stage') as HTMLElement

  if (stage) {
    stage.setAttribute('data-atmos-transparency', playgroundState.transparency)
  }

  [infoCard, inputCard].forEach(card => {
    if (!card) return
    card.removeAttribute('data-atmos-glass')
    card.removeAttribute('data-atmos-opacity')
    card.removeAttribute('data-atmos-opaque')
    card.style.removeProperty('--atmos-fx-opacity')

    if (playgroundState.transparency === 'glass') {
      card.setAttribute('data-atmos-glass', '')
    } else if (playgroundState.transparency === 'opacity') {
      card.setAttribute('data-atmos-opacity', String(playgroundState.contentOpacity))
      card.style.setProperty('--atmos-fx-opacity', String(playgroundState.contentOpacity))
    } else if (playgroundState.transparency === 'none') {
      card.setAttribute('data-atmos-opaque', '')
    }

    if (playgroundState.preset === 'rain') {
      card.dataset.atmosLiquidDripping = String(playgroundState.liquidDripping)
    } else {
      delete card.dataset.atmosLiquidDripping
    }
  })

  // Sync active groups
  syncButtonGroup('preset', playgroundState.preset)
  document.querySelectorAll('#color-selector button').forEach(btn => {
    btn.setAttribute('aria-pressed', String((btn as HTMLElement).dataset.value === playgroundState.color))
  })

  // Dropdown values
  ;(document.querySelector('#quality') as HTMLSelectElement).value = playgroundState.quality
  ;(document.querySelector('#transparency') as HTMLSelectElement).value = playgroundState.transparency

  // Sync code output block
  updateReactCodePreview()

  // Push updates to controller
  playgroundAtmosphere.update({
    preset: playgroundState.preset,
    particle: playgroundState.preset,
    density: playgroundState.density,
    speed: playgroundState.speed,
    wind: playgroundState.wind,
    quality: playgroundState.quality,
    transparency: playgroundState.transparency,
    surfaceOpacity: 0.3 - (playgroundState.surfaceOpacity / 100) * 0.22,
    contentOpacity: playgroundState.contentOpacity,
    bottomCollision: playgroundState.bottomCollision,
    liquidDripping: playgroundState.liquidDripping,
    color: playgroundState.color
  })
}

// Bind sliders listeners
const sliders = ['density', 'speed', 'wind', 'surfaceOpacity', 'contentOpacity']
sliders.forEach(id => {
  document.querySelector(`#${id}`)?.addEventListener('input', (e) => {
    playgroundState[id] = Number((e.target as HTMLInputElement).value)
    applyPlayground()
  })
})

// Bind switches listeners
document.querySelector('#bottomCollision')?.addEventListener('change', (e) => {
  playgroundState.bottomCollision = (e.target as HTMLInputElement).checked
  applyPlayground()
})

document.querySelector('#liquidDripping')?.addEventListener('change', (e) => {
  playgroundState.liquidDripping = (e.target as HTMLInputElement).checked
  applyPlayground()
})

// Bind dropdowns listeners
document.querySelector('#quality')?.addEventListener('change', (e) => {
  playgroundState.quality = (e.target as HTMLSelectElement).value
  applyPlayground()
})

document.querySelector('#transparency')?.addEventListener('change', (e) => {
  playgroundState.transparency = (e.target as HTMLSelectElement).value
  applyPlayground()
})

// Bind preset button selector listener
document.querySelector('[data-control="preset"]')?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button')
  if (btn) {
    playgroundState.preset = btn.dataset.value || 'rain'
    applyPlayground()
  }
})

// Bind color preset buttons listener
document.querySelector('#color-selector')?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button')
  if (btn) {
    playgroundState.color = btn.dataset.value || 'rgba(220, 235, 255, 0.72)'
    applyPlayground()
  }
})


// ----------------------------------------------------
// 3. Bilingual Language Switching Logic
// ----------------------------------------------------
let currentLang: 'en' | 'zh' = 'en'

function setLanguage(lang: 'en' | 'zh') {
  currentLang = lang
  document.documentElement.lang = lang

  // Loop text strings
  document.querySelectorAll('[data-i18n-key]').forEach(el => {
    const key = el.getAttribute('data-i18n-key')
    if (key && TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) {
      el.textContent = TRANSLATIONS[lang][key]
    }
  })

  // Loop attributes
  document.querySelectorAll('[data-i18n-attr]').forEach(el => {
    const attrVal = el.getAttribute('data-i18n-attr')
    if (attrVal) {
      const [attrName, key] = attrVal.split(':')
      if (attrName && key && TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) {
        el.setAttribute(attrName, TRANSLATIONS[lang][key])
      }
    }
  })

  // Update dropdown checkmarks and button label
  const currentLangLabel = document.querySelector('#current-lang-label')
  if (currentLangLabel) {
    currentLangLabel.textContent = lang.toUpperCase()
  }

  document.querySelectorAll('.lang-dropdown-item').forEach(item => {
    const itemLang = item.getAttribute('data-lang')
    const checkmark = item.querySelector('.active-check') as HTMLElement
    if (checkmark) {
      checkmark.style.opacity = itemLang === lang ? '1' : '0'
    }
  })

  // Show/hide Xiaohongshu icon based on language (only for Chinese 'zh')
  const xhsLink = document.querySelector('#xhs-link') as HTMLElement
  if (xhsLink) {
    xhsLink.style.display = lang === 'zh' ? 'flex' : 'none'
  }

  // Refresh readouts
  applyShowcase()
  applyPlayground()
}

// Bind language dropdown toggle
const dropdownBtn = document.querySelector('#lang-dropdown-btn')
const dropdownMenu = document.querySelector('#lang-dropdown-menu') as HTMLElement

dropdownBtn?.addEventListener('click', (e) => {
  e.stopPropagation()
  if (dropdownMenu) {
    const isVisible = dropdownMenu.style.display === 'block'
    dropdownMenu.style.display = isVisible ? 'none' : 'block'
  }
})

// Hide dropdown when clicking outside
document.addEventListener('click', () => {
  if (dropdownMenu) {
    dropdownMenu.style.display = 'none'
  }
})

// Bind language dropdown item clicks
document.querySelectorAll('.lang-dropdown-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation()
    const selectedLang = item.getAttribute('data-lang') as 'en' | 'zh'
    if (selectedLang) {
      setLanguage(selectedLang)
    }
    if (dropdownMenu) {
      dropdownMenu.style.display = 'none'
    }
  })
})

// Initialize language based on browser preference
const browserLang = navigator.language || 'en'
const initialLang = browserLang.startsWith('zh') ? 'zh' : 'en'
setLanguage(initialLang)
