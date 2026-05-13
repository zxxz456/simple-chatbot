/**
 * Field.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Wrapper de etiqueta + control de formulario usado por las
 * pantallas de edición (``CharacterEditScreen``,
 * ``SessionEditScreen``, ``SettingsScreen``). Saca a un solo
 * lugar el patrón "Label encima, input/children abajo" para
 * mantener tipografía + espaciado consistentes.
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
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';

interface Props {
  label: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Field({ label, children, style }: Props): React.JSX.Element {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md },
  label: {
    ...typography.bodySmall,
    color: colors.muted,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
});
