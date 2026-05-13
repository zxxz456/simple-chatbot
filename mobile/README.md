# libre-chat-mobile

Cliente móvil (React Native bare 0.83 + TypeScript) para chatear con
modelos locales servidos por [Ollama](https://ollama.com). La app
**no tiene DB local**: toda la persistencia (sesiones, mensajes,
personajes, resúmenes) vive en SQLite en la PC y se accede vía
[`libre-chat-server`](../SERVER.md) (FastAPI, puerto 8765). Las
respuestas del modelo van directo del móvil a Ollama (HTTP
streaming); el server sólo orquesta lectura/escritura del historial.

## Estado

v0.0.x funcional. Flujo completo de chat (streaming token-a-token),
multi-personaje en una misma escena, compresión de contexto con
resúmenes, gestión de sesiones y personajes desde la UI. Los
proyectos nativos `android/` y `ios/` ya están generados — no hace
falta `init`, sólo instalar dependencias y correr.

## Stack

| Tecnología | Versión | Para qué |
|---|---|---|
| React Native | 0.83.1 | Framework, bare CLI (no Expo managed) |
| React | 19.2.0 | UI |
| TypeScript | 5.8 | Tipado |
| Zustand | 5.0 | Estado (`settings-store`, `chat-store`, `characters-cache`) |
| React Navigation | 7.x | Native stack (`@react-navigation/native` + `native-stack`) |
| react-native-safe-area-context | 5.x | Insets del notch / barra |
| react-native-screens | 4.x | Backend nativo del navigator |
| @react-native-async-storage/async-storage | 2.x | Persistencia de preferencias |

> El móvil **no** carga SQLite local — eso vive en el server. Tampoco
> se usa `op-sqlite` ni `uuid` por ahora.

## Setup

```bash
cd mobile
yarn install            # o npm install
cd ios && pod install   # sólo macOS
cd ..

# Run
yarn android            # o yarn ios
```

Antes de abrir la app necesitas:

1. **Ollama** corriendo en la PC. Si vas a usar dispositivo físico,
   arráncalo con `OLLAMA_HOST=0.0.0.0:11434` para que escuche en la
   LAN.
2. **`libre-chat-server`** corriendo (ver [SERVER.md](../SERVER.md)).
   Es el FastAPI que expone la SQLite del CLI por HTTP en `:8765`.
   Sin él la app no puede listar/crear sesiones.
3. Ambas URLs configuradas en **Ajustes** dentro de la app:
   - *URL de Ollama* (default `http://10.0.2.2:11434` para emulador
     Android, `http://localhost:11434` para iOS Simulator, IP LAN
     para dispositivo físico).
   - *URL del server libre-chat* (mismo patrón, puerto `8765`).

## Estructura

```
mobile/
├── App.tsx                       Bootstrap del settings store + monta el navigator
├── index.js                      Entry point (AppRegistry)
├── app.json                      Nombre de la app
├── babel.config.js               @react-native/babel-preset + alias @/*
├── metro.config.js
├── tsconfig.json                 Paths @/* → ./src/*
├── package.json
├── android/   ios/               Proyectos nativos generados (bare)
└── src/
    ├── constants/
    │   ├── theme.ts              Colores, spacing, radii, sizes, tipografía
    │   ├── config.ts             Defaults (Ollama URL, API URL, modelo, temperatura…)
    │   └── character-palette.ts  Colores predefinidos para avatares de personajes
    ├── types/
    │   ├── ollama.ts             ChatRequest, ChatChunk, ChatResult, etc.
    │   ├── db.ts                 ChatSession, ChatMessageRow, Character
    │   └── navigation.ts         RootStackParamList
    ├── services/
    │   ├── api.ts                Cliente HTTP de libre-chat-server (sesiones, mensajes, personajes, resúmenes)
    │   ├── ollama.ts             chat() streaming NDJSON, listModels(), showModelNumCtx()
    │   └── compression.ts        Resumen de mensajes antiguos para no saturar el contexto
    ├── store/
    │   ├── settings-store.ts     zustand + AsyncStorage (preferencias)
    │   ├── chat-store.ts         zustand (sesión activa en memoria)
    │   └── characters-cache.ts   zustand (id → Character, en memoria)
    ├── hooks/
    │   ├── useChat.ts            useSendTurn() — orquesta un turno (single o multi-personaje)
    │   ├── useSessions.ts        useSessionList / useOpenSession / renameAndSync / deleteAndSync
    │   └── useCharacters.ts      useCharacterList()
    ├── utils/
    │   ├── error.ts              errorMessage / networkErrorMessage / saveErrorMessage
    │   └── format.ts             formatDate()
    ├── components/
    │   ├── MessageBubble.tsx     Mensaje user/assistant/personaje
    │   ├── ThinkingBlock.tsx     Bloque colapsable de razonamiento
    │   ├── RichText.tsx          Render de markdown ligero
    │   ├── Composer.tsx          Input + botón enviar (long-press = picker)
    │   ├── ContextBar.tsx        Medidor de tokens used/total + botones comprimir
    │   ├── CharacterChip.tsx     Chip de personaje activo en la chip-bar del chat
    │   ├── CharacterPickerModal.tsx Modal de selección de personajes activos
    │   ├── SpeakerPickerSheet.tsx Bottom sheet "¿quién responde este turno?"
    │   ├── Field.tsx             Wrapper label + input para formularios
    │   ├── EditScreenHeader.tsx  Header común de pantallas de edición
    │   ├── FloatingActionButton.tsx FAB compartido
    │   └── EmptyState.tsx        Emoji + título + cuerpo para estados vacíos / error
    ├── screens/
    │   ├── SplashScreen.tsx
    │   ├── SessionsScreen.tsx       Lista de sesiones
    │   ├── ChatScreen.tsx           Conversación activa
    │   ├── SessionEditScreen.tsx    Editar título + escena
    │   ├── CharactersScreen.tsx     Lista de personajes
    │   ├── CharacterEditScreen.tsx  Crear / editar un personaje
    │   └── SettingsScreen.tsx       Editor de preferencias + detector de modelos
    └── navigation/
        └── AppNavigator.tsx      Stack raíz
```

## Cómo se conecta con el server

El esquema SQL **no vive en la app** — vive en
[`../src/libre_chat/`](../src/libre_chat/) (servidor + CLI), y la app
lo consume exclusivamente por HTTP. Ver [SERVER.md](../SERVER.md)
para arranque/operación del FastAPI.

Endpoints que la app usa (todos vía `src/services/api.ts`):

- `GET/POST /sessions`, `GET/PATCH/DELETE /sessions/{id}`
- `GET /sessions/{id}/full` — snapshot completo al abrir la sesión
- `POST /sessions/{id}/messages` — append turno
- `POST /sessions/{id}/rewind/{message_id}` — borrar desde mensaje
- `POST /sessions/{id}/summary` / `DELETE /sessions/{id}/summary`
- `GET/POST /characters`, `PATCH/DELETE /characters/{id}`
- `PUT /sessions/{id}/characters` — set personajes activos

Las respuestas del LLM van directo de móvil ↔ Ollama (streaming
NDJSON, ver `services/ollama.ts`). El server sólo recibe el
mensaje final + stats.

## Roadmap

- [x] Multi-personaje en una misma escena (chip-bar + picker + reglas de roleplay inyectadas).
- [x] Compresión de contexto con resúmenes (manual desde la ContextBar).
- [x] Barra de contexto `used/total` tokens en el chat.
- [x] Long-press en mensaje → rewind (borrar desde ahí).
- [x] Picker de modelos vía `listModels()` en Settings.
- [x] Streaming real NDJSON token a token.
- [x] Auto-título único con dedup (lado server).
- [ ] Compresión automática al pasar cierto umbral de contexto.
- [ ] Atajos de copia / regenerar mensaje (long-press menu ampliado).
- [ ] Búsqueda en sesiones / mensajes.
- [ ] Tema oscuro.

## Convenciones

- Headers de módulo con `Description`, `Metadata`, `History` (mismo
  estilo que el resto del repo).
- Imports vía alias `@/*` (configurado en `babel.config.js` y
  `tsconfig.json`).
- Componentes nombrados (`export function`), nunca default.
- Lógica común en `components/`, `hooks/`, `utils/` antes que
  duplicar en pantallas.
- Errores `unknown` se normalizan con los helpers de `utils/error.ts`
  (`errorMessage`, `networkErrorMessage`, `saveErrorMessage`).

## Licencia

MIT — alineada con el repo padre.
