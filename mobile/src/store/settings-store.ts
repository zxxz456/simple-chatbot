/**
 * settings-store.ts
 * ========================
 *
 *
 * Description:
 * ------------
 * Store global de preferencias de la app con
 * `zustand <https://zustand.docs.pmnd.rs/>`_.
 *
 * Mantiene la fuente de verdad en memoria de:
 *
 *   * ``baseUrl``       — URL del servidor Ollama.
 *   * ``model``         — modelo por defecto.
 *   * ``systemPrompt``  — prompt de sistema usado al crear sesiones
 *                         nuevas.
 *   * ``temperature`` / ``maxTokens`` / ``numCtx`` / ``think`` —
 *                         opciones de generación.
 *   * ``isHydrated``    — ``true`` cuando ``bootstrap()`` leyó las
 *                         preferencias de AsyncStorage. Las
 *                         pantallas esperan a este flag antes de
 *                         decidir el routing inicial.
 *
 * Por qué zustand (mismo razonamiento que ``checa/mobile``):
 *
 *   * Cliente de Ollama (``services/ollama.ts``) lee del store
 *     fuera del árbol de React; con Context no se puede.
 *   * ``getState()`` síncrono cubre ese caso sin necesidad de un
 *     singleton paralelo.
 *
 * Las acciones que persisten (``setBaseUrl``, ``setModel``, ...)
 * son ``async`` porque escriben a AsyncStorage como efecto
 * secundario antes de actualizar el estado.
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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import {
  DEFAULT_API_URL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  DEFAULT_OLLAMA_URL,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
  DEFAULT_THINK,
} from '@/constants/config';
import type { ThinkMode } from '@/types/ollama';

const STORAGE_KEY = '@libre-chat/settings/v1';

/**
 * Forma serializable del store (lo que se guarda en AsyncStorage).
 */
interface PersistedSettings {
  baseUrl: string;
  apiUrl: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  numCtx: number | null;
  think: ThinkMode;
}

/**
 * Forma del store completo: persistido + acciones + ``isHydrated``.
 */
export interface SettingsState extends PersistedSettings {
  isHydrated: boolean;

  bootstrap: () => Promise<void>;
  setBaseUrl: (url: string) => Promise<void>;
  setApiUrl: (url: string) => Promise<void>;
  setModel: (model: string) => Promise<void>;
  setSystemPrompt: (prompt: string) => Promise<void>;
  setTemperature: (t: number) => Promise<void>;
  setMaxTokens: (n: number) => Promise<void>;
  setNumCtx: (n: number | null) => Promise<void>;
  setThink: (t: ThinkMode) => Promise<void>;
}

const DEFAULTS: PersistedSettings = {
  baseUrl: DEFAULT_OLLAMA_URL,
  apiUrl: DEFAULT_API_URL,
  model: DEFAULT_MODEL,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: DEFAULT_TEMPERATURE,
  maxTokens: DEFAULT_MAX_TOKENS,
  numCtx: null,
  think: DEFAULT_THINK,
};

/**
 * Persiste el snapshot actual del store en AsyncStorage.
 *
 * Description:
 * ------------
 * Helper interno: nada externo debería llamarlo. Las acciones
 * llaman a ``persist`` después de actualizar el estado.
 */
async function persist(snapshot: PersistedSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

/**
 * Hook + ``getState()`` del store de settings.
 *
 * Uso:
 * ------------
 * .. code-block:: tsx
 *
 *     const baseUrl = useSettingsStore((s) => s.baseUrl);
 *     // o, fuera del árbol de React:
 *     const baseUrl = useSettingsStore.getState().baseUrl;
 */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  isHydrated: false,

  /**
   * Carga el estado persistido de AsyncStorage.
   *
   * Description:
   * ------------
   * Idempotente: si ya está hidratado, no vuelve a leer. Cualquier
   * clave faltante se rellena con el default — útil cuando se
   * agreguen settings nuevas en versiones futuras.
   */
  bootstrap: async () => {
    if (get().isHydrated) {
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
        set({ ...DEFAULTS, ...parsed, isHydrated: true });
        return;
      }
    } catch {
      // Storage corrupto: caemos a defaults sin romper el arranque.
    }
    set({ isHydrated: true });
  },

  setBaseUrl: async (url) => {
    set({ baseUrl: url });
    await persist({ ...snapshotOf(get()), baseUrl: url });
  },
  setApiUrl: async (url) => {
    set({ apiUrl: url });
    await persist({ ...snapshotOf(get()), apiUrl: url });
  },
  setModel: async (model) => {
    set({ model });
    await persist({ ...snapshotOf(get()), model });
  },
  setSystemPrompt: async (systemPrompt) => {
    set({ systemPrompt });
    await persist({ ...snapshotOf(get()), systemPrompt });
  },
  setTemperature: async (temperature) => {
    set({ temperature });
    await persist({ ...snapshotOf(get()), temperature });
  },
  setMaxTokens: async (maxTokens) => {
    set({ maxTokens });
    await persist({ ...snapshotOf(get()), maxTokens });
  },
  setNumCtx: async (numCtx) => {
    set({ numCtx });
    await persist({ ...snapshotOf(get()), numCtx });
  },
  setThink: async (think) => {
    set({ think });
    await persist({ ...snapshotOf(get()), think });
  },
}));

/**
 * Extrae la parte serializable del state.
 */
function snapshotOf(state: SettingsState): PersistedSettings {
  return {
    baseUrl: state.baseUrl,
    apiUrl: state.apiUrl,
    model: state.model,
    systemPrompt: state.systemPrompt,
    temperature: state.temperature,
    maxTokens: state.maxTokens,
    numCtx: state.numCtx,
    think: state.think,
  };
}
