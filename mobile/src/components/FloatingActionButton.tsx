/**
 * FloatingActionButton.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Botón circular flotante (FAB) usado por las pantallas de
 * lista para acciones "crear nuevo". Centraliza tamaño,
 * elevación y posición; el contenido (icono o texto) se pasa
 * como children para flexibilidad.
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
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import {
  colors,
  elevation,
  sizes,
  spacing,
} from '@/constants/theme';

interface Props {
  onPress: () => void;
  accessibilityLabel: string;
  /** Icono / glifo a renderear. Default ``"+"``. */
  icon?: string;
}

export function FloatingActionButton({
  onPress,
  accessibilityLabel,
  icon = '+',
}: Props): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.fab}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.fabIcon}>{icon}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: sizes.fab,
    height: sizes.fab,
    borderRadius: sizes.fab / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.fab,
  },
  fabIcon: {
    color: colors.onPrimary,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
});
