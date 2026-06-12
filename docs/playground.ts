import { createAtmosphere } from '../src/index.ts'

const root = document.querySelector('#weather-stage') as HTMLElement
const collisionCard = document.querySelector('#collision-card') as HTMLElement
const title = document.querySelector('#forecast-title') as HTMLElement
const summary = document.querySelector('#forecast-summary') as HTMLElement
const temp = document.querySelector('#forecast-temp') as HTMLElement
const forecastPresetBadge = document.querySelector('#forecast-preset') as HTMLElement
const forecastWindText = document.querySelector('#forecast-wind') as HTMLElement
const forecastDensityText = document.querySelector('#forecast-density') as HTMLElement
const codeSample = document.querySelector('#code-sample') as HTMLElement

// Playground state (WebGL by default)
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

const state: PlaygroundState = {
  preset: 'rain',
  density: 0.65,
  speed: 1.00,
  wind: -0.12,
  quality: 'medium',
  transparency: 'glass',
  surfaceOpacity: 0.14,
  contentOpacity: 0.72,
  snowAccumulation: 0.55,
  hailBounce: 0.50,
  bottomCollision: false,
  liquidDripping: true,
  color: 'rgba(220, 235, 255, 0.72)'
}

const presetDescriptions: Record<string, { title: string; summary: string; temp: string; badge: string }> = {
  rain: {
    title: 'Rain Showers',
    summary: 'Layered rainfall tests glass readability, top-edge collision, and medium-density motion.',
    temp: '54',
    badge: 'Rain'
  },
  snow: {
    title: 'Gentle Snow',
    summary: 'Slow drifting flakes accumulate on top of card edges and fall off naturally.',
    temp: '28',
    badge: 'Snow'
  },
  hail: {
    title: 'Hail Storm',
    summary: 'Fast, heavy pellets bounce from surface edges and settle in mounds.',
    temp: '34',
    badge: 'Hail'
  }
}

// Initialize engine
const atmosphere = createAtmosphere(root, {
  ...state,
  pauseWhenHidden: false
})
atmosphere.start()

// Format to 2 decimal places
function formatNum(v: number) {
  return Number(v).toFixed(2)
}

// Sync active parameters with UI sliders
function syncSliderValue(id: string) {
  const valueElement = document.querySelector(`#${id}-val`)
  if (valueElement) {
    valueElement.textContent = formatNum(state[id] as number)
  }
  const slider = document.querySelector(`#${id}`) as HTMLInputElement
  if (slider) {
    slider.value = String(state[id])
  }
}

// Sync selected pressed state for groups of buttons
function syncButtonGroup(controlName: string, activeVal: string) {
  const buttons = document.querySelectorAll(`[data-control="${controlName}"] button`)
  buttons.forEach(btn => {
    btn.setAttribute('aria-pressed', String((btn as HTMLElement).dataset.value === activeVal))
  })
}

// Copy configuration function
function updateCodeBlock() {
  const optionsCopy: Record<string, any> = {
    preset: state.preset,
    density: state.density,
    speed: state.speed,
    wind: state.wind,
    quality: state.quality,
    transparency: state.transparency,
    surfaceOpacity: state.surfaceOpacity,
    contentOpacity: state.contentOpacity,
    bottomCollision: state.bottomCollision,
    liquidDripping: state.liquidDripping,
    color: state.color
  }

  if (state.preset === 'snow') {
    optionsCopy.snowAccumulation = state.snowAccumulation
  } else if (state.preset === 'hail') {
    optionsCopy.hailBounce = state.hailBounce
  }

  codeSample.textContent = `import { createAtmosphere } from 'atmos-fx'

const controller = createAtmosphere(
  document.querySelector('#container'),
  ${JSON.stringify(optionsCopy, null, 2)}
)

controller.start()`
}

// Apply changes to scene and labels
function apply() {
  // Update labels on card
  const cardInfo = presetDescriptions[state.preset]
  title.textContent = cardInfo.title
  summary.textContent = cardInfo.summary
  temp.textContent = cardInfo.temp
  forecastPresetBadge.textContent = cardInfo.badge
  forecastWindText.textContent = `wind ${formatNum(state.wind)}`
  forecastDensityText.textContent = `Density ${formatNum(state.density)}`

  // Display correct controls depending on preset
  ;(document.querySelector('#snow-accum-control') as HTMLElement).style.display = state.preset === 'snow' ? 'flex' : 'none'
  ;(document.querySelector('#hail-bounce-control') as HTMLElement).style.display = state.preset === 'hail' ? 'flex' : 'none'
  ;(document.querySelector('#liquid-dripping-container') as HTMLElement).style.display = state.preset === 'rain' ? 'flex' : 'none'

  // Display correct opacity sliders
  ;(document.querySelector('#surface-opacity-control') as HTMLElement).style.display = state.transparency === 'glass' ? 'flex' : 'none'
  ;(document.querySelector('#content-opacity-control') as HTMLElement).style.display = state.transparency === 'opacity' ? 'flex' : 'none'

  // Sync inputs
  syncSliderValue('density')
  syncSliderValue('speed')
  syncSliderValue('wind')
  syncSliderValue('snowAccumulation')
  syncSliderValue('hailBounce')
  syncSliderValue('surfaceOpacity')
  syncSliderValue('contentOpacity')

  // Bottom collision and liquid dripping toggles
  ;(document.querySelector('#bottomCollision') as HTMLInputElement).checked = state.bottomCollision
  ;(document.querySelector('#liquidDripping') as HTMLInputElement).checked = state.liquidDripping

  // Color and preset active buttons
  syncButtonGroup('preset', state.preset)
  document.querySelectorAll('#color-selector button').forEach(btn => {
    btn.setAttribute('aria-pressed', String((btn as HTMLElement).dataset.value === state.color))
  })

  // Dropdown options
  ;(document.querySelector('#quality') as HTMLSelectElement).value = state.quality
  ;(document.querySelector('#transparency') as HTMLSelectElement).value = state.transparency

  // Update code sample
  updateCodeBlock()

  // Push state directly to atmosphere
  atmosphere.update({
    preset: state.preset,
    particle: state.preset,
    density: state.density,
    speed: state.speed,
    wind: state.wind,
    quality: state.quality,
    transparency: state.transparency,
    surfaceOpacity: state.surfaceOpacity,
    contentOpacity: state.contentOpacity,
    snowAccumulation: state.snowAccumulation,
    hailBounce: state.hailBounce,
    bottomCollision: state.bottomCollision,
    liquidDripping: state.liquidDripping,
    color: state.color
  })
}

// Event Listeners for UI sliders
const sliders = ['density', 'speed', 'wind', 'snowAccumulation', 'hailBounce', 'surfaceOpacity', 'contentOpacity']
sliders.forEach(id => {
  const input = document.querySelector(`#${id}`)
  if (input) {
    input.addEventListener('input', (e) => {
      state[id] = Number((e.target as HTMLInputElement).value)
      apply()
    })
  }
})

// Bottom collision switch listener
document.querySelector('#bottomCollision')?.addEventListener('change', (e) => {
  state.bottomCollision = (e.target as HTMLInputElement).checked
  apply()
})

// Liquid dripping switch listener
document.querySelector('#liquidDripping')?.addEventListener('change', (e) => {
  state.liquidDripping = (e.target as HTMLInputElement).checked
  apply()
})

// Dropdown selector listeners
document.querySelector('#quality')?.addEventListener('change', (e) => {
  state.quality = (e.target as HTMLSelectElement).value
  apply()
})

document.querySelector('#transparency')?.addEventListener('change', (e) => {
  state.transparency = (e.target as HTMLSelectElement).value
  apply()
})

// Preset button listener
document.querySelector('[data-control="preset"]')?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button')
  if (btn) {
    state.preset = btn.dataset.value || 'rain'
    apply()
  }
})

// Color preset button listener
document.querySelector('#color-selector')?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button')
  if (btn) {
    state.color = btn.dataset.value || ''
    apply()
  }
})

// Copy configuration button listener
const copyBtn = document.querySelector('#copy-config-btn') as HTMLButtonElement
copyBtn?.addEventListener('click', () => {
  const codeText = codeSample.textContent || ''
  navigator.clipboard.writeText(codeText).then(() => {
    const originalText = copyBtn.innerHTML
    copyBtn.innerHTML = '<span>✅</span> Copied!'
    setTimeout(() => {
      copyBtn.innerHTML = originalText
    }, 2000)
  }).catch(err => {
    console.error('Failed to copy config: ', err)
  })
})

// Initial apply call
apply()
