/**
 * EmptyState.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Bloque genérico "vacío" — emoji grande + título + cuerpo —
 * usado por todas las listas (sesiones, personajes, chat
 * vacío…) y por sus estados de error de red.
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
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';

interface Props {
  emoji: string;
  title: string;
  /** Cuerpo del mensaje. Puede ser string o nodos (para mezclar `<Text>` inline). */
  body?: React.ReactNode;
  /** Líneas adicionales debajo del body, cada una con el mismo estilo "muted". */
  extraLines?: string[];
  /**
   * Si ``true``, el emoji se pinta con el color primary (usado
   * por estados "neutros" como "sin conversaciones aún"). Default
   * ``false`` mantiene el color del emoji original.
   */
  primaryEmoji?: boolean;
}

export function EmptyState({
  emoji,
  title,
  body,
  extraLines,
  primaryEmoji = false,
}: Props): React.JSX.Element {
  return (
    <View style={styles.empty}>
      <Text style={[styles.emoji, primaryEmoji && styles.emojiPrimary]}>
        {emoji}
      </Text>
      <Text style={styles.title}>{title}</Text>
      {body ? (
        typeof body === 'string' ? (
          <Text style={styles.body}>{body}</Text>
        ) : (
          <View style={styles.bodyWrap}>{body}</View>
        )
      ) : null}
      {extraLines?.map((line) => (
        <Text key={line} style={styles.body}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingHorizontal: spacing.xl },
  emoji: { fontSize: 42, marginBottom: spacing.md },
  emojiPrimary: { color: colors.primary },
  title: {
    ...typography.title,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  body: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  bodyWrap: { alignItems: 'center' },
});
