/**
 * character-palette.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Paleta cerrada de colores que se asignan a los avatares de
 * personajes. Limitada a 8 entradas pensadas para legibilidad
 * sobre el off-white cálido del fondo principal.
 *
 *
 * Metadata:
 * ----------
 * - Author: zxxz6 (Bryan Violante Arriaga)
 * - Version: 0.0.1
 * - License: MIT
 *
 *
 * History:
 * ------------
 * Author      Date            Description
 * zxxz6       13/05/2026      Creation
 *
 * @format
 */

export const CHARACTER_COLORS = [
  '#4F46E5', // indigo
  '#0D9488', // teal
  '#E11D48', // rose
  '#D97706', // amber
  '#059669', // emerald
  '#7C3AED', // violet
  '#0284C7', // sky
  '#C026D3', // fuchsia
] as const;

/**
 * Devuelve un color de la paleta de forma estable a partir del id
 * del personaje (módulo de la longitud de la paleta). Útil como
 * fallback cuando el personaje no tiene color explícito.
 */
export function paletteForId(id: number): string {
  return CHARACTER_COLORS[id % CHARACTER_COLORS.length];
}
