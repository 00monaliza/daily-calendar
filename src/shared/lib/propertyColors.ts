export const PROPERTY_COLOR_PALETTE = [
  '#376E6F', // teal (existing brand color)
  '#E67E22', // orange
  '#8E44AD', // purple
  '#2980B9', // blue
  '#27AE60', // green
  '#E74C3C', // red
  '#16A085', // dark teal
  '#D35400', // dark orange
  '#2C3E50', // dark navy
  '#F39C12', // yellow-orange
]

/** djb2 hash of a string → integer */
function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0 // keep unsigned 32-bit
  }
  return hash
}

/**
 * Returns a deterministic color from PROPERTY_COLOR_PALETTE based on the
 * property's UUID. Same id always returns the same color.
 */
export function derivePropertyColor(id: string): string {
  return PROPERTY_COLOR_PALETTE[hashString(id) % PROPERTY_COLOR_PALETTE.length]
}

/**
 * Returns the effective display color for a property:
 * - If color has been customized (not the DB default '#376E6F'), use it.
 * - Otherwise derive a unique color from the property's id.
 *
 * This handles properties created by import_nasutki.js that were assigned
 * the DB-default color and therefore all look the same.
 */
export function getPropertyColor(property: { id: string; color: string }): string {
  return property.color !== '#376E6F' ? property.color : derivePropertyColor(property.id)
}
