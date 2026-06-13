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
    "showcase-forecast-title": "Readable opacity surface",
    "showcase-forecast-desc": "Uses a translucent treatment so precipitation remains visible across content-heavy UI.",
    "showcase-ticket-title": "Impact shelf",
    "showcase-ticket-val-rain": "Splashing",
    "showcase-ticket-val-snow": "Accumulating",
    "showcase-ticket-val-hail": "Bouncing",
    "showcase-tilt-title": "Angled collision plane",
    "showcase-tilt-east": "east drift",
    "showcase-tilt-west": "west drift",
    "showcase-micro-1-title": "glass panel",
    "showcase-micro-1-desc": "blur + top-edge collision",
    "showcase-micro-2-title": "solid control",
    "showcase-micro-2-desc": "opaque island in the same storm",
    "showcase-micro-3-title": "opacity card",
    "showcase-micro-3-desc": "text fades into particles",
    "showcase-micro-4-title": "thin rail",
    "showcase-micro-4-desc": "snow and hail landing ledge",
    "playground-title": "Interactive Playground",
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
    "control-quality-auto": "Auto (Responsive)",
    "control-quality-high": "High",
    "control-quality-medium": "Medium",
    "control-quality-low": "Low",
    "control-transparency": "Transparency Mode",
    "control-transparency-glass": "Glass (Standard Blurs)",
    "control-transparency-opacity": "Opacity (Translucent)",
    "control-transparency-none": "None (Solid Cards)",
    "control-surface-opacity": "Surface Opacity",
    "control-content-opacity": "Content Opacity",
    "control-color": "Precipitation Color",
    "quick-start-title": "Quick Start",
    "quick-start-step1": "1. Install package via npm:",
    "quick-start-step2": "2. Import and wrap your app with AtmosFx and AtmosCard:",
    "api-ref-title": "API Reference",
    "api-atmosfx-title": "AtmosFx Component Config / Props",
    "api-atmoscard-title": "AtmosCard Card Config / Props",
    "th-option": "Option",
    "th-type": "Type / Values",
    "th-desc": "Description",
    "methods-title": "Controller Methods",
    "methods-intro": "For direct vanilla JavaScript control, initialize the atmosphere and use the available methods:",
    "method-th-method": "Method",
    "method-th-desc": "Description",
    "footer-text": "© 2026 Carson Ye. Built with passion and curiosity."
  },
  zh: {
    "nav-brand": "atmos-fx",
    "intro-desc": "一款面向创意界面的高性能、可感知 DOM 布局的 WebGL 天气物理渲染引擎。",
    "showcase-hero-eyebrow": "DOM 感知天气实验室",
    "showcase-hero-title": "atmos-fx",
    "showcase-hero-desc": "一款面向创意界面的高性能、可感知 DOM 布局的 WebGL 天气物理渲染引擎。",
    "showcase-deck-title": "实时调试",
    "showcase-deck-density": "密度",
    "showcase-deck-wind": "风力",
    "showcase-deck-transparency": "透明模式",
    "showcase-deck-particle": "粒子类型",
    "showcase-deck-collision": "碰撞效果",
    "showcase-deck-collision-val": "底部 + DOM 阻挡",
    "showcase-forecast-title": "高可读性半透明图层",
    "showcase-forecast-desc": "利用半透明涂层处理，使天气粒子在文字密集的内容区域依然清晰且不失阅读性。",
    "showcase-ticket-title": "阻挡搁板",
    "showcase-ticket-val-rain": "水花四溅",
    "showcase-ticket-val-snow": "积雪中",
    "showcase-ticket-val-hail": "弹力跳跃",
    "showcase-tilt-title": "倾斜碰撞斜面",
    "showcase-tilt-east": "向东飘移",
    "showcase-tilt-west": "向西飘移",
    "showcase-micro-1-title": "毛玻璃面板",
    "showcase-micro-1-desc": "模糊背景 + 顶部边缘碰撞",
    "showcase-micro-2-title": "实体控件",
    "showcase-micro-2-desc": "暴风雨中的不透明独立块",
    "showcase-micro-3-title": "半透明卡片",
    "showcase-micro-3-desc": "文字随粒子层淡入淡出",
    "showcase-micro-4-title": "细窄轨道",
    "showcase-micro-4-desc": "雪花与冰雹的落脚搁板",
    "playground-title": "在线沙盒",
    "playground-info-desc": "用于显示真实场景融合的文本区块，可完整响应右方的透明度与碰撞属性。",
    "form-placeholder": "在这里输入内容...",
    "form-submit": "提交",
    "control-weather-preset": "天气预设",
    "control-preset-rain": "下雨",
    "control-preset-snow": "飘雪",
    "control-preset-hail": "冰雹",
    "control-density": "粒子密度",
    "control-speed": "下落速度",
    "control-wind": "风力风向",
    "control-snow-accum": "积雪厚度",
    "control-hail-bounce": "冰雹弹力",
    "control-bottom-collision": "触底碰撞",
    "control-liquid-dripping": "水滴凝结滴落",
    "control-quality": "渲染画质",
    "control-quality-auto": "自动 (响应式)",
    "control-quality-high": "高画质",
    "control-quality-medium": "中画质",
    "control-quality-low": "低画质",
    "control-transparency": "透明模式",
    "control-transparency-glass": "磨砂玻璃 (高斯模糊)",
    "control-transparency-opacity": "半透明 (纯透明度)",
    "control-transparency-none": "无 (实体卡片)",
    "control-surface-opacity": "磨砂玻璃基底不透明度",
    "control-content-opacity": "文字内容不透明度",
    "control-color": "降水粒子颜色",
    "quick-start-title": "快速上手",
    "quick-start-step1": "1. 通过 npm 安装依赖包：",
    "quick-start-step2": "2. 引入组件并包裹您的应用（AtmosFx 与 AtmosCard）：",
    "api-ref-title": "API 属性参考",
    "api-atmosfx-title": "AtmosFx 容器组件参数 (Props)",
    "api-atmoscard-title": "AtmosCard 卡片组件参数 (Props)",
    "th-option": "参数名",
    "th-type": "参数类型 / 可选值",
    "th-desc": "功能描述",
    "methods-title": "控制器方法",
    "methods-intro": "对于原生 JavaScript 开发者，可以直接通过 createAtmosphere 初始化并调用以下控制器方法：",
    "method-th-method": "方法名",
    "method-th-desc": "方法描述",
    "footer-text": "© 2026 Carson Ye. 倾注激情与好奇心打造。"
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
  pauseWhenHidden: false
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
  snowAccumulation: number
  hailBounce: number
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
  surfaceOpacity: 0.14,
  contentOpacity: 0.72,
  snowAccumulation: 0.55,
  hailBounce: 0.50,
  bottomCollision: false,
  liquidDripping: true,
  color: 'rgba(220, 235, 255, 0.72)'
}

const playgroundAtmosphere = createAtmosphere(playgroundRoot, {
  ...playgroundState,
  pauseWhenHidden: false
})
playgroundAtmosphere.start()

function syncSliderValue(id: string) {
  const valueElement = document.querySelector(`#${id}-val`)
  if (valueElement) {
    valueElement.textContent = Number(playgroundState[id]).toFixed(2)
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
  if (p.preset === 'snow') {
    props.push(`snowAccumulation={${p.snowAccumulation.toFixed(2)}}`)
  } else if (p.preset === 'hail') {
    props.push(`hailBounce={${p.hailBounce.toFixed(2)}}`)
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
}

function applyPlayground() {
  // Display preset conditional options
  ;(document.querySelector('#snow-accum-control') as HTMLElement).style.display = playgroundState.preset === 'snow' ? 'flex' : 'none'
  ;(document.querySelector('#hail-bounce-control') as HTMLElement).style.display = playgroundState.preset === 'hail' ? 'flex' : 'none'
  ;(document.querySelector('#liquid-dripping-container') as HTMLElement).style.display = playgroundState.preset === 'rain' ? 'flex' : 'none'

  // Display transparency conditional options
  ;(document.querySelector('#surface-opacity-control') as HTMLElement).style.display = playgroundState.transparency === 'glass' ? 'flex' : 'none'
  ;(document.querySelector('#content-opacity-control') as HTMLElement).style.display = playgroundState.transparency === 'opacity' ? 'flex' : 'none'

  // Sync sliders
  syncSliderValue('density')
  syncSliderValue('speed')
  syncSliderValue('wind')
  syncSliderValue('snowAccumulation')
  syncSliderValue('hailBounce')
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
    surfaceOpacity: playgroundState.surfaceOpacity,
    contentOpacity: playgroundState.contentOpacity,
    snowAccumulation: playgroundState.snowAccumulation,
    hailBounce: playgroundState.hailBounce,
    bottomCollision: playgroundState.bottomCollision,
    liquidDripping: playgroundState.liquidDripping,
    color: playgroundState.color
  })
}

// Bind sliders listeners
const sliders = ['density', 'speed', 'wind', 'snowAccumulation', 'hailBounce', 'surfaceOpacity', 'contentOpacity']
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

  // Toggle button indicator
  const toggleBtn = document.querySelector('#lang-toggle') as HTMLElement
  if (toggleBtn) {
    toggleBtn.textContent = lang === 'en' ? '中' : 'EN'
  }

  // Refresh readouts
  applyShowcase()
  applyPlayground()
}

// Bind language toggle button
document.querySelector('#lang-toggle')?.addEventListener('click', () => {
  const nextLang = currentLang === 'en' ? 'zh' : 'en'
  setLanguage(nextLang)
})

// Initialize language based on browser preference
const browserLang = navigator.language || 'en'
const initialLang = browserLang.startsWith('zh') ? 'zh' : 'en'
setLanguage(initialLang)
