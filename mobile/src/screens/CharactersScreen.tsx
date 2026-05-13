/**
 * CharactersScreen.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Lista de personajes definidos en el server. Tap edita,
 * long-press borra, FAB ``+`` crea uno nuevo.
 *
 *
 * Metadata:
 * ----------
 * - Author: zxxz6 (Bryan Violante Arriaga)
 * - Version: 0.0.3
 * - License: MIT
 *
 *
 * History:
 * ------------
 * Author      Date            Description
 * zxxz6       13/05/2026      Extraído EmptyState / FAB / sizes
 * zxxz6       13/05/2026      Migrado a HTTP (async)
 * zxxz6       13/05/2026      Creation
 *
 * @format
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { colors, radii, sizes, spacing, typography } from '@/constants/theme';
import { useCharacterList } from '@/hooks/useCharacters';
import * as api from '@/services/api';
import { useCharactersCache } from '@/store/characters-cache';
import type { Character } from '@/types/db';
import type { RootStackScreenProps } from '@/types/navigation';
import { networkErrorMessage } from '@/utils/error';

export function CharactersScreen({
  navigation,
}: RootStackScreenProps<'Characters'>): React.JSX.Element {
  const [trigger, setTrigger] = useState(0);
  const { characters, loading, error } = useCharacterList(trigger);
  const removeFromCache = useCharactersCache((s) => s.remove);

  const onLongPress = (c: Character) => {
    Alert.alert(
      c.name,
      'Borrar este personaje. Los mensajes que ya escribió en conversaciones existentes se conservarán.',
      [
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteCharacter(c.id);
              removeFromCache(c.id);
              setTrigger((n) => n + 1);
            } catch (err) {
              Alert.alert('No se pudo borrar', networkErrorMessage(err));
            }
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerIcon}
        >
          <Text style={styles.headerIconText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Personajes</Text>
        <View style={styles.headerIcon} />
      </View>

      <FlatList
        data={characters}
        keyExtractor={(c) => String(c.id)}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => setTrigger((n) => n + 1)}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.card}
            onPress={() =>
              navigation.navigate('CharacterEdit', { characterId: item.id })
            }
            onLongPress={() => onLongPress(item)}
          >
            <View style={[styles.avatar, { backgroundColor: item.color }]}>
              <Text style={styles.avatarText}>{item.avatar}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.cardPreview} numberOfLines={2}>
                {item.system_prompt || 'Sin system prompt'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.spinnerWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error ? (
            <EmptyState
              emoji="🔌"
              title="Sin conexión al server"
              body={error}
            />
          ) : (
            <EmptyState
              emoji="👥"
              title="Sin personajes aún"
              body="Crea uno con el botón “+”. Después lo podrás agregar a cualquier conversación."
            />
          )
        }
        contentContainerStyle={
          characters.length === 0 ? styles.listEmpty : styles.list
        }
      />

      <FloatingActionButton
        onPress={() => navigation.navigate('CharacterEdit', {})}
        accessibilityLabel="Nuevo personaje"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  headerIcon: {
    width: sizes.headerIcon,
    height: sizes.headerIcon,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  headerIconText: {
    fontSize: 22,
    color: colors.onSurface,
    fontWeight: '600',
  },
  title: { ...typography.title, color: colors.onSurface },
  list: { paddingHorizontal: spacing.md, paddingBottom: 100 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: sizes.avatarMd,
    height: sizes.avatarMd,
    borderRadius: sizes.avatarMd / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  cardBody: { flex: 1 },
  cardName: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardPreview: { ...typography.bodySmall, color: colors.muted },
  spinnerWrap: { alignItems: 'center', paddingHorizontal: spacing.xl },
});
