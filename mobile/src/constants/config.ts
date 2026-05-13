/**
 * config.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Defaults de configuración de la app. Cualquiera de estos
 * valores puede ser sobreescrito en runtime desde
 * ``SettingsScreen`` (persistido vía ``settings-store``).
 *
 * El equivalente en el CLI Python vive en ``config.yml`` del
 * proyecto raíz; los nombres se mantienen alineados a propósito
 * para que sea trivial migrar prompts entre las dos plataformas.
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
 * URL base por defecto del servidor Ollama.
 *
 * Description:
 * ------------
 * En un emulador Android, ``10.0.2.2`` resuelve al ``localhost``
 * de la máquina host; en iOS Simulator, ``localhost`` funciona
 * directamente. En dispositivo físico hay que usar la IP LAN
 * de la PC (ej. ``http://192.168.1.42:11434``) y arrancar
 * Ollama con ``OLLAMA_HOST=0.0.0.0:11434``.
 */
export const DEFAULT_OLLAMA_URL = 'http://10.0.2.2:11434';

/**
 * URL del servidor libre-chat (FastAPI sobre la SQLite del CLI).
 *
 * Description:
 * ------------
 * El móvil **no** tiene DB local — todas las sesiones, mensajes
 * y personajes viven en SQLite en la PC servidor y se acceden por
 * esta API. Default apunta al alias del host desde emulador
 * Android; en dispositivo físico hay que poner la IP LAN.
 */
export const DEFAULT_API_URL = 'http://10.0.2.2:8765';

/**
 * Defaults de generación. Espejo del CLI ``config.yml``.
 */
export const DEFAULT_MODEL = 'llama3';
export const DEFAULT_SYSTEM_PROMPT = '';
export const DEFAULT_TEMPERATURE = 0.8;
export const DEFAULT_MAX_TOKENS = 2048;
export const DEFAULT_THINK: boolean | 'low' | 'medium' | 'high' = false;

/**
 * Timeout (ms) para llamadas HTTP a Ollama. Generosos porque la
 * primera carga de un modelo grande puede tardar.
 */
export const OLLAMA_TIMEOUT_MS = 120_000;

/**
 * Límite de caracteres para auto-generar el título de una sesión
 * a partir del primer mensaje del usuario.
 */
export const TITLE_LIMIT = 60;
