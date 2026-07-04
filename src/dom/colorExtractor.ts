export interface RGBA {
  r: number
  g: number
  b: number
  a: number
}

export interface AtmosphereGradient {
  bgStart: RGBA // Bottom color
  bgEnd: RGBA   // Top color
}

// Default weather ambient colors (dark/cloudy blue theme)
export const DEFAULT_BG_START: RGBA = { r: 15 / 255, g: 32 / 255, b: 54 / 255, a: 1.0 }
export const DEFAULT_BG_END: RGBA = { r: 40 / 255, g: 75 / 255, b: 110 / 255, a: 1.0 }

/**
 * Parses a CSS color string into a normalized RGBA object (0.0 to 1.0 range).
 * Supports hex (#rgb, #rgba, #rrggbb, #rrggbbaa) and rgb/rgba formats.
 */
export function parseColor(colorStr: string): RGBA | null {
  const s = colorStr.trim().toLowerCase()
  if (!s || s === 'transparent' || s === 'rgba(0,0,0,0)' || s === 'rgba(0, 0, 0, 0)') {
    return null
  }

  // 1. Hex parsing
  if (s.startsWith('#')) {
    const hex = s.substring(1)
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16) / 255
      const g = parseInt(hex[1] + hex[1], 16) / 255
      const b = parseInt(hex[2] + hex[2], 16) / 255
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1.0
      return { r, g, b, a }
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.substring(0, 2), 16) / 255
      const g = parseInt(hex.substring(2, 4), 16) / 255
      const b = parseInt(hex.substring(4, 6), 16) / 255
      const a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1.0
      return { r, g, b, a }
    }
  }

  // 2. RGB/RGBA parsing
  const rgbMatch = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/)
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10) / 255,
      g: parseInt(rgbMatch[2], 10) / 255,
      b: parseInt(rgbMatch[3], 10) / 255,
      a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1.0,
    }
  }

  return null
}

/**
 * Parses all CSS color stops from a gradient string.
 */
export function parseGradientColors(gradientStr: string): RGBA[] {
  const colors: RGBA[] = []
  const regex = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)|#[a-f0-9]{3,8}/gi
  let match
  while ((match = regex.exec(gradientStr)) !== null) {
    const parsed = parseColor(match[0])
    if (parsed) {
      colors.push(parsed)
    }
  }
  return colors
}

/**
 * Adjusts the brightness of a color by a scaling factor.
 */
export function adjustBrightness(color: RGBA, factor: number): RGBA {
  return {
    r: Math.min(1, Math.max(0, color.r * factor)),
    g: Math.min(1, Math.max(0, color.g * factor)),
    b: Math.min(1, Math.max(0, color.b * factor)),
    a: color.a,
  }
}

/**
 * Extracts and computes the ambient gradient colors starting from an HTML element
 * and traversing up the DOM hierarchy until a valid color/gradient is found.
 */
export function extractAtmosphereColors(
  element: HTMLElement | null,
  overrideStart?: string,
  overrideEnd?: string,
): AtmosphereGradient {
  // If user provided overrides, parse them first
  if (overrideStart || overrideEnd) {
    const start = overrideStart ? parseColor(overrideStart) : null
    const end = overrideEnd ? parseColor(overrideEnd) : null
    if (start || end) {
      const finalStart = start || DEFAULT_BG_START
      const finalEnd = end || (start ? adjustBrightness(start, 1.4) : DEFAULT_BG_END)
      return { bgStart: finalStart, bgEnd: finalEnd }
    }
  }

  let current = element
  while (current && current !== document.documentElement) {
    const style = window.getComputedStyle(current)
    if (!style) {
      current = current.parentElement
      continue
    }

    // Check linear/radial gradient in backgroundImage
    const bgImage = style.backgroundImage
    if (bgImage && bgImage !== 'none') {
      const gradientColors = parseGradientColors(bgImage)
      if (gradientColors.length >= 2) {
        // Typically gradients go top-to-bottom, so:
        // first color is top (bgEnd), last color is bottom (bgStart)
        return {
          bgStart: gradientColors[gradientColors.length - 1],
          bgEnd: gradientColors[0],
        }
      } else if (gradientColors.length === 1) {
        const base = gradientColors[0]
        return {
          bgStart: adjustBrightness(base, 0.7),
          bgEnd: adjustBrightness(base, 1.3),
        }
      }
    }

    // Check solid backgroundColor
    const bgColor = style.backgroundColor
    if (bgColor && bgColor !== 'transparent') {
      const parsed = parseColor(bgColor)
      if (parsed && parsed.a > 0.05) {
        return {
          bgStart: adjustBrightness(parsed, 0.7),
          bgEnd: adjustBrightness(parsed, 1.3),
        }
      }
    }

    current = current.parentElement
  }

  return { bgStart: DEFAULT_BG_START, bgEnd: DEFAULT_BG_END }
}
