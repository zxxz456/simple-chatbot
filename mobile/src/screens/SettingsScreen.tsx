/**
 * SettingsScreen.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Edita las preferencias persistidas en ``settings-store``: URL
 * del servidor Ollama, modelo por defecto, system prompt,
 * temperatura, max tokens, num_ctx y think mode.
 *
 * El modelo se elige idealmente desde la lista que devuelve
 * ``listModels()`` contra el host configurado — botón "Detectar
 * modelos" hace el fetch y pinta los nombres como chips
 * tap-eables. El TextInput sigue disponible como fallback (entrar
 * a mano un modelo que no esté instalado todavía).
 *
 *
 * Metadata:
 * ----------
 * - Author: zxxz6 (Bryan Violante Arriaga)
 * - Version: 0.0.2
 * - License: MIT
 *
 *
 * History:
 * ------------
 * Author      Date            Description
 * zxxz6       13/05/2026      Extraído Field / EditScreenHeader
 * zxxz6       21/04/2026      Agregado picker de modelos via listModels()
 * zxxz6       21/04/2026      Creation
 *
 * @format
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditScreenHeader } from '@/components/EditScreenHeader';
import { Field } from '@/components/Field';
import { colors, radii, spacing, typography } from '@/constants/theme';
import { listModels } from '@/services/ollama';
import { useSettingsStore } from '@/store/settings-store';
import type { RootStackScreenProps } from '@/types/navigation';
import { errorMessage } from '@/utils/error';

export function SettingsScreen({
  navigation,
}: RootStackScreenProps<'Settings'>): React.JSX.Element {
  const settings = useSettingsStore();
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [apiUrl, setApiUrl] = useState(settings.apiUrl);
  const [model, setModel] = useState(settings.model);
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt);
  const [temperature, setTemperature] = useState(String(settings.temperature));
  const [maxTokens, setMaxTokens] = useState(String(settings.maxTokens));
  const [numCtx, setNumCtx] = useState(
    settings.numCtx === null ? '' : String(settings.numCtx),
  );
  const [think, setThink] = useState(settings.think === true);

  const [availableModels, setAvailableModels] = useState<string[] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  const onDetect = async () => {
    setDetecting(true);
    setDetectError(null);
    try {
      const names = await listModels(baseUrl.trim());
      setAvailableModels(names);
      if (names.length > 0 && !names.includes(model)) {
        // Si el modelo guardado no existe en el host actual, lo
        // ajustamos al primero disponible — más útil que dejarlo
        // apuntando a un modelo ausente.
        setModel(names[0]);
      }
    } catch (err) {
      setDetectError(errorMessage(err));
      setAvailableModels(null);
    } finally {
      setDetecting(false);
    }
  };

  const onSave = async () => {
    await settings.setBaseUrl(baseUrl.trim());
    await settings.setApiUrl(apiUrl.trim());
    await settings.setModel(model.trim());
    await settings.setSystemPrompt(systemPrompt);
    const t = parseFloat(temperature);
    if (Number.isFinite(t)) {
      await settings.setTemperature(t);
    }
    const m = parseInt(maxTokens, 10);
    if (Number.isFinite(m)) {
      await settings.setMaxTokens(m);
    }
    if (numCtx.trim() === '') {
      await settings.setNumCtx(null);
    } else {
      const n = parseInt(numCtx, 10);
      if (Number.isFinite(n)) {
        await settings.setNumCtx(n);
      }
    }
    await settings.setThink(think);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <EditScreenHeader
        title="Ajustes"
        onCancel={() => navigation.goBack()}
        onSave={onSave}
      />

      <ScrollView contentContainerStyle={styles.body}>
        <Field label="URL de Ollama">
          <TextInput
            style={styles.input}
            value={baseUrl}
            onChangeText={setBaseUrl}
            placeholder="http://192.168.1.x:11434"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={styles.hint}>
            En dispositivo físico usa la IP LAN de la PC. Arranca
            Ollama con{' '}
            <Text style={styles.mono}>OLLAMA_HOST=0.0.0.0:11434</Text>{' '}
            para que escuche.
          </Text>
        </Field>

        <Field label="URL del server libre-chat">
          <TextInput
            style={styles.input}
            value={apiUrl}
            onChangeText={setApiUrl}
            placeholder="http://192.168.1.x:8765"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={styles.hint}>
            Donde corre <Text style={styles.mono}>libre-chat-server</Text>{' '}
            en la PC (puerto 8765). Toda la persistencia
            (sesiones, mensajes, personajes) vive ahí.
          </Text>
        </Field>

        <Field label="Modelo">
          <TextInput
            style={styles.input}
            value={model}
            onChangeText={setModel}
            placeholder="llama3"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.detectBtn}
            onPress={onDetect}
            disabled={detecting}
          >
            {detecting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.detectLabel}>
                Detectar modelos disponibles
              </Text>
            )}
          </TouchableOpacity>

          {detectError ? (
            <Text style={styles.error}>{detectError}</Text>
          ) : null}

          {availableModels && availableModels.length > 0 ? (
            <View style={styles.chips}>
              {availableModels.map((name) => {
                const selected = name === model;
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setModel(name)}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        selected && styles.chipLabelSelected,
                      ]}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {availableModels && availableModels.length === 0 ? (
            <Text style={styles.hint}>
              El servidor respondió pero no hay modelos. Corre{' '}
              <Text style={styles.mono}>ollama pull llama3</Text>
              {' '}en la PC.
            </Text>
          ) : null}
        </Field>

        <Field label="System prompt">
          <TextInput
            style={[styles.input, styles.multiline]}
            value={systemPrompt}
            onChangeText={setSystemPrompt}
            placeholder="Eres un asistente útil…"
            placeholderTextColor={colors.muted}
            multiline
          />
        </Field>

        <Field label="Temperatura">
          <TextInput
            style={styles.input}
            value={temperature}
            onChangeText={setTemperature}
            keyboardType="decimal-pad"
          />
        </Field>

        <Field label="Max tokens">
          <TextInput
            style={styles.input}
            value={maxTokens}
            onChangeText={setMaxTokens}
            keyboardType="number-pad"
          />
        </Field>

        <Field label="num_ctx (vacío = Modelfile)">
          <TextInput
            style={styles.input}
            value={numCtx}
            onChangeText={setNumCtx}
            keyboardType="number-pad"
          />
        </Field>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Thinking</Text>
          <Switch value={think} onValueChange={setThink} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.md, paddingBottom: spacing.xxl },
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
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    ...typography.bodySmall,
    color: colors.muted,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  mono: { ...typography.mono, color: colors.onSurface },
  detectBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  detectLabel: {
    ...typography.bodySmall,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  error: {
    ...typography.bodySmall,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    ...typography.bodySmall,
    color: colors.onSurface,
  },
  chipLabelSelected: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
});
