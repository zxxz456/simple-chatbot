/**
 * chat-store.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Store local de la conversación activa con zustand. Mantiene en
 * memoria:
 *
 *   * ``sessionId`` / ``title`` / ``systemPrompt`` — metadata.
 *   * ``messages`` — turnos en orden, cada uno con role + content
 *     + (opcional) ``characterId`` cuando lo emitió un personaje.
 *   * ``characters`` — personajes activos en la sesión (vacío =
 *     modo clásico, sólo se usa el ``systemPrompt`` de la sesión).
 *   * ``isSending``, contadores de tokens / duraciones.
 *
 * La persistencia real vive en SQLite/AsyncStorage; este store es
 * la vista de esa sesión activa que los componentes suscriben.
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
 * zxxz6       13/05/2026      Added characters list + per-message characterId
 * zxxz6       21/04/2026      Creation
 *
 * @format
 */

import { create } from 'zustand';

import type { Character } from '@/types/db';
import type { ChatMessage } from '@/types/ollama';

/**
 * Mensaje en memoria + (opcional) id de la fila SQLite, thinking
 * cacheado y vínculo con el personaje que lo emitió.
 */
export interface UiMessage extends ChatMessage {
  /** Id de la fila ``messages`` (presente tras flush). */
  rowId?: number;
  /** Sólo en filas ``assistant`` cuando se generó con think on. */
  thinking?: string;
  inputTokens?: number;
  outputTokens?: number;
  evalDurationNs?: number;
  /** Sólo en ``assistant`` cuando la sesión tiene personajes. */
  characterId?: number | null;
}

export interface ChatState {
  sessionId: number | null;
  title: string | null;
  systemPrompt: string;
  scene: string;
  summary: string;
  summaryUptoMessageId: number | null;
  characters: Character[];
  messages: UiMessage[];
  isSending: boolean;
  tokensTotal: { input: number; output: number };
  durationsTotalNs: { input: number; output: number };
  /** Tokens del último prompt enviado a Ollama. Para el medidor de contexto. */
  lastInputTokens: number;
  /** Tamaño total del context window del modelo. null = desconocido. */
  ctxTotal: number | null;

  /**
   * Reemplaza por completo el estado de la sesión activa. Se
   * llama tras abrir una sesión existente (``useOpenSession``) o
   * tras crear una nueva en el server (``useSendTurn``). Resetea
   * stats y flags efímeros.
   */
  loadSession: (payload: {
    sessionId: number;
    title: string | null;
    systemPrompt: string;
    scene: string;
    summary: string;
    summaryUptoMessageId: number | null;
    characters: Character[];
    messages: UiMessage[];
  }) => void;

  /**
   * Vacía el store dejando un chat nuevo (sin sesión, sin mensajes,
   * sin personajes). El ``systemPrompt`` viene del store de
   * settings — se inyecta al crear la primera sesión del chat.
   */
  reset: (systemPrompt: string) => void;

  /** Actualiza el resumen activo (texto + hasta qué mensaje cubre). */
  setSummary: (content: string, uptoMessageId: number | null) => void;
  /** Setter del medidor de contexto (tokens del último prompt). */
  setLastInputTokens: (n: number) => void;
  /** Setter del tamaño total del context window del modelo. */
  setCtxTotal: (n: number | null) => void;
  /** Apila un mensaje al final del array. */
  appendMessage: (msg: UiMessage) => void;

  /**
   * Aplica un ``patch`` parcial al último mensaje con
   * ``role === 'assistant'`` encontrado yendo desde el final.
   * Usado por el stream para actualizar contenido/thinking del
   * placeholder en vivo sin recrear el array entero.
   */
  updateLastAssistant: (patch: Partial<UiMessage>) => void;
  /**
   * Borra de memoria el mensaje con ``rowId === fromRowId`` y
   * todos los mensajes posteriores (rowId mayor). Mensajes sin
   * rowId (placeholders en vuelo) también se eliminan si vienen
   * después del rowId dado en el array.
   */
  rewindToBefore: (fromRowId: number) => void;
  /** Flag de "hay un turno en vuelo" — bloquea el composer. */
  setIsSending: (v: boolean) => void;
  setTitle: (t: string | null) => void;
  setSystemPrompt: (p: string) => void;
  setScene: (s: string) => void;
  /** Reemplaza la lista de personajes activos en la sesión. */
  setCharacters: (chars: Character[]) => void;

  /**
   * Suma los stats de un turno (tokens y duraciones de Ollama) a
   * los acumulados de la sesión. No persiste — los stats viven sólo
   * mientras la sesión está abierta.
   */
  addTurnStats: (stats: {
    inputTokens: number;
    outputTokens: number;
    inputNs: number;
    outputNs: number;
  }) => void;
}

/**
 * Hook + ``getState()`` del store de chat activo.
 *
 * Description:
 * ------------
 * Una sola sesión está activa a la vez. Cambiar de sesión =
 * ``loadSession`` (sobrescribe) o ``reset`` (deja chat nuevo).
 */

export const useChatStore = create<ChatState>((set) => ({
  sessionId: null,
  title: null,
  systemPrompt: '',
  scene: '',
  summary: '',
  summaryUptoMessageId: null,
  characters: [],
  messages: [],
  isSending: false,
  tokensTotal: { input: 0, output: 0 },
  durationsTotalNs: { input: 0, output: 0 },
  lastInputTokens: 0,
  ctxTotal: null,

  loadSession: ({
    sessionId,
    title,
    systemPrompt,
    scene,
    summary,
    summaryUptoMessageId,
    characters,
    messages,
  }) =>
    set({
      sessionId,
      title,
      systemPrompt,
      scene,
      summary,
      summaryUptoMessageId,
      characters,
      messages,
      isSending: false,
      tokensTotal: { input: 0, output: 0 },
      durationsTotalNs: { input: 0, output: 0 },
      lastInputTokens: 0,
    }),

  reset: (systemPrompt) =>
    set({
      sessionId: null,
      title: null,
      systemPrompt,
      scene: '',
      summary: '',
      summaryUptoMessageId: null,
      characters: [],
      messages: [],
      isSending: false,
      tokensTotal: { input: 0, output: 0 },
      durationsTotalNs: { input: 0, output: 0 },
      lastInputTokens: 0,
    }),

  setSummary: (content, uptoMessageId) =>
    set({ summary: content, summaryUptoMessageId: uptoMessageId }),
  setLastInputTokens: (n) => set({ lastInputTokens: n }),
  setCtxTotal: (n) => set({ ctxTotal: n }),

  appendMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  updateLastAssistant: (patch) =>
    set((s) => {
      if (s.messages.length === 0) {
        return s;
      }
      const next = [...s.messages];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i].role === 'assistant') {
          next[i] = { ...next[i], ...patch };
          break;
        }
      }
      return { messages: next };
    }),

  rewindToBefore: (fromRowId) =>
    set((s) => {
      const cutIndex = s.messages.findIndex(
        (m) => m.rowId !== undefined && m.rowId >= fromRowId,
      );
      if (cutIndex === -1) {
        return s;
      }
      return { messages: s.messages.slice(0, cutIndex) };
    }),

  setIsSending: (isSending) => set({ isSending }),
  setTitle: (title) => set({ title }),
  setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
  setScene: (scene) => set({ scene }),
  setCharacters: (characters) => set({ characters }),

  addTurnStats: ({ inputTokens, outputTokens, inputNs, outputNs }) =>
    set((s) => ({
      tokensTotal: {
        input: s.tokensTotal.input + inputTokens,
        output: s.tokensTotal.output + outputTokens,
      },
      durationsTotalNs: {
        input: s.durationsTotalNs.input + inputNs,
        output: s.durationsTotalNs.output + outputNs,
      },
    })),
}));
