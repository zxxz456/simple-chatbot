# libre-chat

Stack completo para conversar con LLMs locales servidos por
[Ollama](https://ollama.com), con tres piezas que comparten la misma
base SQLite:

1. **CLI** (`libre-chat`) — chatbot multi-turno en terminal con
   streaming, thinking, sesiones persistentes, modo incógnito.
2. **Server HTTP** (`libre-chat-server`) — FastAPI sobre la misma DB,
   pensado para que clientes remotos (la app móvil) la consuman sin
   DB local.
3. **App móvil** ([`mobile/`](mobile/)) — React Native 0.83 (bare,
   TypeScript). Cliente HTTP puro: chat con burbujas tipo WhatsApp,
   personajes con system prompt propio, escenas, compresión de
   contexto, rebobinar mensajes.

```
                      ┌─────────────────┐
   libre-chat (CLI) ──┤                 │
                      │  history.db     │
   FastAPI server ────┤  (SQLite)       │
        ▲             └─────────────────┘
        │ HTTP :8765
   mobile app ── Ollama (streaming, port 11434)
```

CLI y server pegan al SQLite directo (mismo `make_engine`). El móvil
no tiene DB local: pide todo por HTTP al server, y para generar
respuestas hace streaming directo contra Ollama en la misma red.

---

## Tabla de contenidos

- [CLI](#cli)
- [HTTP Server](#http-server)
- [Mobile app](#mobile-app)
- [Configuración](#configuración)
- [Storage / esquema SQLite](#storage--esquema-sqlite)
- [Project layout](#project-layout)
- [Requirements](#requirements)
- [Install](#install)
- [Roadmap](#roadmap)
- [License](#license)

---

## CLI

### Features

- **Streaming**, incluyendo un bloque `[thinking]` atenuado para
  modelos con reasoning tokens (`--think`).
- **SQLite-backed history** (vía SQLModel): cada sesión y mensaje a
  disco; resume por id o título, o lista desde el CLI.
- **Incognito mode** (`--incognito`): mismo UX pero engine en RAM,
  nada toca disco.
- **Context-aware UI**: cada turno cierra con un separador gris que
  muestra `used/total` tokens y el % del context window.
- **Modelfile-aware**: respeta `PARAMETER num_ctx` del Modelfile por
  defecto; override con `--num-ctx`.
- **Token accounting** en vivo: `/tokens` con cumulative input/output
  más `tok/s` calculado de los timing fields de Ollama.
- **Títulos únicos** auto-derivados del primer mensaje (con `(2)`,
  `(3)`… de deduplicación) y editables con `/rename`.
- **Line-editing**: flechas / Home / End / Ctrl+A/E en el prompt
  (recall de historial deliberadamente off).
- **Header auto-refresh** en `/rename`, `/resume`, `/new`: la status
  line se repinta y los turnos previos de la sesión se replayean.
- **Banner ANSI-Shadow** coloreado en startup.

### Uso

```bash
libre-chat -m qwen3.5:35b-a3b
libre-chat --model llama3 --temperature 0.5 --system "You are a technical assistant"
libre-chat -m gemma4-heretic --think          # enable reasoning tokens
libre-chat -m llama3 --num-ctx 16384          # override Modelfile num_ctx

libre-chat --list-sessions                    # show saved sessions, exit
libre-chat --session 3                        # resume session id 3
libre-chat --session "My research thread"     # resume by exact title
libre-chat --incognito                        # ephemeral run (in-memory DB)
```

También como módulo:

```bash
python -m libre_chat -m llama3
```

### CLI flags

| Flag                     | Default              | Description                                                      |
| ------------------------ | -------------------- | ---------------------------------------------------------------- |
| `-m`, `--model`          | `llama3`             | Ollama model name                                                |
| `-s`, `--system`         | de `config.yml`      | System prompt inicial (ignorado al hacer resume — gana el guardado) |
| `-t`, `--temperature`    | de `config.yml`      | Sampling temperature                                             |
| `--max-tokens`           | de `config.yml`      | Máximo de tokens generados por respuesta                         |
| `--num-ctx`              | `None` (Modelfile)   | Sobrescribe el context window del modelo                         |
| `--think [low/med/high]` | off                  | Enable thinking tokens (level opcional, model-dependent)         |
| `--db PATH`              | de `config.yml`      | Ruta del SQLite                                                  |
| `--session <id\|title>`  | —                    | Continuar sesión existente por id numérico o título exacto       |
| `--list-sessions`        | —                    | Imprime las sesiones guardadas y sale                            |
| `--incognito`            | off                  | DB en memoria, nada se persiste (banner muestra tag)             |
| `-V`, `--version`        | —                    | Imprime versión y sale                                           |

### Slash commands

| Comando            | Qué hace                                                                |
| ------------------ | ----------------------------------------------------------------------- |
| `/help`            | Muestra la lista de comandos                                            |
| `/clear`           | Resetea history (y limpia los mensajes de la sesión activa en DB)       |
| `/system [text]`   | Set del system prompt (o muestra el actual si no hay arg); persistido   |
| `/tokens`          | Cumulative input/output tokens + tok/s                                  |
| `/context`         | `used/total` tokens y % del context window                              |
| `/sessions`        | Lista sesiones recientes, con `*` en la activa                          |
| `/resume <id\|t>`  | Cambia a otra sesión por id o título exacto                             |
| `/rename <title>`  | Renombra la sesión actual (título único global)                         |
| `/new`             | Inicia sesión nueva sin salir del programa                              |
| `/q`, `/quit`      | Salir                                                                   |

Enter con línea vacía es no-op (no se manda turno vacío). `Ctrl+C` /
`Ctrl+D` salen limpio.

---

## HTTP Server

`libre-chat-server` expone la misma SQLite por HTTP en el puerto
**8765**, para que clientes remotos (la app móvil) la consuman sin DB
local. Reutiliza `db.make_engine` y los modelos SQLModel del CLI: las
dos piezas escriben a las mismas filas, sin sincronización a mano.

### Datos básicos

- **Comando**: `libre-chat-server` (entry point en `pyproject.toml`)
- **Ruta del binario** (típica): `/home/<user>/envs/agent/bin/libre-chat-server`
- **DB**: la misma `db_path` del CLI (ver `config.yml`)
- **Bind**: `0.0.0.0:8765` — alcanzable desde la LAN
- **Health**: `GET http://localhost:8765/health` → `{"status":"ok"}`
- **OpenAPI**: `http://localhost:8765/docs` (Swagger) y `/redoc`
- **CORS**: `*` (pensado para LAN — si se expone a Internet, poner
  reverse proxy con TLS + API key)

### Endpoints

| Método   | Ruta                                          | Qué hace                                     |
| -------- | --------------------------------------------- | -------------------------------------------- |
| `GET`    | `/health`                                     | Ping de conectividad                         |
| `GET`    | `/sessions`                                   | Lista sesiones (metadata, sin mensajes)      |
| `POST`   | `/sessions`                                   | Crea sesión                                  |
| `GET`    | `/sessions/{id}`                              | Sesión + mensajes + personajes (vista full)  |
| `PATCH`  | `/sessions/{id}`                              | Update parcial (título, escena, prompt, modelo) |
| `DELETE` | `/sessions/{id}`                              | Borra sesión + mensajes + asociaciones       |
| `POST`   | `/sessions/{id}/summary`                      | Persiste un resumen comprimido               |
| `DELETE` | `/sessions/{id}/summary`                      | Limpia el resumen activo                     |
| `GET`    | `/sessions/{id}/messages`                     | Lista mensajes en orden cronológico          |
| `POST`   | `/sessions/{id}/messages`                     | Inserta mensaje (auto-título en primer user) |
| `DELETE` | `/sessions/{id}/messages`                     | Limpia mensajes (sesión queda viva)          |
| `DELETE` | `/sessions/{id}/messages/{mid}`               | Rebobinar: borra mensaje + posteriores       |
| `GET`    | `/characters`                                 | Lista personajes (orden alfabético)          |
| `POST`   | `/characters`                                 | Crea personaje (nombre único)                |
| `PATCH`  | `/characters/{id}`                            | Actualiza (reemplazo total)                  |
| `DELETE` | `/characters/{id}`                            | Borra personaje + sus asociaciones           |
| `PUT`    | `/sessions/{id}/characters`                   | Reemplaza la lista de personajes activos     |

Contrato detallado en los docstrings de
[`src/libre_chat/server/routers/`](src/libre_chat/server/routers/) y
los schemas Pydantic en
[`src/libre_chat/server/schemas.py`](src/libre_chat/server/schemas.py).

### Arranque manual

```bash
cd /tmp && nohup libre-chat-server > /tmp/libre-chat-server.log 2>&1 < /dev/null & disown
```

- `nohup` + `< /dev/null` → sobrevive si cierras la terminal.
- `& disown` → lo desengancha del shell, no muere con `SIGHUP` al
  hacer logout.

### Aliases para `~/.bashrc`

Pegar **una sola vez** y luego `source ~/.bashrc`:

```bash
# libre-chat server
alias lcs-start='cd /tmp && nohup libre-chat-server > /tmp/libre-chat-server.log 2>&1 < /dev/null & disown'
alias lcs-stop='pkill -f libre-chat-server'
alias lcs-restart='lcs-stop; sleep 1; lcs-start'
alias lcs-log='tail -f /tmp/libre-chat-server.log'
alias lcs-status='curl -s http://localhost:8765/health || echo "down"'
```

| Alias          | Hace                                                |
| -------------- | --------------------------------------------------- |
| `lcs-start`    | Arranca el server en background                     |
| `lcs-stop`     | Mata el proceso                                     |
| `lcs-restart`  | Mata + arranca                                      |
| `lcs-status`   | Pingea `/health` (`ok` o `down`)                    |
| `lcs-log`      | `tail -f` sobre el log                              |

### Auto-reinicio con systemd (recomendado)

Servicio de usuario: se reinicia solo si crashea y arranca al login
(o siempre, si activas `linger`).

```bash
mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/libre-chat-server.service <<'EOF'
[Unit]
Description=libre-chat HTTP server
After=network.target

[Service]
ExecStart=%h/envs/agent/bin/libre-chat-server
Restart=on-failure
RestartSec=2

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now libre-chat-server
sudo loginctl enable-linger $USER
```

Operación:

```bash
systemctl --user status libre-chat-server     # ¿está corriendo?
systemctl --user restart libre-chat-server    # forzar reset
systemctl --user stop libre-chat-server       # parar
systemctl --user disable libre-chat-server    # quitar autoarranque
journalctl --user -u libre-chat-server -f     # logs en vivo
```

`loginctl enable-linger` permite que el servicio siga corriendo aun
sin login activo (útil si la PC reinicia y nadie inicia sesión
gráfica). Si nunca cierras sesión, no es necesario.

### Diagnóstico rápido

Si el móvil dice **"sin conexión al server"** y las IPs están bien:

```bash
# ¿Hay proceso?
ps -ef | grep libre-chat-server | grep -v grep

# ¿Hay puerto?
ss -tlnp 2>/dev/null | grep 8765

# ¿Responde local?
curl -s http://localhost:8765/health

# ¿Responde por LAN?
curl -s http://<IP-de-tu-maquina>:8765/health
```

Si todo está vacío, el server murió → `lcs-start` o
`systemctl --user restart libre-chat-server`.

Si responde por `localhost` pero no por la IP LAN, es firewall:

```bash
sudo ufw allow 8765/tcp     # Ubuntu con ufw activo
```

---

## Mobile app

[`mobile/`](mobile/) — React Native 0.83 bare (no Expo) + TypeScript.
Cliente HTTP puro: no tiene SQLite local, todo va por
`libre-chat-server`.

### Features

- **Burbujas tipo WhatsApp** (usuario derecha, assistant izquierda con
  avatar).
- **Markdown inline**: `**bold**`, `_italic_`, `` `code` ``, `~~strike~~`.
- **Personajes** con system prompt, color y avatar propio; varios
  activos en una misma sesión (cada uno responde como su propio voice
  en el historial).
- **Escena** editable por sesión, inyectada al system prompt junto a
  reglas estrictas de roleplay (evita que un personaje hable como
  otro).
- **Picker de hablante**: long-press en enviar abre selector; con
  composer vacío + personajes activos, tap-enviar también abre el
  picker para que un personaje arranque la escena.
- **Compresión de contexto**: barra que muestra el % usado, botón
  para comprimir vía Ollama (resumen rolling guardado en
  `sessions.summary` + `summary_upto_message_id`).
- **Rebobinar**: long-press sobre un mensaje borra ese y todos los
  posteriores.
- **Streaming en vivo** desde Ollama (NDJSON via XMLHttpRequest con
  thinking + content separados).
- **Modelo y escena seleccionables** por sesión; settings persistidos
  con AsyncStorage (sólo preferencias UI, no datos de chat).

Para más detalle ver el README del subdirectorio cuando exista, o los
docstrings en [`mobile/src/`](mobile/src/).

---

## Configuración

Defaults del proyecto en [`config.yml`](config.yml) en la raíz.
Cualquier key es opcional; las que falten caen a los fallbacks de
[`config.py`](src/libre_chat/config.py).

```yaml
system_prompt: "You are a helpful assistant for answering questions..."
temperature: 0.80
max_tokens: 2048
num_ctx: null    # null = respeta PARAMETER num_ctx del Modelfile
think: false
db_path: null    # null = default XDG (~/.local/share/libre_chat/history.db)
```

Flags del CLI siempre ganan a `config.yml`. Para prompts multi-línea
usa block scalars (`|`) de YAML para no escapar quotes:

```yaml
system_prompt: |
  You are an expert reviewer.
  Quote code as "snippets" — no escaping needed here.
```

El server lee el mismo `config.yml` (en particular `db_path`), así
que CLI y server siempre pegan al mismo archivo SQLite.

---

## Storage / esquema SQLite

- **Ruta del archivo**: `db_path` de `config.yml`, o `--db` en el
  CLI, o el default XDG `~/.local/share/libre_chat/history.db`. El
  directorio padre se crea en el primer arranque.

- **Esquema** (creado automáticamente):

  Declaradas por SQLModel (`db.py` + `models.py`), las usa el CLI:
  - `sessions` — `id, created_at, updated_at, title (UNIQUE non-null
    via partial index), model, system_prompt`
  - `messages` — `id, session_id (FK cascade), role, content,
    created_at, input_tokens, output_tokens, eval_duration_ns`

  Agregadas en SQL crudo por el server (en su `lifespan`):
  - Columnas extra en `sessions`: `scene`, `summary`,
    `summary_upto_message_id`
  - Columna extra en `messages`: `character_id`
  - Tabla `characters` — `id, name (UNIQUE), avatar, color,
    system_prompt, created_at, updated_at`
  - Tabla `session_characters` — `(session_id, character_id)` PK
    compuesto

  El CLI ignora las columnas/tablas mobile-only; el server las
  necesita pero no las acopla al modelo SQLModel — todas las
  migraciones SQL crudas son idempotentes
  ([`server/engine.py`](src/libre_chat/server/engine.py)).

- **Inspección con sqlite3**:
  ```bash
  sqlite3 ~/.local/share/libre_chat/history.db ".schema"
  sqlite3 ~/.local/share/libre_chat/history.db \
      "SELECT id, title, updated_at FROM sessions ORDER BY updated_at DESC LIMIT 10;"
  sqlite3 ~/.local/share/libre_chat/history.db \
      "SELECT id, role, character_id, substr(content, 1, 60) FROM messages WHERE session_id = 1;"
  ```

  Es seguro consultar mientras el server corre (SQLite WAL-friendly
  para lecturas).

- **GUI**: `sqlitebrowser`. Si lo instalas como *snap*, no puede leer
  archivos en directorios ocultos como `~/.local/share/`. Apunta
  `db_path` a un path no oculto (ej. `~/libre_chat_history.db`) o usa
  el `.deb`.

---

## Project layout

```
simple_chatbot/
├── pyproject.toml
├── config.yml                       defaults del proyecto (prompts + params)
├── README.md
├── history.db                       (creado en runtime — gitignored según config)
├── src/libre_chat/
│   ├── __init__.py                  metadata del paquete (__version__)
│   ├── __main__.py                  habilita `python -m libre_chat`
│   ├── cli.py                       argparse + selección de engine + ChatBot.run()
│   ├── chatbot.py                   clase ChatBot: REPL + persistencia + streaming
│   ├── config.py                    loader de config.yml + DEFAULT_* constants
│   ├── db.py                        make_engine / make_memory_engine + índice único
│   ├── models.py                    SQLModel tables: ChatSession, Message
│   ├── ui.py                        ANSI colors, banner, SEP, render/replay helpers
│   └── server/                      paquete del FastAPI server
│       ├── __init__.py              re-exporta app y run
│       ├── app.py                   FastAPI + lifespan + CORS + run()
│       ├── engine.py                singleton del engine + migraciones SQL crudas
│       ├── schemas.py               Pydantic models (contrato HTTP)
│       ├── helpers.py               mappers row→Out, touch_session, etc.
│       └── routers/
│           ├── health.py            /health
│           ├── sessions.py          CRUD + summary
│           ├── messages.py          CRUD + rewind
│           └── characters.py        CRUD + /sessions/{id}/characters
└── mobile/                          React Native 0.83 bare (TypeScript)
    └── src/
        ├── components/              MessageBubble, Composer, ContextBar, RichText,
        │                            CharacterChip, CharacterPickerModal,
        │                            SpeakerPickerSheet, ThinkingBlock, …
        ├── screens/                 ChatScreen, SessionsScreen, SessionEditScreen,
        │                            CharactersScreen, CharacterEditScreen,
        │                            SettingsScreen, SplashScreen
        ├── hooks/                   useChat (streaming + roleplay rewriting),
        │                            useSessions, useCharacters
        ├── services/                api.ts (HTTP), compression.ts, ollama.ts
        ├── store/                   zustand: chat-store, characters-cache, settings-store
        ├── constants/               theme, character-palette, config
        └── types/                   navigation, db, ollama
```

---

## Requirements

- Python ≥ 3.10
- [Ollama](https://ollama.com) corriendo (default
  `http://localhost:11434`)
- Al menos un modelo descargado (ej. `ollama pull llama3`)
- Para la app móvil: Node ≥ 20, JDK 17, Android SDK (o Xcode para
  iOS). Ver instrucciones estándar de React Native bare.

---

## Install

Editable install en tu virtualenv (instala CLI + server):

```bash
pip install -e .
```

Dependencias (auto): `ollama`, `pyyaml`, `sqlmodel`, `fastapi`,
`uvicorn[standard]`.

Después del install quedan dos console scripts:

- `libre-chat` → REPL (`libre_chat.cli:main`)
- `libre-chat-server` → FastAPI (`libre_chat.server:run`)

Para la app móvil:

```bash
cd mobile
npm install
npx react-native run-android      # o run-ios
```

---

## Roadmap

- [x] SQLite-backed history (por-conversación, resumable)
- [x] Incognito mode (ephemeral, in-memory)
- [x] HTTP server FastAPI compartiendo DB con el CLI
- [x] App móvil React Native como cliente puro HTTP
- [x] Personajes con system prompt propio + múltiples activos por
      sesión
- [x] Escena por sesión + reglas de roleplay automáticas
- [x] Rebobinar mensajes (delete-from-here)
- [x] Compresión de contexto vía resumen rolling
- [x] Markdown inline en burbujas
- [ ] Streaming de personajes en paralelo (hoy es secuencial)
- [ ] RAG opcional sobre historial (embeddings + vector store)
- [ ] Adjuntar archivos / pegar docs largos como inputs
- [ ] API key + reverse proxy con TLS para exponer fuera de LAN
- [ ] Dark mode en el móvil

---

## License

MIT. Ver `pyproject.toml` para la metadata autoritativa.
