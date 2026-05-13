/**
 * api.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Cliente HTTP del backend ``libre-chat-server`` (FastAPI). Es la
 * única vía por la que la app móvil persiste / consulta sesiones,
 * mensajes, personajes y vínculos sesión↔personaje. No hay DB
 * local — toda la verdad vive en SQLite en la PC servidor.
 *
 * Convención: funciones puras, sin caché ni state. La URL base se
 * lee del ``settings-store`` en cada llamada (puede cambiar en
 * runtime desde Ajustes sin re-montar nada).
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
 * zxxz6       13/05/2026      Creation (reemplaza services/db.ts local)
 *
 * @format
 */

import { useSettingsStore } from '@/store/settings-store';
import type {
  Character,
  ChatMessageRow,
  ChatSession,
} from '@/types/db';
import type { Role } from '@/types/ollama';

/* ============================================================================
 * UTILIDADES
 * ============================================================================ */

function baseUrl(): string {
  return useSettingsStore.getState().apiUrl.replace(/\/+$/, '');
}

const REQUEST_TIMEOUT_MS = 10_000;

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: controller.signal,
      ...init,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Timeout conectando a ${baseUrl()} (¿server arriba?)`);
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
  clearTimeout(timer);
  if (!resp.ok) {
    let detail = '';
    try {
      const body = (await resp.json()) as { detail?: string };
      detail = body?.detail ? ` — ${body.detail}` : '';
    } catch {
      // body no es JSON; ignoramos
    }
    throw new Error(`HTTP ${resp.status}${detail}`);
  }
  // 204 no devuelve body
  if (resp.status === 204) {
    return undefined as unknown as T;
  }
  return (await resp.json()) as T;
}

/* ============================================================================
 * HEALTH
 * ============================================================================ */

export async function health(): Promise<{ status: string }> {
  return request<{ status: string }>('/health');
}

/* ============================================================================
 * SESSIONS
 * ============================================================================ */

export interface SessionFull {
  session: ChatSession;
  messages: ChatMessageRow[];
  /** Todos los personajes referenciados (activos + huérfanos). */
  characters: Character[];
  /** Subset que está activo para nuevos turnos. */
  active_character_ids: number[];
}

export async function listSessions(): Promise<ChatSession[]> {
  return request<ChatSession[]>('/sessions');
}

export async function createSession(payload: {
  model: string;
  system_prompt?: string;
  title?: string | null;
  scene?: string;
}): Promise<ChatSession> {
  return request<ChatSession>('/sessions', {
    method: 'POST',
    body: JSON.stringify({
      model: payload.model,
      system_prompt: payload.system_prompt ?? '',
      title: payload.title ?? null,
      scene: payload.scene ?? '',
    }),
  });
}

export async function getSessionFull(id: number): Promise<SessionFull> {
  return request<SessionFull>(`/sessions/${id}`);
}

export async function patchSession(
  id: number,
  patch: {
    title?: string;
    system_prompt?: string;
    scene?: string;
    model?: string;
  },
): Promise<ChatSession> {
  return request<ChatSession>(`/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteSession(id: number): Promise<void> {
  await request<{ ok: boolean }>(`/sessions/${id}`, { method: 'DELETE' });
}

/* ============================================================================
 * MESSAGES
 * ============================================================================ */

export async function listMessages(
  sessionId: number,
): Promise<ChatMessageRow[]> {
  return request<ChatMessageRow[]>(`/sessions/${sessionId}/messages`);
}

export async function addMessage(
  sessionId: number,
  payload: {
    role: Role;
    content: string;
    input_tokens?: number;
    output_tokens?: number;
    eval_duration_ns?: number;
    character_id?: number | null;
  },
): Promise<ChatMessageRow> {
  return request<ChatMessageRow>(`/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function clearMessages(sessionId: number): Promise<void> {
  await request<{ ok: boolean }>(`/sessions/${sessionId}/messages`, {
    method: 'DELETE',
  });
}

/**
 * "Rebobina" la conversación al borrar el mensaje indicado y
 * todos los posteriores. Devuelve cuántos fueron borrados.
 */
export async function rewindFromMessage(
  sessionId: number,
  messageId: number,
): Promise<{ deleted: number }> {
  return request<{ deleted: number }>(
    `/sessions/${sessionId}/messages/${messageId}`,
    { method: 'DELETE' },
  );
}

/* ============================================================================
 * SUMMARY (compresión)
 * ============================================================================ */

export async function setSummary(
  sessionId: number,
  content: string,
  uptoMessageId: number,
): Promise<ChatSession> {
  return request<ChatSession>(`/sessions/${sessionId}/summary`, {
    method: 'POST',
    body: JSON.stringify({ content, upto_message_id: uptoMessageId }),
  });
}

export async function clearSummary(sessionId: number): Promise<ChatSession> {
  return request<ChatSession>(`/sessions/${sessionId}/summary`, {
    method: 'DELETE',
  });
}

/* ============================================================================
 * CHARACTERS
 * ============================================================================ */

export async function listCharacters(): Promise<Character[]> {
  return request<Character[]>('/characters');
}

export async function createCharacter(payload: {
  name: string;
  avatar: string;
  color: string;
  system_prompt: string;
}): Promise<Character> {
  return request<Character>('/characters', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCharacter(
  id: number,
  payload: {
    name: string;
    avatar: string;
    color: string;
    system_prompt: string;
  },
): Promise<Character> {
  return request<Character>(`/characters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteCharacter(id: number): Promise<void> {
  await request<{ ok: boolean }>(`/characters/${id}`, { method: 'DELETE' });
}

/* ============================================================================
 * SESSION ↔ CHARACTERS
 * ============================================================================ */

export async function setSessionCharacters(
  sessionId: number,
  characterIds: number[],
): Promise<Character[]> {
  return request<Character[]>(`/sessions/${sessionId}/characters`, {
    method: 'PUT',
    body: JSON.stringify(characterIds),
  });
}
