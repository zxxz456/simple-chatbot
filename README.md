# libre-chat 

A multi-turn terminal chatbot for local LLMs served by
[Ollama](https://ollama.com). Keeps a clean split between the REPL,
the model session, persistence, and the UI chrome — designed to stay
simple and hackable while still persisting conversations to SQLite
out of the box.

## Features

- **Streaming output**, including a dim `[thinking]` section for
  models that support reasoning tokens (`--think`).
- **SQLite-backed history** (via SQLModel) — every session and
  message is saved to disk; resume any past session by id or title,
  or list them from the CLI.
- **Incognito mode** (`--incognito`): identical UX but the engine
  runs entirely in RAM so nothing ever touches disk.
- **Context-aware UI**: each turn ends with a gray separator showing
  `used/total` tokens and the % of the context window consumed.
- **Modelfile-aware**: respects the `PARAMETER num_ctx` from your
  Ollama Modelfile by default; override with `--num-ctx`.
- **Live token accounting**: `/tokens` shows cumulative input/output
  counts plus `tok/s` measured from Ollama's timing fields.
- **Unique session titles**, auto-derived from the first user
  message (with `(2)`, `(3)`… deduplication) and editable via
  `/rename`.
- **Line-editing**: arrow keys / Home / End / Ctrl+A/E work inside
  the prompt (auto-history recall deliberately off).
- **Header auto-refresh** on `/rename`, `/resume` and `/new` — the
  status line (model + session + title) repaints instantly, and
  prior turns of the session are replayed so you keep visual
  context.
- **Colored ANSI-Shadow banner** on startup.

## Requirements

- Python ≥ 3.10
- A running [Ollama](https://ollama.com) server (default
  `http://localhost:11434`)
- At least one model pulled (e.g. `ollama pull llama3`)

## Install

Editable install into your virtualenv:

```bash
pip install -e .
```

Dependencies (pulled automatically): `ollama`, `pyyaml`, `sqlmodel`.

## Usage

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

Also runnable as a module:

```bash
python -m libre_chat -m llama3
```

### CLI flags

| Flag                     | Default              | Description                                                      |
| ------------------------ | -------------------- | ---------------------------------------------------------------- |
| `-m`, `--model`          | `llama3`             | Ollama model name                                                |
| `-s`, `--system`         | from `config.yml`    | Initial system prompt (ignored on resume — stored prompt wins)   |
| `-t`, `--temperature`    | from `config.yml`    | Sampling temperature                                             |
| `--max-tokens`           | from `config.yml`    | Max tokens generated per response                                |
| `--num-ctx`              | `None` (Modelfile)   | Override the model's context window                              |
| `--think [low/med/high]` | off                  | Enable thinking tokens (level optional, model-dependent)         |
| `--db PATH`              | from `config.yml`    | SQLite history file path                                         |
| `--session <id\|title>`  | —                    | Resume an existing session by numeric id or exact title          |
| `--list-sessions`        | —                    | Print saved sessions and exit                                    |
| `--incognito`            | off                  | Run with an in-memory DB; nothing persists (banner shows tag)    |
| `-V`, `--version`        | —                    | Print version and exit                                           |

### In-session commands

| Command            | What it does                                                            |
| ------------------ | ----------------------------------------------------------------------- |
| `/help`            | Show the command list                                                   |
| `/clear`           | Reset conversation history (also wipes the current session's messages)  |
| `/system [text]`   | Set the system prompt (or show current if no arg); persisted to session |
| `/tokens`          | Cumulative input/output tokens + tok/s                                  |
| `/context`         | `used/total` tokens and % of the context window in use                  |
| `/sessions`        | List recent sessions, with `*` on the active one                        |
| `/resume <id\|t>`  | Switch to another session by id or exact title                          |
| `/rename <title>`  | Rename the current session (must be globally unique)                    |
| `/new`             | Start a fresh session without exiting the program                       |
| `/q`, `/quit`      | Exit                                                                    |

Pressing Enter on an empty line is a no-op (does **not** send an
empty turn to the model). `Ctrl+C` / `Ctrl+D` also exit cleanly.

## Configuration

Project-level defaults live in [`config.yml`](config.yml) at the
repo root. Any key is optional; missing ones fall back to the
built-in defaults in [`config.py`](src/libre_chat/config.py).

```yaml
system_prompt: "You are a helpful assistant for answering questions..."
temperature: 0.80
max_tokens: 2048
num_ctx: null    # null = respect the Modelfile's PARAMETER num_ctx
think: false
db_path: null    # null = XDG default (~/.local/share/libre_chat/history.db)
```

CLI flags always win over `config.yml`. For multi-line prompts use
YAML block scalars (`|`) so you don't have to escape inner quotes:

```yaml
system_prompt: |
  You are an expert reviewer.
  Quote code as "snippets" — no escaping needed here.
```

## Storage

- **Disk path**: `db_path` from `config.yml`, or CLI `--db`, or the
  XDG fallback `~/.local/share/libre_chat/history.db`. The parent
  directory is created on first launch.
- **Schema** (created automatically via SQLModel):
  - `sessions` — `id, created_at, updated_at, title (unique
    non-null), model, system_prompt`
  - `messages` — `id, session_id (FK cascade), role, content,
    created_at, input_tokens, output_tokens, eval_duration_ns`
- **Inspect with sqlite3**:
  ```bash
  sqlite3 ~/.local/share/libre_chat/history.db ".schema"
  sqlite3 ~/.local/share/libre_chat/history.db \
      "SELECT id, title, updated_at FROM sessions ORDER BY updated_at DESC LIMIT 10;"
  ```
- **GUI tip**: DB Browser for SQLite installed as a *snap* can't
  read files inside hidden dirs like `~/.local/share/`. Point
  `db_path` to a non-hidden path (e.g. `~/libre_chat_history.db`)
  or install the `.deb`.

## Project layout

```
simple_chatbot/
├── pyproject.toml
├── config.yml                project-level defaults (prompts + params)
├── README.md
└── src/libre_chat/
    ├── __init__.py           package metadata (__version__)
    ├── __main__.py           enables `python -m libre_chat`
    ├── cli.py                argparse + engine selection + launches ChatBot.run()
    ├── chatbot.py            ChatBot class: REPL loop + SQLite persistence
    ├── config.py             loads config.yml, exposes DEFAULT_* constants
    ├── db.py                 make_engine / make_memory_engine, unique-title index
    ├── models.py             SQLModel tables: ChatSession, Message
    └── ui.py                 ANSI colors, banner, SEP, render/replay helpers
```

## Roadmap

- [x] SQLite-backed history (per-conversation, resumable).
- [x] Incognito mode (ephemeral, in-memory).
- [ ] Context compression: rolling summaries when `used/num_ctx`
      crosses a threshold.
- [ ] Optional RAG over conversation history (embeddings + vector
      store).
- [ ] Attach files / paste long docs as first-class inputs.
- [ ] Per-message stats visible in `/sessions` (avg tok/s, totals).

## License


MIT. See `pyproject.toml` for the authoritative metadata.
