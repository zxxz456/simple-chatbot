# libre-chat

A multi-turn terminal chatbot for local LLMs served by
[Ollama](https://ollama.com). Designed to stay simple and hackable
while keeping a clean split between the REPL, the model session,
and the UI chrome, so future extensions (persistence, retrieval,
summarization) slot in without rewriting the loop.

## Features

- **Streaming output**, including a dim `[thinking]` section for
  models that support reasoning tokens (`--think`).
- **Context-aware UI**: each turn ends with a gray separator showing
  `used/total` tokens and the % of the context window consumed.
- **Modelfile-aware**: respects the `PARAMETER num_ctx` from your
  Ollama Modelfile by default; override with `--num-ctx`.
- **Slash commands** inside the session (`/help`, `/clear`,
  `/system`, `/tokens`, `/context`, `/q`).
- **Subclass-friendly core**: `ChatBot` exposes hook methods
  (`_add_user_message`, `_add_assistant_message`, `_build_messages`,
  `_build_options`) so you can plug in SQLite persistence, RAG,
  rolling summaries, etc. without touching the loop.
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

## Usage

```bash
libre-chat -m qwen3.5:35b-a3b
libre-chat --model llama3 --temperature 0.5 --system "You are a technical assistant"
libre-chat -m gemma4-heretic --think          # enable reasoning tokens
libre-chat -m llama3 --num-ctx 16384          # override Modelfile num_ctx
```

Also runnable as a module:

```bash
python -m libre_chat -m llama3
```

### CLI flags

| Flag                    | Default              | Description                                                      |
| ----------------------- | -------------------- | ---------------------------------------------------------------- |
| `-m`, `--model`         | `llama3`             | Ollama model name                                                |
| `-s`, `--system`        | from `config.yml`    | Initial system prompt                                            |
| `-t`, `--temperature`   | from `config.yml`    | Sampling temperature                                             |
| `--max-tokens`          | from `config.yml`    | Max tokens generated per response                                |
| `--num-ctx`             | `None` (Modelfile)   | Override the model's context window                              |
| `--think [low/med/high]`| off                  | Enable thinking tokens (level optional, model-dependent)         |
| `-V`, `--version`       | —                    | Print version and exit                                           |

### In-session commands

| Command           | What it does                                                    |
| ----------------- | --------------------------------------------------------------- |
| `/help`           | Show the command list                                           |
| `/clear`          | Reset conversation history                                      |
| `/system [text]`  | Set the system prompt (or show current if no arg)               |
| `/tokens`         | Cumulative input/output token counters                          |
| `/context`        | `used/total` tokens and % of the context window in use          |
| `/q`, `/quit`     | Exit                                                            |

Pressing Enter on an empty line is a no-op (does **not** send an
empty turn to the model). `Ctrl+C` / `Ctrl+D` also exit cleanly.

## Configuration

Project-level defaults live in [`config.yml`](config.yml) at the
repo root. Any key is optional; missing ones fall back to the
built-in defaults in [`config.py`](src/libre_chat/config.py).

```yaml
system_prompt: "You are a security-focused developer. Answer concisely..."
temperature: 0.80
max_tokens: 2048
num_ctx: null    # null = respect the Modelfile's PARAMETER num_ctx
think: false
```

CLI flags always win over `config.yml`.

## Project layout

```
src/libre_chat/
├── __init__.py      package metadata (__version__)
├── __main__.py      enables `python -m libre_chat`
├── cli.py           argparse + banner + launches ChatBot.run()
├── chatbot.py       ChatBot class: REPL loop + extension hooks
├── config.py        loads config.yml, exposes DEFAULT_* constants
└── ui.py            ANSI colors, banner art, gray separator
```

### Extension hooks

`ChatBot` is intentionally easy to subclass. The planned next
iterations will use these hooks:

- `_add_user_message` / `_add_assistant_message` → persist history
  to SQLite instead of an in-memory list.
- `_build_messages` → inject RAG retrievals or replace the oldest
  turns with a rolling summary before sending to the model.
- `_build_options` → tune Ollama options per request (e.g. raise
  `num_ctx` only when a long document is attached).

## Roadmap

- [ ] SQLite-backed history (per-conversation, resumable).
- [ ] Context compression: rolling summaries when `used/num_ctx`
      crosses a threshold.
- [ ] Optional RAG over conversation history (embeddings + vector
      store).
- [ ] Attach files / paste long docs as first-class inputs.

## License

MIT. See `pyproject.toml` for the authoritative metadata.
