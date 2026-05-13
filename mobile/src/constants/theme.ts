/**
 * theme.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Paleta de colores y tokens de espaciado / tipografía. La paleta
 * está inspirada en Claude (Anthropic): fondo cálido off-white,
 * texto cercano al negro pero con tono cálido, acento indigo
 * moderno. Sin colores saturados ni sombras agresivas — todo
 * minimal y respetuoso de la vista.
 *
 * Para el modo oscuro futuro, este archivo se ramifica en
 * ``theme.light.ts`` y ``theme.dark.ts``.
 *
 *
 * Metadata:
 * ----------
 * - Author: zxxz6 (Bryan Violante Arriaga)
 * - Version: 0.0.2
 * - License: MIT
 *
 *
 * History:
 * ------------
 * Author      Date            Description
 * zxxz6       21/04/2026      Rediseño Claude-inspired: warm neutrals + indigo
 * zxxz6       21/04/2026      Creation
 *
 * @format
 */

/**
 * Paleta semántica.
 *
 * Description:
 * ------------
 * - ``background``       Fondo principal de la app, off-white cálido.
 * - ``surface``          Tarjetas, inputs, header bar.
 * - ``surfaceAlt``       Fondo sutilmente teñido para distinguir
 *                        mensajes del assistant del flujo del user.
 * - ``onSurface``        Texto principal — negro cálido.
 * - ``muted``            Texto secundario, captions, hints.
 * - ``border``           Bordes sutiles entre elementos.
 * - ``primary``          Accent indigo (acciones, links, FAB).
 * - ``primaryDark``      Hover / pressed del accent.
 * - ``onPrimary``        Texto sobre fondo primary (blanco).
 * - ``userAvatar``       Fondo del avatar del usuario.
 * - ``assistantAvatar``  Fondo del avatar del assistant.
 * - ``danger``/``success``/``warning``  Estados.
 * - ``thinking``         Texto del bloque [thinking].
 */
export const colors = {
  background: '#FAF9F6',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F0EA',
  onSurface: '#1F1D1A',
  muted: '#757470',
  border: '#EAE7DE',

  primary: '#4F46E5',
  primaryDark: '#3D34C7',
  onPrimary: '#FFFFFF',

  userAvatar: '#4F46E5',
  assistantAvatar: '#1F1D1A',

  danger: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',

  thinking: '#9A968F',
} as const;

/**
 * Espaciado en múltiplos de 4 px.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/**
 * Radios de bordes.
 */
export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/**
 * Tipografía con line-height generoso (Claude-style: respiración).
 */
export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 24 },
  bodyMedium: { fontSize: 15, lineHeight: 22 },
  bodySmall: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: 'Courier' },
} as const;

/**
 * Tamaños fijos compartidos por la UI (no escalan con tipografía).
 *
 * Description:
 * ------------
 * - ``avatarLg``      Avatar grande (preview en edit screens).
 * - ``avatarMd``      Avatar de lista / modal / chip de sesión.
 * - ``avatarSm``      Avatar pequeño (sheet, picker).
 * - ``headerIcon``    Botón táctil del header (back, settings…).
 * - ``fab``           Floating Action Button.
 */
export const sizes = {
  avatarLg: 80,
  avatarMd: 40,
  avatarSm: 36,
  headerIcon: 40,
  fab: 56,
} as const;

/**
 * Sombras planas (RN no respeta sombras complejas en Android).
 */
export const elevation = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  fab: {
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;
