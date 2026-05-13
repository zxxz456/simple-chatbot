/**
 * characters-cache.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Cache global en memoria de personajes conocidos, keyed por id.
 * Se llena conforme la app va recibiendo personajes del servidor
 * (listado, sesión cargada, edición). Sirve para que la UI pueda
 * resolver ``character_id`` → ``Character`` sin hacer un fetch
 * extra por mensaje.
 *
 * Si un personaje fue borrado del server, su entrada queda
 * "huérfana" hasta la siguiente listada — los mensajes históricos
 * con ese id seguirán renderizándose con el avatar/color cacheado.
 * Aceptable para v1.
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

import { create } from 'zustand';

import type { Character } from '@/types/db';

interface CharactersCacheState {
  /** Mapa ``id → Character`` con todos los personajes conocidos. */
  byId: Record<number, Character>;

  /**
   * Inserta o actualiza los personajes recibidos manteniendo el
   * resto del cache intacto. Útil tras ``GET /characters/{id}`` o
   * tras un upsert del editor (un solo personaje).
   */
  upsert: (chars: Character[]) => void;

  /**
   * Elimina un personaje del cache. No toca el server — el caller
   * (``CharactersScreen``) ya hizo el ``DELETE`` antes.
   */
  remove: (id: number) => void;

  /**
   * Reemplaza el cache entero con el listado dado. Pensado para el
   * resultado de ``GET /characters`` (lista canónica del server):
   * descarta entradas huérfanas que ya no existen.
   */
  replace: (chars: Character[]) => void;
}

/**
 * Cache global de personajes (in-memory, sin persistencia).
 *
 * Uso:
 * ------------
 * .. code-block:: tsx
 *
 *     // En un componente — suscripción reactiva al mapa:
 *     const byId = useCharactersCache((s) => s.byId);
 *     // Mutaciones:
 *     useCharactersCache.getState().upsert([character]);
 *
 * Se rellena desde ``useCharacterList`` (lista) y ``useOpenSession``
 * (personajes referenciados por una sesión).
 */
export const useCharactersCache = create<CharactersCacheState>((set) => ({
  byId: {},
  upsert: (chars) =>
    set((s) => {
      const next = { ...s.byId };
      for (const c of chars) {
        next[c.id] = c;
      }
      return { byId: next };
    }),
  remove: (id) =>
    set((s) => {
      const next = { ...s.byId };
      delete next[id];
      return { byId: next };
    }),
  replace: (chars) =>
    set(() => {
      const next: Record<number, Character> = {};
      for (const c of chars) {
        next[c.id] = c;
      }
      return { byId: next };
    }),
}));
