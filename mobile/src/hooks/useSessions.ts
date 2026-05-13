/**
 * useSessions.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Hooks de listado / apertura / renombrado / borrado de sesiones,
 * todos vía HTTP contra el FastAPI server. Sin DB local.
 *
 * ``useSessionList`` mantiene la lista en estado local + flag de
 * ``loading``; recarga al cambiar ``trigger`` (útil tras crear /
 * borrar). ``useOpenSession`` carga la sesión completa (mensajes
 * + personajes referenciados + activos) y sincroniza el
 * ``chat-store`` + el ``characters-cache``.
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
 * zxxz6       13/05/2026      Migrado a HTTP (libre-chat-server)
 * zxxz6       13/05/2026      useOpenSession también carga personajes
 * zxxz6       21/04/2026      Creation
 *
 * @format
 */

import { useCallback, useEffect, useState } from 'react';

import * as api from '@/services/api';
import { useChatStore } from '@/store/chat-store';
import type { UiMessage } from '@/store/chat-store';
import { useCharactersCache } from '@/store/characters-cache';
import type { ChatSession } from '@/types/db';
import { errorMessage, saveErrorMessage } from '@/utils/error';

export interface UseSessionListResult {
  /** Lista de sesiones devuelta por el server, ordenada por ``updated_at`` desc. */
  sessions: ChatSession[];
  /** ``true`` mientras hay un fetch en vuelo. */
  loading: boolean;
  /** Mensaje de error normalizado del último fetch fallido, ``null`` si ok. */
  error: string | null;
}

/**
 * Lista las sesiones desde el server. Recarga al cambiar ``trigger``.
 */
export function useSessionList(trigger = 0): UseSessionListResult {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listSessions()
      .then((rows) => {
        if (!cancelled) {
          setSessions(rows);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [trigger]);

  return { sessions, loading, error };
}

/**
 * Devuelve una función que abre una sesión (carga full desde
 * server + sincroniza store + cache).
 */
export function useOpenSession(): (sessionId: number) => Promise<boolean> {
  const loadSession = useChatStore((s) => s.loadSession);
  const upsertCache = useCharactersCache((s) => s.upsert);

  return useCallback(
    async (sessionId) => {
      try {
        const full = await api.getSessionFull(sessionId);
        upsertCache(full.characters);
        const active = full.characters.filter((c) =>
          full.active_character_ids.includes(c.id),
        );
        const messages: UiMessage[] = full.messages.map((r) => ({
          role: r.role as UiMessage['role'],
          content: r.content,
          rowId: r.id,
          characterId: r.character_id ?? undefined,
          inputTokens: r.input_tokens ?? undefined,
          outputTokens: r.output_tokens ?? undefined,
          evalDurationNs: r.eval_duration_ns ?? undefined,
        }));
        loadSession({
          sessionId,
          title: full.session.title,
          systemPrompt: full.session.system_prompt,
          scene: full.session.scene,
          summary: full.session.summary,
          summaryUptoMessageId: full.session.summary_upto_message_id,
          characters: active,
          messages,
        });
        return true;
      } catch {
        return false;
      }
    },
    [loadSession, upsertCache],
  );
}

/**
 * Renombra y sincroniza el chat-store si la sesión renombrada es
 * la activa. Async.
 */
export async function renameAndSync(
  sessionId: number,
  newTitle: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const trimmed = newTitle.trim();
  if (!trimmed) {
    return { ok: false, reason: 'El título no puede estar vacío.' };
  }
  try {
    await api.patchSession(sessionId, { title: trimmed });
  } catch (err) {
    return {
      ok: false,
      reason: saveErrorMessage(
        err,
        'Ya existe otra sesión con ese título.',
        'No se pudo renombrar la sesión.',
      ),
    };
  }
  if (useChatStore.getState().sessionId === sessionId) {
    useChatStore.getState().setTitle(trimmed);
  }
  return { ok: true };
}

/**
 * Borra una sesión del server. Resetea el chat-store si la borrada
 * era la activa.
 */
export async function deleteAndSync(sessionId: number): Promise<void> {
  await api.deleteSession(sessionId);
  if (useChatStore.getState().sessionId === sessionId) {
    useChatStore.getState().reset(useChatStore.getState().systemPrompt);
  }
}
