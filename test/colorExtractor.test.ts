import { describe, expect, it } from 'vitest'
import {
  parseColor,
  parseGradientColors,
  adjustBrightness,
  extractAtmosphereColors,
  DEFAULT_BG_START,
  DEFAULT_BG_END,
} from '../src/dom/colorExtractor'

describe('colorExtractor', () => {
  describe('parseColor', () => {
    it('parses basic hex colors', () => {
      expect(parseColor('#fff')).toEqual({ r: 1, g: 1, b: 1, a: 1 })
      expect(parseColor('#000000')).toEqual({ r: 0, g: 0, b: 0, a: 1 })
      expect(parseColor('#1a2b3c')).toEqual({
        r: 0x1a / 255,
        g: 0x2b / 255,
        b: 0x3c / 255,
        a: 1.0,
      })
    })

    it('parses hex colors with alpha', () => {
      expect(parseColor('#ffffff80')).toEqual({ r: 1, g: 1, b: 1, a: 128 / 255 })
      expect(parseColor('#f00f')).toEqual({ r: 1, g: 0, b: 0, a: 1 })
    })

    it('parses rgb and rgba colors', () => {
      expect(parseColor('rgb(255, 128, 0)')).toEqual({ r: 1, g: 128 / 255, b: 0, a: 1 })
      expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual({
        r: 10 / 255,
        g: 20 / 255,
        b: 30 / 255,
        a: 0.5,
      })
    })

    it('returns null for transparent or invalid colors', () => {
      expect(parseColor('transparent')).toBeNull()
      expect(parseColor('rgba(0,0,0,0)')).toBeNull()
      expect(parseColor('invalid-color')).toBeNull()
    })
  })

  describe('parseGradientColors', () => {
    it('extracts all color stops from linear-gradient string', () => {
      const grad = 'linear-gradient(to bottom, rgb(30, 58, 138), rgba(59, 130, 246, 0.8))'
      const colors = parseGradientColors(grad)
      expect(colors).toHaveLength(2)
      expect(colors[0]).toEqual({ r: 30 / 255, g: 58 / 255, b: 138 / 255, a: 1 })
      expect(colors[1]).toEqual({ r: 59 / 255, g: 130 / 255, b: 246 / 255, a: 0.8 })
    })
  })

  describe('adjustBrightness', () => {
    it('multiplies color channels correctly and clamps to 0-1 range', () => {
      const color = { r: 0.5, g: 0.1, b: 0.9, a: 0.8 }
      expect(adjustBrightness(color, 2)).toEqual({ r: 1.0, g: 0.2, b: 1.0, a: 0.8 })
      expect(adjustBrightness(color, 0.5)).toEqual({ r: 0.25, g: 0.05, b: 0.45, a: 0.8 })
    })
  })

  describe('extractAtmosphereColors', () => {
    it('uses overrides when provided', () => {
      const res = extractAtmosphereColors(null, '#112233', '#445566')
      expect(res.bgStart).toEqual(parseColor('#112233'))
      expect(res.bgEnd).toEqual(parseColor('#445566'))
    })

    it('falls back to default colors if no element is provided or no styles found', () => {
      const res = extractAtmosphereColors(null)
      expect(res.bgStart).toEqual(DEFAULT_BG_START)
      expect(res.bgEnd).toEqual(DEFAULT_BG_END)
    })

    it('traverses the DOM to find background-color', () => {
      const parent = document.createElement('div')
      parent.style.backgroundColor = 'rgb(10, 20, 30)'
      document.body.appendChild(parent)

      const child = document.createElement('span')
      parent.appendChild(child)

      const res = extractAtmosphereColors(child)
      expect(res.bgStart).toEqual(adjustBrightness(parseColor('rgb(10, 20, 30)')!, 0.7))
      expect(res.bgEnd).toEqual(adjustBrightness(parseColor('rgb(10, 20, 30)')!, 1.3))

      document.body.removeChild(parent)
    })

    it('traverses the DOM to find linear-gradient in background-image', () => {
      const parent = document.createElement('div')
      parent.style.backgroundImage = 'linear-gradient(rgb(100, 150, 200), rgb(50, 60, 70))'
      document.body.appendChild(parent)

      const child = document.createElement('span')
      parent.appendChild(child)

      const res = extractAtmosphereColors(child)
      // first color top (bgEnd), last color bottom (bgStart)
      expect(res.bgEnd).toEqual(parseColor('rgb(100, 150, 200)'))
      expect(res.bgStart).toEqual(parseColor('rgb(50, 60, 70)'))

      document.body.removeChild(parent)
    })
  })
})
