/**
 * compression.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Helpers de compresión (rolling summary) de la conversación:
 *
 *   * ``buildTranscript`` formatea los mensajes a comprimir como
 *     un texto plano "Usuario: ... \nNombre: ..." para alimentar
 *     al modelo.
 *   * ``summarizeMessages`` lanza un ``ollama.chat`` no-streaming
 *     con un prompt que pide resumir preservando personajes,
 *     escena, hechos, decisiones. Devuelve el texto plano del
 *     resumen.
 *
 * El persistir el resumen (``api.setSummary``) y refrescar el
 * store lo hace el caller (ChatScreen).
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
 * zxxz6       13/05/2026      Creation (rolling summary)
 *
 * @format
 */

import { chat } from '@/services/ollama';
import type { UiMessage } from '@/store/chat-store';
import type { Character } from '@/types/db';

/**
 * Cantidad de mensajes recientes que se mantienen SIN comprimir.
 * Garantiza continuidad fina al pasar de mensajes a resumen.
 */
export const KEEP_RECENT_MESSAGES = 4;

const SUMMARY_PROMPT = `Vas a resumir la siguiente conversación entre el usuario y uno o más personajes. Preserva con detalle:
- Quiénes son los personajes, sus actitudes, estilos de habla y rasgos de personalidad
- El escenario, época, lugar y reglas implícitas de la situación
- Hechos importantes ya establecidos (qué pasó, qué decidió cada parte, qué se reveló)
- Conflictos abiertos, promesas hechas, secretos conocidos por cada parte
- El estado emocional actual de cada participante

Sé conciso pero exhaustivo. NO inventes detalles que no aparezcan. Devuelve SOLO el resumen, en español, sin preámbulo ni meta-comentario.

Conversación:
`;

/**
 * Convierte una secuencia de mensajes a transcript plano.
 *
 * Description:
 * ------------
 * Cada mensaje aparece como ``Etiqueta: contenido``. La etiqueta
 * para ``user`` es ``Usuario`` y para ``assistant`` es el nombre
 * del personaje (si existe en el map) o ``Asistente`` por
 * defecto.
 */
export function buildTranscript(
  messages: UiMessage[],
  charactersById: Map<number, Character>,
): string {
  const lines: string[] = [];
  for (const m of messages) {
    let label: string;
    if (m.role === 'user') {
      label = 'Usuario';
    } else if (m.characterId != null && charactersById.has(m.characterId)) {
      label = charactersById.get(m.characterId)!.name;
    } else {
      label = 'Asistente';
    }
    lines.push(`${label}: ${m.content}`);
  }
  return lines.join('\n\n');
}

/**
 * Llama a Ollama (no-streaming) con el prompt de resumen.
 *
 * Inputs:
 * -------
 * baseUrl : string
 *     URL del servidor Ollama.
 * model : string
 *     Modelo a usar para resumir (idealmente el mismo de la
 *     conversación para mantener estilo y vocabulario).
 * transcript : string
 *     Texto plano de la conversación a comprimir.
 *
 * Returns:
 * --------
 * Promise<string>
 *     El resumen generado.
 */
export async function summarizeMessages(
  baseUrl: string,
  model: string,
  transcript: string,
): Promise<string> {
  const result = await chat(baseUrl, {
    model,
    messages: [
      {
        role: 'user',
        content: `${SUMMARY_PROMPT}${transcript}`,
      },
    ],
    options: { temperature: 0.3, num_predict: 1024 },
  });
  return result.content.trim();
}
