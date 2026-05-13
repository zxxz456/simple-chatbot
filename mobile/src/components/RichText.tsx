/**
 * RichText.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Renderer minimal de Markdown inline para los mensajes del chat.
 * Soporta anidamiento básico:
 *
 *   * ``**text**`` y ``__text__``    → negrita
 *   * ``*text*`` y ``_text_``        → itálica
 *   * `` `text` ``                   → monoespaciada con fondo
 *   * ``~~text~~``                   → tachado
 *
 * No usa librerías externas — recursión sobre regex con prioridad
 * (negrita antes que itálica para que ``**`` no se confunda con
 * ``*``). Las líneas en blanco y los ``\n`` se preservan tal cual.
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

import React from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

import { colors, typography } from '@/constants/theme';

interface Rule {
  /** Regex con un grupo de captura para el contenido interior. */
  pattern: RegExp;
  /** Estilo aplicado al fragmento matcheado. */
  style: TextStyle;
}

/**
 * Reglas en orden de prioridad: las más "fuertes" primero para
 * evitar que ``*`` matchee dentro de ``**``.
 */
const RULES: Rule[] = [
  { pattern: /\*\*([\s\S]+?)\*\*/, style: { fontWeight: '700' } },
  { pattern: /__([\s\S]+?)__/, style: { fontWeight: '700' } },
  { pattern: /~~([\s\S]+?)~~/, style: { textDecorationLine: 'line-through' } },
  { pattern: /`([^`\n]+?)`/, style: styleCode() },
  { pattern: /\*([^*\n]+?)\*/, style: { fontStyle: 'italic' } },
  { pattern: /_([^_\n]+?)_/, style: { fontStyle: 'italic' } },
];

function styleCode(): TextStyle {
  return {
    ...typography.mono,
    backgroundColor: colors.surfaceAlt,
    fontSize: 14,
  };
}

/**
 * Recorre las reglas, aplica la primera que matchee y recurse en
 * los pedazos. La profundidad está acotada como seguridad ante
 * patrones patológicos.
 */
function renderInline(text: string, depth = 0, keyPrefix = ''): React.ReactNode[] {
  if (!text) {
    return [];
  }
  if (depth > 6) {
    return [text];
  }
  for (let i = 0; i < RULES.length; i += 1) {
    const rule = RULES[i];
    const match = rule.pattern.exec(text);
    if (match && match[1].length > 0) {
      const before = text.slice(0, match.index);
      const inner = match[1];
      const after = text.slice(match.index + match[0].length);
      const k = `${keyPrefix}-${depth}-${i}-${match.index}`;
      return [
        ...renderInline(before, depth + 1, `${k}-b`),
        <Text key={k} style={rule.style}>
          {renderInline(inner, depth + 1, `${k}-i`)}
        </Text>,
        ...renderInline(after, depth + 1, `${k}-a`),
      ];
    }
  }
  return [text];
}

interface Props {
  text: string;
  /** Estilo base de la rama raíz (color, tamaño, lineHeight). */
  style?: TextStyle;
  selectable?: boolean;
}

export function RichText({
  text,
  style,
  selectable = false,
}: Props): React.JSX.Element {
  return (
    <Text style={[styles.base, style]} selectable={selectable}>
      {renderInline(text)}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { color: colors.onSurface },
});
