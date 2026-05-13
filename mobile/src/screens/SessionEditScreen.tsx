/**
 * SessionEditScreen.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Editor del título y la escena de la sesión activa. Persiste al
 * server vía ``PATCH /sessions/{id}``. Si la sesión todavía no
 * existe (chat nuevo), los valores se guardan sólo en el
 * ``chat-store`` y se persisten al mandar el primer mensaje.
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
 * zxxz6       13/05/2026      Extraído Field / EditScreenHeader
 * zxxz6       13/05/2026      Migrado a HTTP (api.patchSession)
 * zxxz6       13/05/2026      Creation
 *
 * @format
 */

import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditScreenHeader } from '@/components/EditScreenHeader';
import { Field } from '@/components/Field';
import { colors, radii, spacing, typography } from '@/constants/theme';
import * as api from '@/services/api';
import { useChatStore } from '@/store/chat-store';
import type { RootStackScreenProps } from '@/types/navigation';
import { saveErrorMessage } from '@/utils/error';

export function SessionEditScreen({
  navigation,
}: RootStackScreenProps<'SessionEdit'>): React.JSX.Element {
  const sessionId = useChatStore((s) => s.sessionId);
  const storeTitle = useChatStore((s) => s.title);
  const storeScene = useChatStore((s) => s.scene);
  const setStoreTitle = useChatStore((s) => s.setTitle);
  const setStoreScene = useChatStore((s) => s.setScene);

  const [title, setTitle] = useState(storeTitle ?? '');
  const [scene, setScene] = useState(storeScene);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const trimmedTitle = title.trim();
    const trimmedScene = scene;

    if (sessionId === null) {
      setStoreTitle(trimmedTitle || null);
      setStoreScene(trimmedScene);
      navigation.goBack();
      return;
    }

    setSaving(true);
    try {
      const patch: { title?: string; scene?: string } = {};
      if (trimmedTitle && trimmedTitle !== storeTitle) {
        patch.title = trimmedTitle;
      } else if (!trimmedTitle && storeTitle !== null) {
        Alert.alert(
          'No se puede borrar el título',
          'Una vez puesto, el título no se puede dejar vacío.',
        );
        setSaving(false);
        return;
      }
      if (trimmedScene !== storeScene) {
        patch.scene = trimmedScene;
      }
      if (Object.keys(patch).length > 0) {
        const updated = await api.patchSession(sessionId, patch);
        setStoreTitle(updated.title);
        setStoreScene(updated.scene);
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        'No se pudo guardar',
        saveErrorMessage(err, 'Ya existe otra conversación con ese título.'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <EditScreenHeader
        title="Conversación"
        onCancel={() => navigation.goBack()}
        onSave={onSave}
        saving={saving}
      />

      <ScrollView contentContainerStyle={styles.body}>
        <Field label="Título" style={styles.fieldLg}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Sin título"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.hint}>Los títulos son únicos en toda la app.</Text>
        </Field>

        <Field label="Escena / contexto" style={styles.fieldLg}>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={scene}
            onChangeText={setScene}
            placeholder="Una taberna medieval al atardecer. Los personajes acaban de llegar de un viaje largo…"
            placeholderTextColor={colors.muted}
            multiline
          />
          <Text style={styles.hint}>
            Texto libre que se inyecta como contexto en el system prompt
            de cada hablante en cada turno.
          </Text>
        </Field>

        {sessionId === null ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Esta conversación todavía no se ha guardado. Los cambios
              se aplicarán cuando mandes el primer mensaje.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.md, paddingBottom: spacing.xxl },
  fieldLg: { marginBottom: spacing.lg },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.onSurface,
  },
  multiline: { minHeight: 160, textAlignVertical: 'top' },
  hint: {
    ...typography.caption,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  banner: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerText: { ...typography.bodySmall, color: colors.muted },
});
