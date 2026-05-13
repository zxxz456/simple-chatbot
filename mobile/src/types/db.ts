/**
 * db.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Tipos de las filas persistidas localmente. Espejo del esquema
 * del CLI Python (``src/libre_chat/models.py``) en lo que aplica,
 * más las entidades específicas del móvil:
 *
 *   * ``ChatSession``     — conversación con metadata.
 *   * ``ChatMessageRow``  — turno individual; cuando el rol es
 *                            ``assistant`` y la sesión tiene
 *                            personajes activos, ``character_id``
 *                            apunta al personaje que emitió la
 *                            respuesta (NULL en modo clásico).
 *   * ``Character``       — perfil con su propio ``system_prompt``,
 *                            avatar y color. Una sesión puede
 *                            tener N personajes asociados a la vez.
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
 * zxxz6       13/05/2026      Added Character + character_id on messages
 * zxxz6       21/04/2026      Creation
 *
 * @format
 */

import type { Role } from '@/types/ollama';

/**
 * Una sesión de conversación.
 *
 * Description:
 * ------------
 * Además del título y del system_prompt de modo clásico, la
 * sesión tiene un campo ``scene`` (escenario / contexto) que se
 * apila sobre el system_prompt de cada hablante en cada turno,
 * para que todos los participantes (modo clásico o personajes)
 * compartan el mismo encuadre narrativo.
 */
export interface ChatSession {
  id: number;
  /** ISO 8601, UTC. */
  created_at: string;
  /** ISO 8601, UTC. */
  updated_at: string;
  /** Título único en la tabla (auto-derivado del primer mensaje). */
  title: string | null;
  model: string;
  system_prompt: string;
  /**
   * Escenario donde transcurre la conversación. Texto libre
   * multilínea (lugar, época, situación, reglas). String vacío
   * = sin escena explícita.
   */
  scene: string;
  /**
   * Resumen comprimido de la conversación previa. Cuando está
   * presente se inyecta al system prompt en cada turno; los
   * mensajes con id <= ``summary_upto_message_id`` se omiten del
   * contexto enviado al modelo (pero siguen visibles en la UI).
   */
  summary: string;
  summary_upto_message_id: number | null;
}

/**
 * Un mensaje dentro de una ``ChatSession``.
 */
export interface ChatMessageRow {
  id: number;
  session_id: number;
  role: Role;
  content: string;
  /** ISO 8601, UTC. */
  created_at: string;
  /** Sólo en filas ``assistant``. */
  input_tokens: number | null;
  output_tokens: number | null;
  eval_duration_ns: number | null;
  /**
   * Personaje que emitió esta respuesta. NULL en el modo clásico
   * (sin personajes activos) y en todos los mensajes ``user``.
   */
  character_id: number | null;
}

/**
 * Perfil con system_prompt propio, reutilizable entre sesiones.
 */
export interface Character {
  id: number;
  /** Único en la app. */
  name: string;
  /** 1-2 caracteres o emoji que se renderea en el avatar circular. */
  avatar: string;
  /** Hex de la paleta de personajes (``constants/character-palette``). */
  color: string;
  system_prompt: string;
  /** ISO 8601, UTC. */
  created_at: string;
  /** ISO 8601, UTC. */
  updated_at: string;
}
