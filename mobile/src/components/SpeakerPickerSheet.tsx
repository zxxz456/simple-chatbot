/**
 * SpeakerPickerSheet.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Bottom-sheet modal que aparece al mandar (o long-press del
 * botón send) cuando hay personajes activos. Permite elegir si
 * responden "todos en secuencia" o un personaje concreto en
 * este turno.
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
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { colors, radii, sizes, spacing, typography } from '@/constants/theme';
import type { Character } from '@/types/db';

interface Props {
  visible: boolean;
  characters: Character[];
  onClose: () => void;
  onPickAll: () => void;
  onPickOne: (characterId: number) => void;
}

export function SpeakerPickerSheet({
  visible,
  characters,
  onClose,
  onPickAll,
  onPickOne,
}: Props): React.JSX.Element {
  const count = characters.length;
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        style={styles.backdrop}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.sheet}
          onPress={() => {}}
        >
          <Text style={styles.title}>¿Quién responde?</Text>

          <TouchableOpacity style={styles.row} onPress={onPickAll}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.assistantAvatar },
              ]}
            >
              <Text style={styles.avatarText}>👥</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.name}>Todos en secuencia</Text>
              <Text style={styles.hint}>
                {count} personaje{count === 1 ? '' : 's'} activo
                {count === 1 ? '' : 's'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {characters.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.row}
              onPress={() => onPickOne(c.id)}
            >
              <View style={[styles.avatar, { backgroundColor: c.color }]}>
                <Text style={styles.avatarText}>{c.avatar}</Text>
              </View>
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={styles.hint} numberOfLines={1}>
                  {c.system_prompt || 'Sin system prompt'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelLabel}>Cancelar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.title,
    color: colors.onSurface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  avatar: {
    width: sizes.avatarSm,
    height: sizes.avatarSm,
    borderRadius: sizes.avatarSm / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  body: { flex: 1 },
  name: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  cancel: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
  cancelLabel: {
    ...typography.body,
    color: colors.onSurface,
    fontWeight: '600',
  },
});
