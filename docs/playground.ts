import { createAtmosphere } from '../src/index.ts'
import {
  LANGUAGE_SHORT_LABELS,
  resolveLanguage,
  TRANSLATIONS,
  type Language,
} from './locales'

const showcaseRoot = document.querySelector('#showcase-stage') as HTMLElement
const playgroundRoot = document.querySelector('#playground-stage') as HTMLElement
const PLAYGROUND_INFO_COPY_KEY = 'playground-info-copy'
const SHOWCASE_VIDEO_PLAYBACK_RATE = 0.8

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
  density: showcaseState.density,
  wind: showcaseState.wind,
  speed: 1.0,
  quality: 'high',
  bottomCollision: true,
  liquidDripping: true,
  pauseWhenHidden: true
})
showcaseAtmosphere.start()
;(window as any).showcaseAtmosphere = showcaseAtmosphere

const showcaseVideo = document.querySelector('.showcase-video') as HTMLVideoElement | null
if (showcaseVideo) {
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

  const handleMotionPreference = () => {
    if (motionQuery.matches) {
      showcaseVideo.pause()
    } else {
      showcaseVideo.play().catch(() => {
        // Handle autoplay policy restriction gracefully
      })
    }
  }

  handleMotionPreference()

  try {
    motionQuery.addEventListener('change', handleMotionPreference)
  } catch (e) {
    // Support older browsers
    motionQuery.addListener(handleMotionPreference)
  }

  showcaseVideo.playbackRate = SHOWCASE_VIDEO_PLAYBACK_RATE
  showcaseVideo.addEventListener('loadedmetadata', () => {
    showcaseVideo.playbackRate = SHOWCASE_VIDEO_PLAYBACK_RATE
  })
}

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

  if (particleReadout) {
    const presetLabelKey = `control-preset-${showcaseState.preset}`
    particleReadout.textContent = TRANSLATIONS[lang][presetLabelKey]
  }

  // Sync sliders value
  const dSlider = document.querySelector('#showcase-density') as HTMLInputElement
  const wSlider = document.querySelector('#showcase-wind') as HTMLInputElement
  if (dSlider) dSlider.value = String(showcaseState.density)
  if (wSlider) wSlider.value = String(showcaseState.wind)

  // Push updates to controller
  showcaseAtmosphere.update({
    preset: showcaseState.preset,
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
  surfaceMode: string
  alpha: number
  opacity: number
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
  quality: 'auto',
  surfaceMode: 'glass',
  alpha: 0.12,
  opacity: 0.1,
  bottomCollision: true,
  liquidDripping: true,
  color: 'rgba(220, 235, 255, 0.72)'
}

const playgroundAtmosphere = createAtmosphere(playgroundRoot, {
  preset: playgroundState.preset,
  density: playgroundState.density,
  speed: playgroundState.speed,
  wind: playgroundState.wind,
  quality: playgroundState.quality,
  alpha: playgroundState.alpha,
  opacity: playgroundState.opacity,
  bottomCollision: playgroundState.bottomCollision,
  liquidDripping: playgroundState.liquidDripping,
  color: playgroundState.color,
  pauseWhenHidden: true
})
playgroundAtmosphere.start()
;(window as any).playgroundAtmosphere = playgroundAtmosphere


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
  if (p.surfaceMode === 'glass') {
    props.push(`alpha={${p.alpha.toFixed(2)}}`)
  }

  const atmosFxPropsStr = props.join('\n' + indent)

  const cardOpacityProp = p.surfaceMode === 'opacity' ? ` opacity={${p.opacity.toFixed(2)}}` : ''
  const playgroundInfoCopy = TRANSLATIONS[currentLang][PLAYGROUND_INFO_COPY_KEY]

  const code = `<AtmosFx
  ${atmosFxPropsStr}
>
  <AtmosCard transMode="${p.surfaceMode}"${cardOpacityProp}${p.preset === 'rain' ? ` liquidDripping={${p.liquidDripping}}` : ''}>
    <div>${playgroundInfoCopy}</div>
  </AtmosCard>

  <AtmosCard transMode="${p.surfaceMode}"${cardOpacityProp}>
    <input type="text" placeholder="Type here..." />
  </AtmosCard>
</AtmosFx>`

  codeDisplay.textContent = code
  
  if (typeof (window as any).Prism !== 'undefined') {
    (window as any).Prism.highlightElement(codeDisplay)
  }
}

function applyPlayground() {
  const infoCopy = document.querySelector('#playground-info-copy') as HTMLElement | null
  if (infoCopy) {
    infoCopy.textContent = TRANSLATIONS[currentLang][PLAYGROUND_INFO_COPY_KEY]
  }

  // Display preset conditional options
  ;(document.querySelector('#liquid-dripping-container') as HTMLElement).style.display = playgroundState.preset === 'rain' ? 'flex' : 'none'

  // Display transparency conditional options
  ;(document.querySelector('#surface-opacity-control') as HTMLElement).style.display = playgroundState.surfaceMode === 'glass' ? 'flex' : 'none'
  ;(document.querySelector('#content-opacity-control') as HTMLElement).style.display = playgroundState.surfaceMode === 'opacity' ? 'flex' : 'none'

  // Sync sliders
  syncSliderValue('density')
  syncSliderValue('speed')
  syncSliderValue('wind')
  syncSliderValue('alpha')
  syncSliderValue('opacity')

  // Sync checkboxes
  ;(document.querySelector('#bottomCollision') as HTMLInputElement).checked = playgroundState.bottomCollision
  ;(document.querySelector('#liquidDripping') as HTMLInputElement).checked = playgroundState.liquidDripping

  // Apply card configs and layout attributes
  const infoCard = document.querySelector('#playground-info-card') as HTMLElement
  const inputCard = document.querySelector('#playground-input-card') as HTMLElement
  [infoCard, inputCard].forEach(card => {
    if (!card) return
    card.removeAttribute('data-atmos-glass')
    card.removeAttribute('data-atmos-opacity')
    card.removeAttribute('data-atmos-solid')
    card.style.removeProperty('--atmos-fx-opacity')

    if (playgroundState.surfaceMode === 'glass') {
      card.setAttribute('data-atmos-glass', '')
    } else if (playgroundState.surfaceMode === 'opacity') {
      card.setAttribute('data-atmos-opacity', String(playgroundState.opacity))
      card.style.setProperty('--atmos-fx-opacity', String(playgroundState.opacity))
    } else if (playgroundState.surfaceMode === 'none') {
      card.setAttribute('data-atmos-solid', '')
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
  ;(document.querySelector('#transparency') as HTMLSelectElement).value = playgroundState.surfaceMode

  // Sync code output block
  updateReactCodePreview()

  // Push updates to controller
  playgroundAtmosphere.update({
    preset: playgroundState.preset,
    density: playgroundState.density,
    speed: playgroundState.speed,
    wind: playgroundState.wind,
    quality: playgroundState.quality,
    alpha: playgroundState.alpha,
    opacity: playgroundState.opacity,
    bottomCollision: playgroundState.bottomCollision,
    liquidDripping: playgroundState.liquidDripping,
    color: playgroundState.color
  })
}

// Bind sliders listeners
const sliders = ['density', 'speed', 'wind', 'alpha', 'opacity']
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
  playgroundState.surfaceMode = (e.target as HTMLSelectElement).value
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
// 3. Language Switching Logic
// ----------------------------------------------------
let currentLang: Language = 'en'

function setLanguage(lang: Language) {
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
    currentLangLabel.textContent = LANGUAGE_SHORT_LABELS[lang]
  }

  document.querySelectorAll('.lang-dropdown-item').forEach(item => {
    const itemLang = item.getAttribute('data-lang')
    const checkmark = item.querySelector('.active-check') as HTMLElement
    if (checkmark) {
      checkmark.style.opacity = itemLang === lang ? '1' : '0'
    }
  })

  // Show/hide Xiaohongshu icon based on language (only for Simplified Chinese)
  const xhsLink = document.querySelector('#xhs-link') as HTMLElement
  if (xhsLink) {
    xhsLink.style.display = lang === 'zh-CN' ? 'flex' : 'none'
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
    const selectedLang = item.getAttribute('data-lang') as Language
    if (selectedLang) {
      setLanguage(selectedLang)
    }
    if (dropdownMenu) {
      dropdownMenu.style.display = 'none'
    }
  })
})

// Initialize language based on browser preference
setLanguage(resolveLanguage(navigator.language || 'en'))

// Bind micro-card slider updates (Brightness, Volume, Haptic)
const microSliders = ['brightness', 'volume', 'haptic']
microSliders.forEach(id => {
  const slider = document.querySelector(`#micro-range-${id}`) as HTMLInputElement
  const valueLabel = document.querySelector(`#micro-val-${id}`) as HTMLElement
  if (slider && valueLabel) {
    slider.addEventListener('input', () => {
      valueLabel.textContent = `${slider.value}%`
    })
  }
})

// Bind grid button toggles (Wi-Fi, Bluetooth, AirDrop, DND)
const gridButtons = ['wifi', 'bluetooth', 'airdrop', 'dnd']
gridButtons.forEach(id => {
  const btn = document.querySelector(`#btn-${id}`)
  if (btn) {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active')
    })
  }
})
