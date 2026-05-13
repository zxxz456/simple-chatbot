/**
 * ollama.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Tipos TypeScript de los payloads de la REST API de Ollama
 * (``/api/chat``, ``/api/tags``, ``/api/show``) que la app
 * consume.
 *
 * Referencia oficial:
 * https://github.com/ollama/ollama/blob/main/docs/api.md
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
 * zxxz6       21/04/2026      Creation
 *
 * @format
 */

/**
 * Rol de un mensaje en el historial enviado a ``/api/chat``.
 */
export type Role = 'system' | 'user' | 'assistant';

/**
 * Un mensaje del historial enviado al modelo.
 */
export interface ChatMessage {
  role: Role;
  content: string;
}

/**
 * Modo de thinking. ``false``/``true`` para modelos binarios,
 * ``'low' | 'medium' | 'high'`` para modelos con niveles.
 */
export type ThinkMode = boolean | 'low' | 'medium' | 'high';

/**
 * Opciones del modelo (``options`` en la API de Ollama). Sólo
 * exponemos las que la app maneja; el campo es ``Partial`` por
 * si en el futuro se agregan otras.
 */
export interface OllamaOptions {
  temperature?: number;
  num_predict?: number;
  num_ctx?: number;
}

/**
 * Request body de ``POST /api/chat``.
 */
export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  think?: ThinkMode;
  options?: OllamaOptions;
}

/**
 * Un chunk de la respuesta streaming de ``/api/chat``.
 *
 * Description:
 * ------------
 * Cada chunk trae un ``message`` parcial. El último chunk
 * adicional incluye los contadores de tokens y duraciones; en
 * los intermedios esos campos vienen ``undefined``.
 */
export interface ChatChunk {
  model: string;
  created_at: string;
  message: {
    role: Role;
    content: string;
    /** Sólo presente si ``think`` está activo. */
    thinking?: string;
  };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Resultado agregado de un turno (lo que la UI usa después de
 * consumir todos los chunks o tras una llamada no-streaming).
 */
export interface ChatResult {
  content: string;
  thinking: string;
  inputTokens: number;
  outputTokens: number;
  evalDurationNs: number;
  doneReason: string;
}

/**
 * Item de ``GET /api/tags`` (lista de modelos locales).
 */
export interface OllamaTag {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaTagsResponse {
  models: OllamaTag[];
}

/**
 * Respuesta de ``POST /api/show`` (metadata del Modelfile).
 * Sólo tipamos ``parameters`` porque es lo único que la app
 * lee (para extraer ``num_ctx``).
 */
export interface OllamaShowResponse {
  parameters?: string;
}
