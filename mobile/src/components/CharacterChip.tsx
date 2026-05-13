/**
 * CharacterChip.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Chip pill que representa un personaje. Tiene avatar circular
 * coloreado a la izquierda y el nombre a la derecha. Se usa en
 * la barra de personajes activos del ChatScreen y en el picker
 * de selección.
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
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/constants/theme';
import type { Character } from '@/types/db';

interface Props {
  character: Character;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function CharacterChip({
  character,
  selected = false,
  onPress,
  onLongPress,
}: Props): React.JSX.Element {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.chip,
        selected && {
          borderColor: character.color,
          backgroundColor: `${character.color}15`,
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: character.color }]}>
        <Text style={styles.avatarText} numberOfLines={1}>
          {character.avatar}
        </Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {character.name}
      </Text>
    </TouchableOpacity>
  );
}

const AVATAR_SIZE = 22;

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
    maxWidth: 180,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  avatarText: {
    color: colors.onPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  name: {
    ...typography.bodySmall,
    color: colors.onSurface,
    fontWeight: '500',
    flexShrink: 1,
  },
});
