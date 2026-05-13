/**
 * format.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Helpers de formato compartidos por la UI. Por ahora sólo
 * ``formatDate``: muestra HH:MM si la fecha es hoy, fecha local
 * en otro caso — patrón usado por la lista de sesiones.
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
 * Formatea una fecha ISO al estilo "lista de chats":
 *
 *   - Si es hoy:  ``HH:MM``
 *   - Si no:      fecha local (``dd/mm/yyyy`` u equivalente del locale).
 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString();
}
