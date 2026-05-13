/**
 * EditScreenHeader.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Header común de las pantallas de edición: botón "‹ Cancelar"
 * a la izquierda, título centrado, "Guardar" (o spinner) a la
 * derecha. Comparte el patrón usado por personaje / sesión /
 * ajustes.
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
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';

interface Props {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
  /**
   * Texto del botón derecho. Default ``"Guardar"``.
   */
  saveLabel?: string;
  /**
   * Texto del botón izquierdo. Default ``"‹ Cancelar"``.
   */
  cancelLabel?: string;
}

export function EditScreenHeader({
  title,
  onCancel,
  onSave,
  saving = false,
  saveLabel = 'Guardar',
  cancelLabel = '‹ Cancelar',
}: Props): React.JSX.Element {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onCancel}>
        <Text style={styles.headerAction}>{cancelLabel}</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <TouchableOpacity onPress={onSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={[styles.headerAction, styles.save]}>{saveLabel}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.title, color: colors.onSurface },
  headerAction: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  save: { fontWeight: '700' },
});
