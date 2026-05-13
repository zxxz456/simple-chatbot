/**
 * error.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Helpers para normalizar errores ``unknown`` capturados de
 * ``catch (err)`` a un string legible. Tres niveles:
 *
 *   - ``errorMessage``       Mensaje crudo o ``String(err)``.
 *   - ``networkErrorMessage`` Igual pero con fallback ``'error de red'``
 *                              cuando el error no es una ``Error``
 *                              instance (típico de promesas rechazadas
 *                              con strings o undefined).
 *   - ``saveErrorMessage``    Reusa ``errorMessage`` y mapea ``409`` a
 *                              un texto custom ("Ya existe otro …") —
 *                              útil en las pantallas de edición que
 *                              chocan con la unicidad del backend.
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
 * zxxz6       13/05/2026      Creation
 *
 * @format
 */

/**
 * Mensaje del error o ``String(err)`` como fallback.
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Igual que ``errorMessage`` pero devuelve ``'error de red'`` si el
 * error no trae mensaje (común en alertas de fallos al borrar /
 * sincronizar contra el server).
 */
export function networkErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'error de red';
}

/**
 * Mapea ``409 Conflict`` a un mensaje custom (los endpoints del
 * backend usan 409 para violaciones de unicidad: nombres de
 * personaje, títulos de sesión, etc.). Para otros casos cae a
 * ``errorMessage`` y, si tampoco hay nada, a ``fallback``.
 */
export function saveErrorMessage(
  err: unknown,
  conflictMessage: string,
  fallback = 'No se pudo guardar.',
): string {
  if (err instanceof Error) {
    if (err.message.includes('409')) {
      return conflictMessage;
    }
    return err.message;
  }
  return fallback;
}
