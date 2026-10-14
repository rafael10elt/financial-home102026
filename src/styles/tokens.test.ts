import { describe, expect, it } from 'vitest'

/**
 * Contraste dos tokens de cor (espelham src/styles/index.css).
 * Exigência: AA (4.5:1) para texto normal em ambos os temas.
 * Se um token mudar no CSS, atualize aqui — o teste quebra de propósito.
 */

const TOKENS = {
  light: {
    background: '#f6f7f9',
    foreground: '#0f172a',
    card: '#ffffff',
    cardForeground: '#0f172a',
    muted: '#eef1f5',
    mutedForeground: '#5b6472',
    primary: '#1d4ed8',
    primaryForeground: '#ffffff',
    destructive: '#b91c1c',
  },
  dark: {
    background: '#0b1120',
    foreground: '#e6eaf2',
    card: '#131a2b',
    cardForeground: '#e6eaf2',
    muted: '#1b2437',
    mutedForeground: '#9aa5b8',
    primary: '#60a5fa',
    primaryForeground: '#0b1120',
    destructive: '#f87171',
  },
} as const

function luminance(hex: string): number {
  const rgb = [1, 3, 5].map((i) => {
    const channel = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (rgb[0] ?? 0) + 0.7152 * (rgb[1] ?? 0) + 0.0722 * (rgb[2] ?? 0)
}

function contrast(a: string, b: string): number {
  const l1 = luminance(a)
  const l2 = luminance(b)
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1]
  return (lighter + 0.05) / (darker + 0.05)
}

describe('contraste dos tokens', () => {
  for (const theme of ['light', 'dark'] as const) {
    const tokens = TOKENS[theme]
    it(`texto sobre fundo (${theme})`, () => {
      expect(contrast(tokens.foreground, tokens.background)).toBeGreaterThanOrEqual(4.5)
    })
    it(`texto sobre cartão (${theme})`, () => {
      expect(contrast(tokens.cardForeground, tokens.card)).toBeGreaterThanOrEqual(4.5)
    })
    it(`texto secundário (${theme})`, () => {
      expect(contrast(tokens.mutedForeground, tokens.muted)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(tokens.mutedForeground, tokens.background)).toBeGreaterThanOrEqual(4.5)
    })
    it(`botão primário (${theme})`, () => {
      expect(contrast(tokens.primaryForeground, tokens.primary)).toBeGreaterThanOrEqual(4.5)
    })
    it(`texto destrutivo sobre cartão (${theme})`, () => {
      expect(contrast(tokens.destructive, tokens.card)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
