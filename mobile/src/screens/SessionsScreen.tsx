/**
 * SessionsScreen.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Lista de sesiones (carga vía HTTP). Cada item es una tarjeta
 * con título + meta. Header con accesos a Personajes y Ajustes;
 * FAB inferior crea una conversación nueva (vacía — la sesión se
 * crea en el server al primer mensaje).
 *
 *
 * Metadata:
 * ----------
 * - Author: zxxz6 (Bryan Violante Arriaga)
 * - Version: 0.0.5
 * - License: MIT
 *
 *
 * History:
 * ------------
 * Author      Date            Description
 * zxxz6       13/05/2026      Extraído EmptyState / FAB / sizes / formatDate
 * zxxz6       13/05/2026      Migrado a HTTP (async, con loading state)
 * zxxz6       13/05/2026      Added link to Personajes en el header
 * zxxz6       21/04/2026      Rediseño con tarjetas + empty state
 * zxxz6       21/04/2026      Creation
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
import {
  deleteAndSync,
  useOpenSession,
  useSessionList,
} from '@/hooks/useSessions';
import { useChatStore } from '@/store/chat-store';
import { useSettingsStore } from '@/store/settings-store';
import type { ChatSession } from '@/types/db';
import type { RootStackScreenProps } from '@/types/navigation';
import { networkErrorMessage } from '@/utils/error';
import { formatDate } from '@/utils/format';

export function SessionsScreen({
  navigation,
}: RootStackScreenProps<'Sessions'>): React.JSX.Element {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { sessions, loading, error } = useSessionList(refreshTrigger);
  const openSession = useOpenSession();
  const resetChat = useChatStore((s) => s.reset);
  const systemPrompt = useSettingsStore((s) => s.systemPrompt);

  const onOpen = async (sessionId: number) => {
    const ok = await openSession(sessionId);
    if (ok) {
      navigation.push('Chat', { sessionId });
    } else {
      Alert.alert('No se pudo abrir', 'La sesión no existe en el server.');
    }
  };

  const onNew = () => {
    resetChat(systemPrompt);
    navigation.push('Chat', { sessionId: undefined });
  };

  const onLongPress = (session: ChatSession) => {
    Alert.alert(
      session.title ?? 'Sin título',
      `${session.model} · sesión #${session.id}`,
      [
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAndSync(session.id);
              setRefreshTrigger((n) => n + 1);
            } catch (err) {
              Alert.alert('No se pudo eliminar', networkErrorMessage(err));
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
        <Text style={styles.title}>Conversaciones</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Characters')}
            style={styles.headerIcon}
            accessibilityLabel="Personajes"
          >
            <Text style={styles.headerIconText}>👥</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.headerIcon}
            accessibilityLabel="Ajustes"
          >
            <Text style={styles.headerIconText}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(s) => String(s.id)}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => setRefreshTrigger((n) => n + 1)}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.card}
            onPress={() => onOpen(item.id)}
            onLongPress={() => onLongPress(item)}
          >
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title ?? 'Sin título'}
            </Text>
            <View style={styles.cardMeta}>
              <View style={styles.modelPill}>
                <Text style={styles.modelPillText} numberOfLines={1}>
                  {item.model}
                </Text>
              </View>
              <Text style={styles.cardDate}>{formatDate(item.updated_at)}</Text>
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
              extraLines={['Revisa la URL en Ajustes (icono ⚙ arriba).']}
            />
          ) : (
            <EmptyState
              emoji="✦"
              title="Sin conversaciones aún"
              body="Toca el botón “+” para empezar la primera."
              primaryEmoji
            />
          )
        }
        contentContainerStyle={
          sessions.length === 0 ? styles.listEmpty : styles.list
        }
      />

      <FloatingActionButton
        onPress={onNew}
        accessibilityLabel="Nueva conversación"
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: { ...typography.display, color: colors.onSurface },
  headerActions: { flexDirection: 'row' },
  headerIcon: {
    width: sizes.headerIcon,
    height: sizes.headerIcon,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  headerIconText: { fontSize: 22, color: colors.onSurface, fontWeight: '600' },
  list: { paddingHorizontal: spacing.md, paddingBottom: 100 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center' },
  modelPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    marginRight: spacing.sm,
    maxWidth: 180,
  },
  modelPillText: {
    ...typography.caption,
    color: colors.muted,
    fontWeight: '500',
  },
  cardDate: { ...typography.caption, color: colors.muted },
  spinnerWrap: { alignItems: 'center', paddingHorizontal: spacing.xl },
});
