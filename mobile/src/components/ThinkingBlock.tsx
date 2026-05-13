/**
 * ThinkingBlock.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Bloque colapsable que muestra el razonamiento (``thinking``)
 * emitido por modelos con reasoning tokens. Diseño mínimo: una
 * fila tap-eable con un caret y la etiqueta; expandido muestra el
 * texto en gris cursiva con un borde lateral izquierdo (estilo
 * blockquote).
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
 * zxxz6       21/04/2026      Rediseño minimal (sin borde dashed)
 * zxxz6       21/04/2026      Creation
 *
 * @format
 */

import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';

interface Props {
  text: string;
}

export function ThinkingBlock({ text }: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={() => setExpanded((v) => !v)}
        style={styles.header}
      >
        <Text style={styles.caret}>{expanded ? '▾' : '▸'}</Text>
        <Text style={styles.label}>Razonamiento</Text>
      </TouchableOpacity>
      {expanded ? (
        <View style={styles.body}>
          <Text style={styles.bodyText} selectable>
            {text.trim()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  caret: {
    ...typography.bodySmall,
    color: colors.thinking,
    marginRight: spacing.xs,
    width: 12,
  },
  label: {
    ...typography.bodySmall,
    color: colors.thinking,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  body: {
    marginTop: spacing.xs,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  bodyText: {
    ...typography.bodySmall,
    color: colors.thinking,
    fontStyle: 'italic',
  },
});
