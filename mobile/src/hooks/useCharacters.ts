/**
 * useCharacters.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Hook para listar personajes desde el server. Sincroniza la
 * ``characters-cache`` con cada respuesta para que el resto de
 * la UI pueda resolver ``character_id`` → ``Character`` sin
 * fetch extra.
 *
 *
 * Metadata:
 * ----------
 * - Author: zxxz6 (Bryan Violante Arriaga)
 * - Version: 0.0.2
 * - License: MIT
 *
 *
 * History:
 * ------------
 * Author      Date            Description
 * zxxz6       13/05/2026      Migrado a HTTP (libre-chat-server)
 * zxxz6       13/05/2026      Creation
 *
 * @format
 */

import { useEffect, useState } from 'react';

import * as api from '@/services/api';
import { useCharactersCache } from '@/store/characters-cache';
import type { Character } from '@/types/db';
import { errorMessage } from '@/utils/error';

export interface UseCharacterListResult {
  /** Lista actual de personajes recibida del server (vacía hasta el primer fetch ok). */
  characters: Character[];
  /** ``true`` mientras hay un fetch en vuelo. */
  loading: boolean;
  /** Mensaje de error normalizado del último fetch fallido, ``null`` si ok. */
  error: string | null;
}

/**
 * Lista los personajes definidos en el server vía ``GET /characters``.
 *
 * Description:
 * ------------
 * En cada fetch exitoso refresca también la ``characters-cache``
 * con ``replace``: el resto de la UI (mensajes, modales) lee desde
 * ahí sin disparar más fetches.
 *
 * Params:
 * ------------
 * - ``trigger``: número arbitrario; cambiarlo dispara un re-fetch
 *   (útil tras crear/borrar un personaje desde el caller).
 *
 * Returns:
 * ------------
 * ``{ characters, loading, error }`` con los tres flags clásicos.
 */
export function useCharacterList(trigger = 0): UseCharacterListResult {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const replaceCache = useCharactersCache((s) => s.replace);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .listCharacters()
      .then((rows) => {
        if (!cancelled) {
          setCharacters(rows);
          replaceCache(rows);
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
  }, [trigger, replaceCache]);

  return { characters, loading, error };
}
