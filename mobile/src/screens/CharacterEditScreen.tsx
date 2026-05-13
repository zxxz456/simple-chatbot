/**
 * CharacterEditScreen.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Crea o edita un personaje en el server. Sin ``characterId`` en
 * params crea uno nuevo; con id lo carga desde la
 * ``characters-cache`` (poblada por la lista).
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
 * zxxz6       13/05/2026      Extraído Field / EditScreenHeader / sizes
 * zxxz6       13/05/2026      Migrado a HTTP (async, sin DB local)
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
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditScreenHeader } from '@/components/EditScreenHeader';
import { Field } from '@/components/Field';
import { CHARACTER_COLORS } from '@/constants/character-palette';
import { colors, radii, sizes, spacing, typography } from '@/constants/theme';
import * as api from '@/services/api';
import { useCharactersCache } from '@/store/characters-cache';
import type { RootStackScreenProps } from '@/types/navigation';
import { saveErrorMessage } from '@/utils/error';

/**
 * Plantilla sugerida para nuevos personajes. Es lo que aparece
 * como placeholder y, opcionalmente, lo que se pre-rellena al
 * tocar "Usar esta plantilla como base".
 *
 * Description:
 * ------------
 * Estructura pensada para encajar con el bloque de "Reglas
 * estrictas de roleplay" que ``useChat`` inyecta automáticamente
 * cuando hay varios personajes activos. Cada línea es una
 * dimensión común a la hora de definir un personaje útil:
 *
 *   1. Identidad — quién es y contexto básico.
 *   2. Voz — cómo habla.
 *   3. Personalidad — rasgos que dirigen sus reacciones.
 *   4. Reglas opcionales — restricciones de roleplay.
 *   5. Anclaje — siempre se mantiene en personaje.
 */
const SYSTEM_PROMPT_TEMPLATE = `Eres [Nombre], [descripción breve: edad, oficio, época, lugar].
Hablas con [estilo: formal, coloquial, arcaico, técnico…].
Personalidad: [rasgos clave: optimista pero terco, melancólico, irónico…].
[Reglas opcionales: nunca mientes, no admites ser una IA, hablas siempre en tercera persona, etc.]
Nunca rompes el personaje.`;

export function CharacterEditScreen({
  navigation,
  route,
}: RootStackScreenProps<'CharacterEdit'>): React.JSX.Element {
  const characterId = route.params?.characterId;
  const existing = useCharactersCache((s) =>
    characterId != null ? s.byId[characterId] : null,
  );
  const upsertCache = useCharactersCache((s) => s.upsert);

  const [name, setName] = useState(existing?.name ?? '');
  const [avatar, setAvatar] = useState(existing?.avatar ?? '');
  const [color, setColor] = useState(existing?.color ?? CHARACTER_COLORS[0]);
  const [systemPrompt, setSystemPrompt] = useState(
    existing?.system_prompt ?? '',
  );
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Falta el nombre', 'Dale un nombre al personaje.');
      return;
    }
    setSaving(true);
    try {
      const finalAvatar = avatar.trim() || trimmedName.charAt(0).toUpperCase();
      const payload = {
        name: trimmedName,
        avatar: finalAvatar,
        color,
        system_prompt: systemPrompt,
      };
      const saved = existing
        ? await api.updateCharacter(existing.id, payload)
        : await api.createCharacter(payload);
      upsertCache([saved]);
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        'No se pudo guardar',
        saveErrorMessage(err, 'Ya existe otro personaje con ese nombre.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const previewLetter =
    avatar.trim() || (name.trim().charAt(0).toUpperCase() || '?');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <EditScreenHeader
        title={existing ? 'Editar personaje' : 'Nuevo personaje'}
        onCancel={() => navigation.goBack()}
        onSave={onSave}
        saving={saving}
      />

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.previewWrap}>
          <View style={[styles.previewAvatar, { backgroundColor: color }]}>
            <Text style={styles.previewLetter}>{previewLetter}</Text>
          </View>
        </View>

        <Field label="Nombre">
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Sócrates"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
          />
        </Field>

        <Field label="Avatar (1-2 chars o emoji)">
          <TextInput
            style={styles.input}
            value={avatar}
            onChangeText={setAvatar}
            placeholder={previewLetter}
            placeholderTextColor={colors.muted}
            maxLength={2}
          />
        </Field>

        <Field label="Color">
          <View style={styles.swatches}>
            {CHARACTER_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setColor(c)}
                style={[
                  styles.swatch,
                  { backgroundColor: c },
                  color === c && styles.swatchSelected,
                ]}
                accessibilityLabel={`Color ${c}`}
              />
            ))}
          </View>
        </Field>

        <Field label="System prompt">
          <TextInput
            style={[styles.input, styles.multiline]}
            value={systemPrompt}
            onChangeText={setSystemPrompt}
            placeholder={SYSTEM_PROMPT_TEMPLATE}
            placeholderTextColor={colors.muted}
            multiline
          />
          {!systemPrompt ? (
            <TouchableOpacity
              style={styles.templateBtn}
              onPress={() => setSystemPrompt(SYSTEM_PROMPT_TEMPLATE)}
            >
              <Text style={styles.templateBtnLabel}>
                ✎ Usar esta plantilla como base
              </Text>
            </TouchableOpacity>
          ) : null}
        </Field>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.md, paddingBottom: spacing.xxl },
  previewWrap: { alignItems: 'center', marginBottom: spacing.lg },
  previewAvatar: {
    width: sizes.avatarLg,
    height: sizes.avatarLg,
    borderRadius: sizes.avatarLg / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLetter: {
    color: colors.onPrimary,
    fontSize: 36,
    fontWeight: '700',
  },
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
  multiline: { minHeight: 140, textAlignVertical: 'top' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: { borderColor: colors.onSurface },
  templateBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
  },
  templateBtnLabel: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
});
