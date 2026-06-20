export const FORMAT_COLORS_KEY = 'format_colors'

export const FORMAT_COLORS_DEFAULT = {
  tapis:   { header: '#15803d', light: '#f0fdf4', border: '#bbf7d0', label: 'Tapis',   emoji: '🟩' },
  terreau: { header: '#44403c', light: '#fafaf9', border: '#e7e5e4', label: 'Terreau', emoji: '🟫' },
  godets:  { header: '#c2410c', light: '#fff7ed', border: '#fed7aa', label: 'Godets',  emoji: '🟧' },
}

export type FormatKey = keyof typeof FORMAT_COLORS_DEFAULT
export type FormatColors = typeof FORMAT_COLORS_DEFAULT

export function loadFormatColors(): FormatColors {
  if (typeof window === 'undefined') return FORMAT_COLORS_DEFAULT
  try {
    const s = localStorage.getItem(FORMAT_COLORS_KEY)
    if (s) {
      const parsed = JSON.parse(s)
      return {
        tapis:   { ...FORMAT_COLORS_DEFAULT.tapis,   ...parsed.tapis },
        terreau: { ...FORMAT_COLORS_DEFAULT.terreau, ...parsed.terreau },
        godets:  { ...FORMAT_COLORS_DEFAULT.godets,  ...parsed.godets },
      }
    }
  } catch { /* */ }
  return FORMAT_COLORS_DEFAULT
}

export function saveFormatColors(colors: FormatColors) {
  localStorage.setItem(FORMAT_COLORS_KEY, JSON.stringify(colors))
  window.dispatchEvent(new Event('format-colors-changed'))
}

export function colFormatKey(colKey: string): FormatKey | null {
  if (colKey.includes('tapis'))  return 'tapis'
  if (colKey.includes('godet'))  return 'godets'
  if (colKey.includes('caisse')) return 'terreau'
  return null
}
