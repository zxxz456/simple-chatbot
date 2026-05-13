/**
 * ollama.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Cliente HTTP de la REST API de Ollama. Tres operaciones:
 *
 *   * ``chat`` — POST /api/chat (no-streaming en v1; el streaming
 *     llega en la siguiente fase con ``XMLHttpRequest`` + parser
 *     NDJSON, porque el ``fetch`` de RN aún no expone el body
 *     como ``ReadableStream`` de forma estable).
 *   * ``listModels`` — GET /api/tags.
 *   * ``showModel`` — POST /api/show (para leer ``num_ctx`` del
 *     Modelfile y mostrar el % de contexto usado).
 *
 * La URL base la decide el caller pasando ``baseUrl`` (viene del
 * ``settings-store``). Mantener el service "puro" hace trivial
 * testearlo y swappear de store si en el futuro se incorpora otro
 * state manager.
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
 * zxxz6       21/04/2026      Streaming via XMLHttpRequest + parser NDJSON
 * zxxz6       21/04/2026      Creation (v1 no-streaming)
 *
 * @format
 */

import { OLLAMA_TIMEOUT_MS } from '@/constants/config';
import type {
  ChatChunk,
  ChatRequest,
  ChatResult,
  OllamaShowResponse,
  OllamaTagsResponse,
} from '@/types/ollama';

/* ============================================================================
 * UTILIDADES
 * ============================================================================ */

/**
 * Compone una URL absoluta a partir de ``baseUrl`` y un path.
 *
 * Description:
 * ------------
 * Normaliza la barra final del ``baseUrl`` para evitar dobles
 * slashes o paths concatenados mal.
 */
function joinUrl(baseUrl: string, path: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${trimmed}${suffix}`;
}

/**
 * Envuelve ``fetch`` con un timeout vía ``AbortController``.
 *
 * Description:
 * ------------
 * El cliente nativo de RN no respeta ``signal.timeout`` en todas
 * las versiones, así que cancelamos manualmente.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* ============================================================================
 * CHAT
 * ============================================================================ */

/**
 * Llama a ``POST /api/chat`` en modo no-streaming.
 *
 * Description:
 * ------------
 * Ollama devuelve una sola respuesta JSON con el ``message``
 * completo y los contadores de tokens / duraciones del turno.
 *
 * El streaming real (NDJSON línea por línea) se implementará en
 * la fase 2 con ``XMLHttpRequest.onprogress`` para poder pintar
 * la respuesta token a token sin depender de ``ReadableStream``.
 *
 * Inputs:
 * -------
 * baseUrl : string
 *     URL del servidor Ollama (sin path).
 * req : ChatRequest
 *     Payload con ``model``, ``messages``, ``options``, ``think``.
 *
 * Returns:
 * --------
 * Promise<ChatResult>
 *     Texto de respuesta, thinking (si aplica) y stats del turno.
 */
export async function chat(
  baseUrl: string,
  req: ChatRequest,
): Promise<ChatResult> {
  const resp = await fetchWithTimeout(
    joinUrl(baseUrl, '/api/chat'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...req, stream: false }),
    },
    OLLAMA_TIMEOUT_MS,
  );
  if (!resp.ok) {
    throw new Error(`Ollama /api/chat → HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as ChatChunk;
  return {
    content: data.message?.content ?? '',
    thinking: data.message?.thinking ?? '',
    inputTokens: data.prompt_eval_count ?? 0,
    outputTokens: data.eval_count ?? 0,
    evalDurationNs: data.eval_duration ?? 0,
    doneReason: data.done_reason ?? 'stop',
  };
}

/* ============================================================================
 * CHAT STREAMING
 * ============================================================================ */

/**
 * Callbacks consumidos por ``chatStream``.
 *
 * Description:
 * ------------
 * Cada uno se invoca cero o más veces durante la vida del stream;
 * ``onDone`` o ``onError`` se invocan exactamente uno al terminar.
 */
export interface ChatStreamHandlers {
  onContent: (delta: string, accumulated: string) => void;
  onThinking: (delta: string, accumulated: string) => void;
  onDone: (result: ChatResult) => void;
  onError: (err: Error) => void;
}

/**
 * Handle de control devuelto por ``chatStream``. ``cancel`` aborta
 * la request — útil si el usuario navega fuera de la pantalla o
 * arranca otro turno antes de que el actual termine.
 */
export interface ChatStreamHandle {
  cancel: () => void;
}

/**
 * Stream de ``POST /api/chat`` consumido con ``XMLHttpRequest``.
 *
 * Description:
 * ------------
 * Por qué XHR y no ``fetch``: en React Native 0.83 (y todas las
 * anteriores), el ``fetch`` integrado materializa el body completo
 * antes de resolver — no expone ``response.body`` como
 * ``ReadableStream``. ``XMLHttpRequest.onprogress`` sí da acceso al
 * ``responseText`` incremental, que es lo que necesitamos para
 * parsear NDJSON línea por línea conforme Ollama lo escupe.
 *
 * Parser:
 *
 *   * Mantenemos ``processedLen`` con la longitud ya consumida del
 *     ``responseText`` acumulado.
 *   * En cada ``onprogress`` cortamos hasta el último ``\n`` y
 *     parseamos todas las líneas completas; las parciales se
 *     dejan para el próximo evento.
 *   * En ``onload`` rematamos cualquier residuo sin newline final.
 *
 * El último chunk de Ollama tiene ``done: true`` y trae los
 * contadores agregados; se pasa a ``onDone``.
 *
 * Inputs:
 * -------
 * baseUrl : string
 * req : ChatRequest
 * handlers : ChatStreamHandlers
 *
 * Returns:
 * --------
 * ChatStreamHandle
 *     ``cancel()`` aborta el XHR (cierra el socket).
 */
export function chatStream(
  baseUrl: string,
  req: ChatRequest,
  handlers: ChatStreamHandlers,
): ChatStreamHandle {
  const xhr = new XMLHttpRequest();
  let processedLen = 0;
  let content = '';
  let thinking = '';
  let lastChunk: ChatChunk | null = null;
  let aborted = false;

  function consume(line: string): void {
    if (!line.trim()) {
      return;
    }
    let chunk: ChatChunk;
    try {
      chunk = JSON.parse(line) as ChatChunk;
    } catch {
      // Línea no-JSON (raro en Ollama) — la ignoramos.
      return;
    }
    lastChunk = chunk;
    const msg = chunk.message;
    if (msg?.thinking) {
      thinking += msg.thinking;
      handlers.onThinking(msg.thinking, thinking);
    }
    if (msg?.content) {
      content += msg.content;
      handlers.onContent(msg.content, content);
    }
  }

  function flush(): void {
    const buffer = xhr.responseText;
    const lastNl = buffer.lastIndexOf('\n');
    if (lastNl < processedLen) {
      return;
    }
    const slice = buffer.slice(processedLen, lastNl);
    processedLen = lastNl + 1;
    for (const line of slice.split('\n')) {
      consume(line);
    }
  }

  xhr.onprogress = () => {
    if (aborted) {
      return;
    }
    flush();
  };

  xhr.onload = () => {
    if (aborted) {
      return;
    }
    flush();
    // Residuo final sin newline.
    const tail = xhr.responseText.slice(processedLen).trim();
    if (tail) {
      consume(tail);
      processedLen = xhr.responseText.length;
    }
    if (xhr.status < 200 || xhr.status >= 300) {
      handlers.onError(
        new Error(`Ollama /api/chat → HTTP ${xhr.status}`),
      );
      return;
    }
    handlers.onDone({
      content,
      thinking,
      inputTokens: lastChunk?.prompt_eval_count ?? 0,
      outputTokens: lastChunk?.eval_count ?? 0,
      evalDurationNs: lastChunk?.eval_duration ?? 0,
      doneReason: lastChunk?.done_reason ?? 'stop',
    });
  };

  xhr.onerror = () => {
    if (aborted) {
      return;
    }
    handlers.onError(new Error('Network error contacting Ollama.'));
  };

  xhr.ontimeout = () => {
    if (aborted) {
      return;
    }
    handlers.onError(new Error('Ollama timed out.'));
  };

  xhr.timeout = OLLAMA_TIMEOUT_MS;
  xhr.open('POST', joinUrl(baseUrl, '/api/chat'));
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify({ ...req, stream: true }));

  return {
    cancel: () => {
      aborted = true;
      try {
        xhr.abort();
      } catch {
        // ignore — el XHR ya estaba cerrado.
      }
    },
  };
}

/* ============================================================================
 * MODELOS
 * ============================================================================ */

/**
 * Lista los modelos locales (``GET /api/tags``).
 *
 * Inputs:
 * -------
 * baseUrl : string
 *
 * Returns:
 * --------
 * Promise<string[]>
 *     Nombres tal como aparecen en ``ollama list`` (ej.
 *     ``llama3``, ``qwen3.5:35b-a3b``).
 */
export async function listModels(baseUrl: string): Promise<string[]> {
  const resp = await fetchWithTimeout(
    joinUrl(baseUrl, '/api/tags'),
    { method: 'GET' },
    OLLAMA_TIMEOUT_MS,
  );
  if (!resp.ok) {
    throw new Error(`Ollama /api/tags → HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as OllamaTagsResponse;
  return (data.models ?? []).map((m) => m.name);
}

/**
 * Lee la metadata del Modelfile para extraer ``num_ctx``.
 *
 * Description:
 * ------------
 * Ollama devuelve ``parameters`` como texto crudo (``"num_ctx
 * 8192\nstop ..."``). Lo parseamos línea por línea buscando la
 * fila ``num_ctx``. Si no aparece o falla la request, devuelve
 * ``null`` (la UI muestra ``?`` en lugar del total).
 *
 * Inputs:
 * -------
 * baseUrl : string
 * model : string
 *
 * Returns:
 * --------
 * Promise<number | null>
 */
export async function showModelNumCtx(
  baseUrl: string,
  model: string,
): Promise<number | null> {
  try {
    const resp = await fetchWithTimeout(
      joinUrl(baseUrl, '/api/show'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model }),
      },
      OLLAMA_TIMEOUT_MS,
    );
    if (!resp.ok) {
      return null;
    }
    const data = (await resp.json()) as OllamaShowResponse;
    const params = data.parameters ?? '';
    for (const line of params.split('\n')) {
      const [key, value] = line.trim().split(/\s+/, 2);
      if (key === 'num_ctx' && value) {
        const n = parseInt(value, 10);
        return Number.isFinite(n) ? n : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}
