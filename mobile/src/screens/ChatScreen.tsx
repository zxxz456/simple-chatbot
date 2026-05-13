/**
 * ChatScreen.tsx
 * ========================
 *
 *
 * Description:
 * ------------
 * Pantalla principal de conversación. Header minimal con título de
 * sesión + pill con el modelo activo; barra horizontal de chips
 * mostrando los personajes activos (con "+" al final para abrir
 * el picker); flujo de mensajes full-width sin burbujas (estilo
 * Claude/DeepSeek); composer flotante abajo.
 *
 * Los dos modales (picker de personajes activos y sheet de
 * "¿quién responde?") están extraídos a
 * ``CharacterPickerModal`` y ``SpeakerPickerSheet`` — este
 * archivo orquesta estado y handlers.
 *
 *
 * Metadata:
 * ----------
 * - Author: zxxz6 (Bryan Violante Arriaga)
 * - Version: 0.0.4
 * - License: MIT
 *
 *
 * History:
 * ------------
 * Author      Date            Description
 * zxxz6       13/05/2026      Extraídos CharacterPickerModal + SpeakerPickerSheet
 * zxxz6       13/05/2026      Migrado a HTTP (sin DB local, cache de personajes)
 * zxxz6       13/05/2026      Speaker picker (long-press ↑) + continuación sin texto
 * zxxz6       13/05/2026      Soporte multi-personaje (chips bar + picker modal)
 * zxxz6       21/04/2026      Rediseño Claude/DeepSeek-style (header + pill modelo)
 * zxxz6       21/04/2026      Creation
 *
 * @format
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CharacterChip } from '@/components/CharacterChip';
import { CharacterPickerModal } from '@/components/CharacterPickerModal';
import { Composer } from '@/components/Composer';
import { ContextBar } from '@/components/ContextBar';
import { EmptyState } from '@/components/EmptyState';
import { MessageBubble } from '@/components/MessageBubble';
import { SpeakerPickerSheet } from '@/components/SpeakerPickerSheet';
import { colors, radii, sizes, spacing, typography } from '@/constants/theme';
import { useCharacterList } from '@/hooks/useCharacters';
import { useSendTurn } from '@/hooks/useChat';
import { useOpenSession } from '@/hooks/useSessions';
import * as api from '@/services/api';
import {
  KEEP_RECENT_MESSAGES,
  buildTranscript,
  summarizeMessages,
} from '@/services/compression';
import { showModelNumCtx } from '@/services/ollama';
import { useChatStore } from '@/store/chat-store';
import { useCharactersCache } from '@/store/characters-cache';
import { useSettingsStore } from '@/store/settings-store';
import type { Character } from '@/types/db';
import type { RootStackScreenProps } from '@/types/navigation';
import { errorMessage, networkErrorMessage } from '@/utils/error';

export function ChatScreen({
  navigation,
  route,
}: RootStackScreenProps<'Chat'>): React.JSX.Element {
  const messages = useChatStore((s) => s.messages);
  const isSending = useChatStore((s) => s.isSending);
  const sessionId = useChatStore((s) => s.sessionId);
  const title = useChatStore((s) => s.title);
  const scene = useChatStore((s) => s.scene);
  const summary = useChatStore((s) => s.summary);
  const summaryUptoMessageId = useChatStore((s) => s.summaryUptoMessageId);
  const lastInputTokens = useChatStore((s) => s.lastInputTokens);
  const ctxTotal = useChatStore((s) => s.ctxTotal);
  const activeCharacters = useChatStore((s) => s.characters);
  const setCharacters = useChatStore((s) => s.setCharacters);
  const rewindToBefore = useChatStore((s) => s.rewindToBefore);
  const setSummary = useChatStore((s) => s.setSummary);
  const setCtxTotal = useChatStore((s) => s.setCtxTotal);
  const model = useSettingsStore((s) => s.model);
  const baseUrl = useSettingsStore((s) => s.baseUrl);
  const numCtxOverride = useSettingsStore((s) => s.numCtx);

  const [compressing, setCompressing] = useState(false);
  const sendTurn = useSendTurn();
  const openSession = useOpenSession();
  const listRef = useRef<FlatList>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [speakerPickerOpen, setSpeakerPickerOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [characterListTrigger, setCharacterListTrigger] = useState(0);
  const { characters: allCharacters } = useCharacterList(characterListTrigger);
  const charactersById = useCharactersCache((s) => s.byId);

  // Si llegamos con sessionId en params y no está cargada, abrirla.
  // ``!== undefined`` explícito en vez de truthy: protege contra el
  // merge de params de react-navigation cuando hay residuo de una
  // visita previa.
  const paramSessionId = route.params?.sessionId;
  useEffect(() => {
    if (paramSessionId !== undefined && paramSessionId !== sessionId) {
      openSession(paramSessionId);
    }
  }, [paramSessionId, sessionId, openSession]);

  useEffect(() => {
    if (messages.length > 0) {
      const t = setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 50);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [messages.length, messages[messages.length - 1]?.content.length]);

  // Resolver ctxTotal: usar override de settings o leer Modelfile.
  useEffect(() => {
    if (numCtxOverride !== null) {
      setCtxTotal(numCtxOverride);
      return;
    }
    let cancelled = false;
    showModelNumCtx(baseUrl, model).then((n) => {
      if (!cancelled) {
        setCtxTotal(n);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [model, baseUrl, numCtxOverride, setCtxTotal]);

  const compressibleCount = useMemo(() => {
    const eligible = messages.filter(
      (m) =>
        m.rowId !== undefined &&
        (summaryUptoMessageId === null || m.rowId > summaryUptoMessageId),
    );
    return Math.max(0, eligible.length - KEEP_RECENT_MESSAGES);
  }, [messages, summaryUptoMessageId]);

  const activeCharacterIds = useMemo(
    () => new Set(activeCharacters.map((c) => c.id)),
    [activeCharacters],
  );

  const charactersByIdMap = useMemo(
    () =>
      new Map<number, Character>(
        Object.values(charactersById).map((c) => [c.id, c]),
      ),
    [charactersById],
  );

  const onCompress = async () => {
    if (sessionId === null || compressibleCount === 0) {
      return;
    }
    setCompressing(true);
    try {
      const eligible = messages.filter(
        (m) =>
          m.rowId !== undefined &&
          (summaryUptoMessageId === null || m.rowId > summaryUptoMessageId),
      );
      const toCompress = eligible.slice(
        0,
        eligible.length - KEEP_RECENT_MESSAGES,
      );
      const lastCompressed = toCompress[toCompress.length - 1];
      if (!lastCompressed || lastCompressed.rowId === undefined) {
        Alert.alert('Sin nada que comprimir', 'No hay mensajes elegibles.');
        return;
      }
      const transcript = buildTranscript(toCompress, charactersByIdMap);
      // Si ya había un resumen previo, lo prefijamos al transcript
      // para que el modelo lo absorba en el nuevo resumen.
      const fullTranscript = summary.trim()
        ? `Resumen previo:\n${summary.trim()}\n\nMensajes nuevos a integrar:\n${transcript}`
        : transcript;
      const newSummary = await summarizeMessages(
        baseUrl,
        model,
        fullTranscript,
      );
      if (!newSummary) {
        Alert.alert(
          'Resumen vacío',
          'El modelo devolvió un resumen vacío. Inténtalo de nuevo.',
        );
        return;
      }
      const updated = await api.setSummary(
        sessionId,
        newSummary,
        lastCompressed.rowId,
      );
      setSummary(updated.summary, updated.summary_upto_message_id);
    } catch (err) {
      Alert.alert('No se pudo comprimir', errorMessage(err));
    } finally {
      setCompressing(false);
    }
  };

  const onClearSummary = () => {
    if (sessionId === null) {
      return;
    }
    Alert.alert(
      'Borrar resumen',
      'Los mensajes comprimidos volverán al contexto del modelo. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = await api.clearSummary(sessionId);
              setSummary(updated.summary, updated.summary_upto_message_id);
            } catch (err) {
              Alert.alert('Error', errorMessage(err));
            }
          },
        },
      ],
    );
  };

  const toggleCharacter = (char: Character) => {
    const isActive = activeCharacterIds.has(char.id);
    const next = isActive
      ? activeCharacters.filter((c) => c.id !== char.id)
      : [...activeCharacters, char];
    setCharacters(next);
    if (sessionId !== null) {
      // Fire-and-forget: si falla la red, la lista en el store ya
      // se actualizó; la próxima apertura de la sesión la corregirá.
      void api
        .setSessionCharacters(
          sessionId,
          next.map((c) => c.id),
        )
        .catch(() => {});
    }
  };

  const submitTurn = (speakerIds?: number[]) => {
    const text = composerText;
    setComposerText('');
    void sendTurn(text, { speakerIds });
  };

  const handleSend = () => {
    // Con personajes activos siempre abrimos el picker — el
    // usuario decide quién responde cada turno. Sin personajes,
    // envío directo al assistant clásico.
    if (activeCharacters.length === 0) {
      submitTurn();
      return;
    }
    setSpeakerPickerOpen(true);
  };
  const handleLongPress = () => {
    if (activeCharacters.length === 0) {
      return;
    }
    setSpeakerPickerOpen(true);
  };
  const onPickSpeaker = (characterId: number) => {
    setSpeakerPickerOpen(false);
    submitTurn([characterId]);
  };
  const onPickAll = () => {
    setSpeakerPickerOpen(false);
    submitTurn();
  };

  const onMessageLongPress = (rowId: number | undefined) => {
    if (sessionId === null || rowId === undefined) {
      return;
    }
    const cutIndex = messages.findIndex(
      (m) => m.rowId !== undefined && m.rowId >= rowId,
    );
    if (cutIndex === -1) {
      return;
    }
    const total = messages.length - cutIndex;
    const others = total - 1;
    const body =
      others > 0
        ? `Se borrará este mensaje y ${others} posterior${others === 1 ? '' : 'es'}. Es como rebobinar la conversación.`
        : 'Se borrará solo este mensaje (es el último).';
    Alert.alert('Borrar mensaje', body, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.rewindFromMessage(sessionId, rowId);
            rewindToBefore(rowId);
          } catch (err) {
            Alert.alert('No se pudo borrar', networkErrorMessage(err));
          }
        },
      },
    ]);
  };

  const headerTitle =
    title ?? (sessionId === null ? 'Nueva conversación' : 'Sin título');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Sessions')}
          style={styles.headerIcon}
          accessibilityLabel="Volver a sesiones"
        >
          <Text style={styles.headerIconText}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('SessionEdit')}
          style={styles.headerCenter}
        >
          <Text style={styles.headerTitle} numberOfLines={1}>
            {headerTitle}
            {scene.trim() ? '  ·  🎬' : ''}
          </Text>
          <View style={styles.modelPill}>
            <Text style={styles.modelPillText} numberOfLines={1}>
              {model}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          style={styles.headerIcon}
          accessibilityLabel="Ajustes"
        >
          <Text style={styles.headerIconText}>⚙</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipBar}
        style={styles.chipBarWrap}
      >
        {activeCharacters.map((c) => (
          <CharacterChip
            key={c.id}
            character={c}
            selected
            onPress={() => toggleCharacter(c)}
          />
        ))}
        <TouchableOpacity
          style={styles.addChip}
          onPress={() => setPickerOpen(true)}
          accessibilityLabel="Agregar personajes"
        >
          <Text style={styles.addChipIcon}>+</Text>
          <Text style={styles.addChipLabel}>
            {activeCharacters.length === 0 ? 'Agregar personaje' : ''}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => {
            const character =
              item.characterId != null
                ? charactersById[item.characterId] ?? null
                : null;
            return (
              <MessageBubble
                message={item}
                modelLabel={model}
                character={character}
                onLongPress={() => onMessageLongPress(item.rowId)}
              />
            );
          }}
          ListEmptyComponent={
            <EmptyState
              emoji="✦"
              title="Empieza la conversación"
              body={
                activeCharacters.length > 0
                  ? `${activeCharacters.length} personaje${activeCharacters.length === 1 ? '' : 's'} responderá${activeCharacters.length === 1 ? '' : 'n'} en secuencia.`
                  : `Escribe abajo para mandar tu primer mensaje a ${model}.`
              }
              primaryEmoji
            />
          }
          contentContainerStyle={
            messages.length === 0 ? styles.listEmpty : styles.list
          }
        />
        <ContextBar
          used={lastInputTokens}
          total={ctxTotal}
          hasSummary={!!summary}
          canCompress={compressibleCount > 0 && !compressing && !isSending}
          compressing={compressing}
          onCompress={onCompress}
          onClearSummary={onClearSummary}
        />
        <Composer
          value={composerText}
          onChangeText={setComposerText}
          disabled={isSending}
          canChooseSpeaker={activeCharacters.length > 0}
          onSend={handleSend}
          onLongPress={handleLongPress}
        />
      </KeyboardAvoidingView>

      <SpeakerPickerSheet
        visible={speakerPickerOpen}
        characters={activeCharacters}
        onClose={() => setSpeakerPickerOpen(false)}
        onPickAll={onPickAll}
        onPickOne={onPickSpeaker}
      />

      <CharacterPickerModal
        visible={pickerOpen}
        characters={allCharacters}
        activeIds={activeCharacterIds}
        onClose={() => setPickerOpen(false)}
        onToggle={toggleCharacter}
        onManage={() => {
          setPickerOpen(false);
          navigation.navigate('Characters');
          setCharacterListTrigger((n) => n + 1);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.onSurface,
    fontWeight: '700',
  },
  modelPill: {
    marginTop: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    maxWidth: 200,
  },
  modelPillText: {
    ...typography.caption,
    color: colors.muted,
    fontWeight: '500',
  },
  chipBarWrap: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 48,
  },
  chipBar: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addChipIcon: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  addChipLabel: {
    ...typography.bodySmall,
    color: colors.muted,
  },
  list: { paddingBottom: spacing.md },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
});
