/**
 * useChat.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Orquesta un turno de conversación contra el server HTTP +
 * Ollama. Flujo:
 *
 *   1. Si la sesión no existe en server, ``POST /sessions``.
 *   2. Si el composer trae texto, ``POST /sessions/{id}/messages``
 *      con el mensaje del usuario.
 *   3. Para cada hablante (todos los activos, o el subset elegido
 *      por el long-press picker, o el assistant clásico),
 *      ``ollama.chat`` en streaming token-a-token (UI actualizada
 *      en vivo); al terminar, ``POST /sessions/{id}/messages`` con
 *      la respuesta + stats.
 *
 * Reglas de reescritura del historial siguen igual que el modo
 * local previo (otros personajes → user con prefijo ``[Name]:``).
 *
 *
 * Metadata:
 * ----------
 * - Author: zxxz6 (Bryan Violante Arriaga)
 * - Version: 0.1.0
 * - License: MIT
 *
 *
 * History:
 * ------------
 * Author      Date            Description
 * zxxz6       13/05/2026      Migrado a HTTP (libre-chat-server) — sin DB local
 * zxxz6       13/05/2026      sendTurn acepta speakerIds + texto opcional
 * zxxz6       13/05/2026      Multi-personaje secuencial con history rewriting
 * zxxz6       21/04/2026      Switch to streaming (NDJSON token-by-token)
 * zxxz6       21/04/2026      Creation
 *
 * @format
 */

import { useCallback, useEffect, useRef } from 'react';

import * as api from '@/services/api';
import { chatStream, type ChatStreamHandle } from '@/services/ollama';
import { useChatStore } from '@/store/chat-store';
import type { UiMessage } from '@/store/chat-store';
import { useSettingsStore } from '@/store/settings-store';
import type { Character } from '@/types/db';
import type { ChatMessage } from '@/types/ollama';
import { errorMessage, networkErrorMessage } from '@/utils/error';

interface Speaker {
  characterId: number | null;
  systemPrompt: string;
  /** Nombre del personaje (sólo cuando ``characterId`` no es null). */
  name?: string;
}

export interface SendTurnOptions {
  speakerIds?: number[];
}

export type SendTurn = (
  text: string,
  options?: SendTurnOptions,
) => Promise<void>;

function composeSystem(
  speaker: Speaker,
  scene: string,
  summary: string,
  otherNames: string[],
): string {
  let out = speaker.systemPrompt;

  // Disambiguación explícita en modo multi-personaje. Sin esto el
  // modelo a veces confunde "[OtroNombre]: ..." con un mensaje del
  // usuario y termina hablando con la voz del usuario en lugar de
  // la suya.
  if (speaker.name) {
    const othersList = otherNames.length > 0
      ? otherNames.map((n) => `"${n}"`).join(', ')
      : '(ninguno por ahora)';
    out +=
      `\n\nReglas estrictas de roleplay:\n` +
      `- Hablas SOLO como ${speaker.name}. No escribas como el usuario humano ni como otros personajes.\n` +
      `- Los mensajes en este chat prefijados con "[Nombre]:" son las palabras de OTROS personajes presentes en la escena (${othersList}), nunca del usuario.\n` +
      `- El usuario humano es quien escribe SIN prefijo. Cuando te dirijas a él, llámalo "tú" o por su nombre si lo conoces — no asumas su voz ni respondas por él.\n` +
      `- Tu respuesta debe ser solo lo que diría ${speaker.name} en este turno, en primera persona, sin meta-comentarios.`;
  }

  const cleanScene = scene.trim();
  if (cleanScene) {
    out += `\n\nEscena / contexto:\n${cleanScene}`;
  }
  const cleanSummary = summary.trim();
  if (cleanSummary) {
    out += `\n\nResumen de la conversación previa:\n${cleanSummary}`;
  }
  return out;
}

function buildApiMessages(
  speaker: Speaker,
  scene: string,
  summary: string,
  summaryUptoMessageId: number | null,
  history: UiMessage[],
  charactersById: Map<number, Character>,
): ChatMessage[] {
  const otherNames = [...charactersById.values()]
    .filter((c) => c.id !== speaker.characterId)
    .map((c) => c.name);
  const out: ChatMessage[] = [
    {
      role: 'system',
      content: composeSystem(speaker, scene, summary, otherNames),
    },
  ];
  // Si hay resumen activo, omitir los mensajes que cubre.
  const filtered =
    summaryUptoMessageId !== null
      ? history.filter(
          (m) => m.rowId === undefined || m.rowId > summaryUptoMessageId,
        )
      : history;
  // Si la historia visible para este turno está vacía (escena nueva
  // arrancada por un personaje, sin user input), inyectamos un
  // mensaje de kickoff para darle al modelo algo a lo que reaccionar.
  if (filtered.length === 0) {
    out.push({
      role: 'user',
      content:
        '(La escena comienza. Toma la iniciativa según el escenario y tu personaje. Responde con tu primera intervención.)',
    });
    return out;
  }
  for (const m of filtered) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content });
      continue;
    }
    const owner = m.characterId ?? null;
    if (owner === speaker.characterId) {
      out.push({ role: 'assistant', content: m.content });
    } else if (owner !== null && charactersById.has(owner)) {
      const other = charactersById.get(owner)!;
      out.push({ role: 'user', content: `[${other.name}]: ${m.content}` });
    } else {
      out.push({ role: 'assistant', content: m.content });
    }
  }
  return out;
}

export function useSendTurn(): SendTurn {
  const sessionId = useChatStore((s) => s.sessionId);
  const messages = useChatStore((s) => s.messages);
  const systemPrompt = useChatStore((s) => s.systemPrompt);
  const scene = useChatStore((s) => s.scene);
  const summary = useChatStore((s) => s.summary);
  const summaryUptoMessageId = useChatStore((s) => s.summaryUptoMessageId);
  const title = useChatStore((s) => s.title);
  const characters = useChatStore((s) => s.characters);
  const loadSession = useChatStore((s) => s.loadSession);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const updateLastAssistant = useChatStore((s) => s.updateLastAssistant);
  const setIsSending = useChatStore((s) => s.setIsSending);
  const addTurnStats = useChatStore((s) => s.addTurnStats);
  const setTitle = useChatStore((s) => s.setTitle);
  const setLastInputTokens = useChatStore((s) => s.setLastInputTokens);

  const streamRef = useRef<ChatStreamHandle | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.cancel();
      streamRef.current = null;
    };
  }, []);

  return useCallback(
    async (text, options) => {
      const settings = useSettingsStore.getState();
      const trimmed = text.trim();
      const hasChars = characters.length > 0;

      if (!trimmed && !hasChars) {
        // Sin texto y sin personajes no hay nada que hacer (modo
        // clásico requiere input del usuario).
        return;
      }
      // Con personajes activos sí permitimos turnos sin texto, aún
      // sin historia previa: el personaje arranca la escena.
      // ``runOneSpeaker``/``buildApiMessages`` inyecta un mensaje
      // de kickoff sintético cuando no hay nada más que mandar.

      // 1. Ensure session
      let sid = sessionId;
      if (sid === null) {
        try {
          const created = await api.createSession({
            model: settings.model,
            system_prompt: systemPrompt,
            title,
            scene,
          });
          sid = created.id;
          loadSession({
            sessionId: sid,
            title: created.title,
            systemPrompt: created.system_prompt,
            scene: created.scene,
            summary: created.summary,
            summaryUptoMessageId: created.summary_upto_message_id,
            characters,
            messages: [],
          });
          if (characters.length > 0) {
            try {
              await api.setSessionCharacters(
                sid,
                characters.map((c) => c.id),
              );
            } catch {
              // No bloqueamos el turno por esto.
            }
          }
        } catch (err) {
          appendMessage({
            role: 'assistant',
            content: `⚠ No se pudo crear la sesión: ${
              networkErrorMessage(err)
            }`,
          });
          return;
        }
      }

      // 2. User message (si hay texto)
      let userMessage: UiMessage | null = null;
      if (trimmed) {
        try {
          const row = await api.addMessage(sid, {
            role: 'user',
            content: trimmed,
            character_id: null,
          });
          userMessage = {
            role: 'user',
            content: trimmed,
            rowId: row.id,
          };
          appendMessage(userMessage);
        } catch (err) {
          appendMessage({
            role: 'assistant',
            content: `⚠ No se pudo guardar tu mensaje: ${
              networkErrorMessage(err)
            }`,
          });
          return;
        }
        // Refrescar título por si el server auto-generó uno.
        try {
          const refreshed = await api.getSessionFull(sid);
          if (refreshed.session.title !== title) {
            setTitle(refreshed.session.title);
          }
        } catch {
          // ignore
        }
      }

      // 3. Resolver speakers
      let speakers: Speaker[];
      if (hasChars) {
        const targetIds = options?.speakerIds ?? characters.map((c) => c.id);
        if (targetIds.length === 0) {
          return;
        }
        speakers = characters
          .filter((c) => targetIds.includes(c.id))
          .map((c) => ({
            characterId: c.id,
            systemPrompt: c.system_prompt,
            name: c.name,
          }));
      } else {
        speakers = [{ characterId: null, systemPrompt }];
      }

      const charactersById = new Map<number, Character>(
        characters.map((c) => [c.id, c]),
      );

      const localHistory: UiMessage[] = userMessage
        ? [...messages, userMessage]
        : [...messages];

      // 4. Stream + persist por cada speaker
      setIsSending(true);
      try {
        for (const speaker of speakers) {
          await runOneSpeaker({
            speaker,
            sid,
            scene,
            summary,
            summaryUptoMessageId,
            localHistory,
            charactersById,
            settings,
            streamRef,
            appendMessage,
            updateLastAssistant,
            addTurnStats,
            setLastInputTokens,
          });
        }
      } finally {
        setIsSending(false);
      }
    },
    [
      sessionId,
      messages,
      systemPrompt,
      scene,
      summary,
      summaryUptoMessageId,
      title,
      characters,
      loadSession,
      appendMessage,
      updateLastAssistant,
      setIsSending,
      addTurnStats,
      setTitle,
      setLastInputTokens,
    ],
  );
}

interface SpeakerArgs {
  speaker: Speaker;
  sid: number;
  scene: string;
  summary: string;
  summaryUptoMessageId: number | null;
  localHistory: UiMessage[];
  charactersById: Map<number, Character>;
  settings: ReturnType<typeof useSettingsStore.getState>;
  streamRef: React.RefObject<ChatStreamHandle | null>;
  appendMessage: (m: UiMessage) => void;
  updateLastAssistant: (patch: Partial<UiMessage>) => void;
  addTurnStats: (s: {
    inputTokens: number;
    outputTokens: number;
    inputNs: number;
    outputNs: number;
  }) => void;
  setLastInputTokens: (n: number) => void;
}

async function runOneSpeaker(args: SpeakerArgs): Promise<void> {
  const {
    speaker,
    sid,
    scene,
    summary,
    summaryUptoMessageId,
    localHistory,
    charactersById,
    settings,
    streamRef,
    appendMessage,
    updateLastAssistant,
    addTurnStats,
    setLastInputTokens,
  } = args;

  const placeholder: UiMessage = {
    role: 'assistant',
    content: '',
    thinking: '',
    characterId: speaker.characterId,
  };
  appendMessage(placeholder);

  const apiMessages = buildApiMessages(
    speaker,
    scene,
    summary,
    summaryUptoMessageId,
    localHistory,
    charactersById,
  );

  return new Promise<void>((resolve) => {
    streamRef.current = chatStream(
      settings.baseUrl,
      {
        model: settings.model,
        messages: apiMessages,
        think: settings.think,
        options: {
          temperature: settings.temperature,
          num_predict: settings.maxTokens,
          ...(settings.numCtx !== null ? { num_ctx: settings.numCtx } : {}),
        },
      },
      {
        onContent: (_d, accumulated) => {
          updateLastAssistant({ content: accumulated });
        },
        onThinking: (_d, accumulated) => {
          updateLastAssistant({ thinking: accumulated });
        },
        onDone: async (result) => {
          try {
            const row = await api.addMessage(sid, {
              role: 'assistant',
              content: result.content,
              input_tokens: result.inputTokens,
              output_tokens: result.outputTokens,
              eval_duration_ns: result.evalDurationNs,
              character_id: speaker.characterId,
            });
            updateLastAssistant({
              rowId: row.id,
              content: result.content,
              thinking: result.thinking,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              evalDurationNs: result.evalDurationNs,
            });
          } catch (err) {
            updateLastAssistant({
              content:
                result.content +
                `\n\n⚠ Se perdió en el server: ${
                  errorMessage(err)
                }`,
              thinking: result.thinking,
            });
          }
          addTurnStats({
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            inputNs: 0,
            outputNs: result.evalDurationNs,
          });
          setLastInputTokens(result.inputTokens);
          localHistory.push({
            role: 'assistant',
            content: result.content,
            characterId: speaker.characterId,
            thinking: result.thinking,
          });
          streamRef.current = null;
          resolve();
        },
        onError: (err) => {
          const current =
            useChatStore.getState().messages.slice(-1)[0]?.content ?? '';
          updateLastAssistant({
            content: `${current}\n\n⚠ ${err.message}`,
          });
          streamRef.current = null;
          resolve();
        },
      },
    );
  });
}
