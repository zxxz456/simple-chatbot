/**
 * CharacterPickerModal.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Modal de selección de personajes activos en la sesión actual.
 * Lista todos los personajes definidos en el server con un ✓
 * sobre los que ya están activos. Tap toglea on/off; "Gestionar"
 * salta a la pantalla de edición.
 *
 * Lógica de toggling y de fetch live en el padre (``ChatScreen``)
 * — este componente sólo presenta.
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
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { colors, sizes, spacing, typography } from '@/constants/theme';
import type { Character } from '@/types/db';

interface Props {
  visible: boolean;
  characters: Character[];
  activeIds: Set<number>;
  onClose: () => void;
  onToggle: (character: Character) => void;
  onManage: () => void;
}

export function CharacterPickerModal({
  visible,
  characters,
  activeIds,
  onClose,
  onToggle,
  onManage,
}: Props): React.JSX.Element {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.headerAction}>Cerrar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Personajes</Text>
          <TouchableOpacity onPress={onManage}>
            <Text style={styles.headerAction}>Gestionar</Text>
          </TouchableOpacity>
        </View>

        {characters.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              emoji="👥"
              title="Sin personajes definidos"
              body="Toca “Gestionar” arriba a la derecha para crear el primero."
            />
          </View>
        ) : (
          <FlatList
            data={characters}
            keyExtractor={(c) => String(c.id)}
            renderItem={({ item }) => {
              const isActive = activeIds.has(item.id);
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.row, isActive && styles.rowActive]}
                  onPress={() => onToggle(item)}
                >
                  <View
                    style={[styles.avatar, { backgroundColor: item.color }]}
                  >
                    <Text style={styles.avatarText}>{item.avatar}</Text>
                  </View>
                  <View style={styles.body}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.preview} numberOfLines={1}>
                      {item.system_prompt || 'Sin system prompt'}
                    </Text>
                  </View>
                  <Text
                    style={[styles.check, isActive && styles.checkActive]}
                  >
                    {isActive ? '✓' : ''}
                  </Text>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.list}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.title, color: colors.onSurface },
  headerAction: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  list: { paddingVertical: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowActive: { backgroundColor: colors.surfaceAlt },
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
  preview: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 2,
  },
  check: {
    fontSize: 20,
    color: 'transparent',
    width: 24,
    textAlign: 'center',
    fontWeight: '700',
  },
  checkActive: { color: colors.primary },
});
