export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 55, g: 110, b: 111 }
}

export function contrastTextColor(r: number, g: number, b: number): string {
  // sRGB relative luminance
  const luminance = 0.2126 * (r / 255) ** 2.2 + 0.7152 * (g / 255) ** 2.2 + 0.0722 * (b / 255) ** 2.2
  return luminance > 0.35 ? '#1a1a1a' : '#ffffff'
}
