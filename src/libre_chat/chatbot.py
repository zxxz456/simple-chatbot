"""
chatbot.py
===========


Description:
-----------
Core chatbot class for the libre_chat package. Drives a
multi-turn terminal conversation against an Ollama model and
persists sessions and messages to SQLite via SQLModel.

Handles:
- Message history (user + assistant turns) in memory and on disk
- Slash commands (/help, /clear, /system, /tokens, /context,
  /sessions, /resume, /new, /q)
- Per-turn and cumulative token accounting
- Session lifecycle: create, resume, switch, wipe


Metadata:
----------
* Author: zxxz6 (Bryan Violante Arriaga)
* Version: 0.0.1-alpha
* License: MIT


History:
------------
Author      Date            Description
zxxz6       20/04/2026      Added session persistence
zxxz6       17/04/2026      Creation

"""

import readline
from datetime import datetime, timezone
from typing import Any, Optional

import ollama
from sqlalchemy import Engine
from sqlmodel import Session as DBSession, delete, select

# Enable line-editing (arrow keys, Home/End, Ctrl+A/E) in input().
# Auto-history off: ↑/↓ don't recall prior prompts.
readline.set_auto_history(False)

from libre_chat import ui
from libre_chat.config import (
    DEFAULT_MAX_TOKENS,
    DEFAULT_NUM_CTX,
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_TEMPERATURE,
    DEFAULT_THINK,
)
from libre_chat.models import ChatSession, Message
from libre_chat.ui import SEP


def _now() -> datetime:
    """
    Return the current UTC timestamp as a timezone-aware datetime.

    Description:
        Small helper used wherever rows need `created_at` or
        `updated_at` values. Centralizing the call keeps all
        timestamps on the same clock.

    Args:
        None.

    Return:
        Aware ``datetime`` in UTC.
    """
    return datetime.now(timezone.utc)


def _make_title(text: str, limit: int = 60) -> str:
    """
    Derive a session title from an arbitrary text.

    Description:
        Collapses runs of whitespace into single spaces and
        truncates the result, appending an ellipsis if the
        original exceeded ``limit`` characters.

    Args:
        text: Source string (typically the first user message).
        limit: Maximum number of characters to keep.

    Return:
        A short, single-line title.
    """
    clean = " ".join(text.split())
    return clean[:limit] + ("…" if len(clean) > limit else "")


def resolve_session_id(engine: Engine, identifier: str) -> int | None:
    """
    Map a CLI or slash-command argument to a ``ChatSession.id``.

    Description:
        Accepts a pure-digit string (interpreted as an id) or
        any other string (interpreted as an exact title match).
        Used both by the ``--session`` CLI flag and by the
        ``/resume`` slash command.

    Args:
        engine: SQLAlchemy engine for the history database.
        identifier: Raw user-provided argument.

    Return:
        The matching session id, or None if no session matches.
    """
    identifier = identifier.strip()
    if not identifier:
        return None
    if identifier.isdigit():
        return int(identifier)
    with DBSession(engine) as db:
        s = db.exec(
            select(ChatSession).where(ChatSession.title == identifier)
        ).first()
    return s.id if s else None


class ChatBot:
    """
    Interactive terminal chatbot session against an Ollama model.

    Description:
        Encapsulates the REPL loop and per-turn state, and writes
        every message to SQLite through SQLModel so conversations
        persist across runs.

    Behavior:
        Mutable state lives on the instance (history, tokens_total,
        durations_total_ns, ctx_total, last_*_tokens) and is updated
        each turn. Call `.run()` to start the interactive loop.
    """

    def __init__(
        self,
        model: str,
        engine: Engine,
        session_id: Optional[int] = None,
        system_prompt: str = DEFAULT_SYSTEM_PROMPT,
        temperature: float = DEFAULT_TEMPERATURE,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        num_ctx: int | None = DEFAULT_NUM_CTX,
        think: bool | str = DEFAULT_THINK,
        incognito: bool = False,
    ) -> None:
        """
        Configure a ChatBot session.

        Description:
            Pure setter — stores runtime parameters and
            initializes empty in-memory counters and caches.
            Database and Modelfile I/O is deferred to ``run()``.

        Args:
            model: Ollama model name (e.g. llama3, qwen3.5:35b-a3b).
            engine: SQLAlchemy engine pointing at the history DB.
            session_id: Existing ChatSession.id to resume, or None
                to create a new session on run().
            system_prompt: Initial system prompt (overridden by the
                stored one when resuming an existing session).
            temperature: Sampling temperature.
            max_tokens: Max tokens generated per response.
            num_ctx: Context window size. None = respect Modelfile.
            think: False/True or 'low'/'medium'/'high'.
            incognito: Cosmetic flag shown in the status line. The
                actual ephemerality is enforced by passing an
                in-memory engine.

        Return:
            None.
        """
        self.model = model
        self.engine = engine
        self.session_id: Optional[int] = session_id
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.num_ctx = num_ctx
        self.think = think
        self.incognito = incognito

        self.title: Optional[str] = None
        self.history: list[dict[str, str]] = []
        self.tokens_total: dict[str, int] = {"input": 0, "output": 0}
        self.durations_total_ns: dict[str, int] = {"input": 0, "output": 0}
        self.last_input_tokens: int = 0
        self.last_output_tokens: int = 0
        self.last_eval_duration_ns: int = 0
        self.ctx_total: int | None = num_ctx
        # In-memory cache of thinking blocks keyed by Message.id. Only
        # populated during the current run, so resumed sessions don't
        # show thinking on replay (not persisted to DB).
        self.thinking_log: dict[int, str] = {}

    # ─── Main loop ────────────────────────────────────────────────────────

    def run(self) -> None:
        """
        Start the interactive REPL.

        Description:
            Ensures the session row exists, resolves the model's
            context window, paints the startup screen, then loops
            reading user input until EOF, KeyboardInterrupt, or
            /quit. Dispatches slash commands and conversation turns.

        Args:
            None.

        Return:
            None.
        """
        self._ensure_session()
        self._resolve_ctx_total()
        self._render()

        while True:
            try:
                user_input = input(">>> ")
            except (EOFError, KeyboardInterrupt):
                print()
                break

            if not user_input.strip():
                continue

            if user_input.startswith("/"):
                if self._handle_command(user_input[1:].strip()) == "exit":
                    break
                continue

            self._chat_turn(user_input)

    def _ensure_session(self) -> None:
        """
        Create a new ``ChatSession`` row or load an existing one.

        Description:
            If ``session_id`` was not provided, inserts a fresh
            session with the current ``model`` / ``system_prompt``
            snapshot. Otherwise loads the stored session, syncs
            ``system_prompt`` and ``title`` from the row, and
            replays its messages into ``self.history``.

        Args:
            None.

        Return:
            None.
        """
        with DBSession(self.engine) as db:
            if self.session_id is None:
                s = ChatSession(model=self.model, system_prompt=self.system_prompt)
                db.add(s)
                db.commit()
                db.refresh(s)
                self.session_id = s.id
                self.title = None
            else:
                s = db.get(ChatSession, self.session_id)
                if s is None:
                    raise SystemExit(f"Session {self.session_id} not found")
                self.system_prompt = s.system_prompt
                self.title = s.title
                msgs = db.exec(
                    select(Message)
                    .where(Message.session_id == self.session_id)
                    .order_by(Message.id)  # type: ignore[arg-type]
                ).all()
                for m in msgs:
                    self.history.append({"role": m.role, "content": m.content})

    # ─── Commands ─────────────────────────────────────────────────────────

    def _handle_command(self, cmd: str) -> str | None:
        """
        Dispatch a slash command typed by the user.

        Description:
            Matches ``cmd`` against the known set and executes the
            appropriate action. Some commands mutate DB state
            (``/clear``, ``/system``, ``/rename``, ``/new``) or
            re-render the screen (``/rename``, ``/resume``, ``/new``).

        Args:
            cmd: Command string without the leading slash, already
                trimmed of surrounding whitespace.

        Return:
            The string ``'exit'`` if the REPL should break, else
            None.
        """
        if cmd in ("quit", "q"):
            return "exit"

        if cmd == "help":
            self._print_help()
            return None

        if cmd == "clear":
            self.history = []
            with DBSession(self.engine) as db:
                db.exec(
                    delete(Message).where(Message.session_id == self.session_id)  # type: ignore[arg-type]
                )
                db.commit()
            print("History cleared.")
            return None

        if cmd.startswith("system"):
            new = cmd[6:].strip()
            if new:
                self.system_prompt = new
                with DBSession(self.engine) as db:
                    s = db.get(ChatSession, self.session_id)
                    if s:
                        s.system_prompt = new
                        s.updated_at = _now()
                        db.commit()
                print(f"System prompt: {self.system_prompt}")
            else:
                print(f"Current system prompt: {self.system_prompt}")
            return None

        if cmd == "tokens":
            total = self.tokens_total["input"] + self.tokens_total["output"]
            in_tps = self._tps("input")
            out_tps = self._tps("output")
            in_tps_str = f" ({in_tps:.1f} tok/s)" if in_tps is not None else ""
            out_tps_str = f" ({out_tps:.1f} tok/s)" if out_tps is not None else ""
            print(f"Input:  {self.tokens_total['input']} tokens{in_tps_str}")
            print(f"Output: {self.tokens_total['output']} tokens{out_tps_str}")
            print(f"Total:  {total} tokens")
            return None

        if cmd == "context":
            n_msg = 1 + len(self.history)
            used = str(self.last_input_tokens) if self.last_input_tokens else "?"
            total_str = str(self.ctx_total) if self.ctx_total else "?"
            if self.ctx_total and self.last_input_tokens:
                pct = f" ({self.last_input_tokens / self.ctx_total * 100:.1f}%)"
            else:
                pct = ""
            print(f"Context: {n_msg} messages, {used}/{total_str} tokens{pct}")
            return None

        if cmd == "sessions":
            self._list_sessions()
            return None

        if cmd.startswith("rename"):
            new = cmd[len("rename"):].strip()
            if not new:
                print("Usage: /rename <new title>")
                return None
            with DBSession(self.engine) as db:
                clash = db.exec(
                    select(ChatSession).where(
                        ChatSession.title == new,
                        ChatSession.id != self.session_id,
                    )
                ).first()
                if clash is not None:
                    print(f"Title '{new}' already in use by session #{clash.id}")
                    return None
                s = db.get(ChatSession, self.session_id)
                if s is None:
                    print("No active session.")
                    return None
                s.title = new
                s.updated_at = _now()
                db.commit()
            self.title = new
            self._render()
            return None

        if cmd.startswith("resume"):
            arg = cmd[len("resume"):].strip()
            if not arg:
                print("Usage: /resume <id|title>")
                return None
            sid = resolve_session_id(self.engine, arg)
            if sid is None:
                print(f"No session matching '{arg}'.")
                return None
            if self._switch_to(sid):
                self._render()
            return None

        if cmd == "new":
            self._new_session()
            self._render()
            return None

        print(f"Unknown command: /{cmd}")
        return None

    def _print_help(self) -> None:
        """
        Print the list of available slash commands.

        Description:
            Writes one line per command to stdout. Content only,
            no state changes.

        Args:
            None.

        Return:
            None.
        """
        print("Available commands:")
        print("  /help            Show this help")
        print("  /clear           Reset conversation history (also in DB)")
        print("  /system [text]   Set system prompt (or show current if no arg)")
        print("  /tokens          Show cumulative input/output tokens + tok/s")
        print("  /context         Show context window usage (used/total + %)")
        print("  /sessions        List recent sessions")
        print("  /resume <id|t>   Switch to session (by id or exact title)")
        print("  /rename <title>  Rename the current session (must be unique)")
        print("  /new             Start a fresh session")
        print("  /q, /quit        Exit")

    def _tps(self, kind: str) -> float | None:
        """
        Compute cumulative tokens-per-second for ``"input"`` or ``"output"``.

        Description:
            Divides accumulated tokens by accumulated ollama-reported
            duration (in ns). Returns None when no tokens have been
            accounted for yet so callers can omit the column instead
            of printing 0.0.

        Args:
            kind: Either ``"input"`` or ``"output"``.

        Return:
            Tokens per second, or None if unavailable.
        """
        tokens = self.tokens_total[kind]
        ns = self.durations_total_ns[kind]
        if not tokens or not ns:
            return None
        return tokens / (ns / 1_000_000_000)

    # ─── Turn ─────────────────────────────────────────────────────────────

    def _chat_turn(self, user_input: str) -> None:
        """
        Run a single user → assistant conversation turn.

        Description:
            Records the user message, calls Ollama with the composed
            message list, streams the reply, prints end-of-turn
            stats, persists the assistant message, and caches the
            thinking block (if any) for replay.

        Args:
            user_input: Raw text typed at the ``>>>`` prompt.

        Return:
            None.
        """
        self._add_user_message(user_input)

        print()
        print(SEP)
        print()

        stream = ollama.chat(
            model=self.model,
            messages=self._build_messages(),
            think=self.think,
            stream=True,
            options=self._build_options(),
        )

        text, thinking, final_chunk = self._stream_response(stream)
        self._update_and_print_stats(final_chunk)
        msg_id = self._add_assistant_message(text)
        if msg_id is not None and thinking:
            self.thinking_log[msg_id] = thinking

    def _stream_response(
        self, stream: Any
    ) -> tuple[str, str, dict[str, Any] | None]:
        """
        Consume an Ollama streaming response and print it live.

        Description:
            Iterates over streamed chunks, separating thinking
            tokens from content tokens and printing them with the
            appropriate ANSI styling and ``>>> `` prefix. Tracks
            phase transitions (thinking ↔ content) to insert the
            right prefix and blank-line spacing between them.

        Args:
            stream: Iterable of chunk dicts yielded by
                ``ollama.chat(..., stream=True)``.

        Return:
            Tuple ``(content_text, thinking_text, final_chunk)``.
            Thinking text is captured so the live-run cache can
            replay it on screen refresh; it is not persisted.
        """
        text = ""
        thinking_text = ""
        final_chunk: dict[str, Any] | None = None
        state: str | None = None  # None | "thinking" | "content"

        for chunk in stream:
            msg = chunk["message"]
            thinking_piece = msg.get("thinking") or ""
            content_piece = msg.get("content") or ""

            if thinking_piece:
                if state is None:
                    print("\033[2m[thinking] ", end="", flush=True)
                state = "thinking"
                print(thinking_piece, end="", flush=True)
                thinking_text += thinking_piece

            if content_piece:
                if state == "thinking":
                    print("\033[0m")
                    print()
                    print(">>> ", end="", flush=True)
                elif state is None:
                    print(">>> ", end="", flush=True)
                state = "content"
                print(content_piece, end="", flush=True)
                text += content_piece

            final_chunk = chunk

        if state == "thinking":
            print("\033[0m")
        else:
            print()

        return text, thinking_text, final_chunk

    def _update_and_print_stats(self, final_chunk: dict[str, Any] | None) -> None:
        """
        Update token counters and print the end-of-turn context line.

        Description:
            Reads ``prompt_eval_count``, ``eval_count``,
            ``prompt_eval_duration`` and ``eval_duration`` from
            the final streamed chunk. Updates cumulative counters
            and last-turn snapshots, then draws the gray context
            separator via ``_print_ctx_line``.

        Args:
            final_chunk: Last chunk returned by the stream, or
                None if the stream produced nothing.

        Return:
            None.
        """
        input_tokens = final_chunk.get("prompt_eval_count", 0) if final_chunk else 0
        output_tokens = final_chunk.get("eval_count", 0) if final_chunk else 0
        input_ns = final_chunk.get("prompt_eval_duration", 0) if final_chunk else 0
        output_ns = final_chunk.get("eval_duration", 0) if final_chunk else 0
        self.tokens_total["input"] += input_tokens
        self.tokens_total["output"] += output_tokens
        self.durations_total_ns["input"] += input_ns
        self.durations_total_ns["output"] += output_ns
        self.last_input_tokens = input_tokens
        self.last_output_tokens = output_tokens
        self.last_eval_duration_ns = output_ns

        ui.print_ctx_line(input_tokens, self.ctx_total)

    # ─── Persistence ──────────────────────────────────────────────────────

    def _add_user_message(self, content: str) -> None:
        """
        Append a user message in memory and persist it to SQLite.

        Description:
            Appends to ``self.history`` and inserts a row into
            ``messages``. If the session has no title yet, derives
            one from ``content`` (deduped with ``_unique_title``)
            and mirrors it onto ``self.title``. Bumps the session's
            ``updated_at``.

        Args:
            content: User's raw input text.

        Return:
            None.
        """
        self.history.append({"role": "user", "content": content})
        with DBSession(self.engine) as db:
            db.add(Message(session_id=self.session_id, role="user", content=content))
            s = db.get(ChatSession, self.session_id)
            if s is not None:
                if not s.title:
                    s.title = self._unique_title(db, _make_title(content))
                    self.title = s.title
                s.updated_at = _now()
            db.commit()

    def _unique_title(self, db: DBSession, base: str) -> str:
        """
        Find a title that does not clash with other sessions.

        Description:
            Queries the DB for existing rows with ``base`` as
            title. If any exist, appends ``(2)``, ``(3)``, … until
            a free candidate is found. The current session is
            excluded from the clash check.

        Args:
            db: Active SQLModel session to query through.
            base: Preferred title.

        Return:
            Either ``base`` or ``f"{base} ({n})"`` for the smallest
            unused ``n``.
        """
        candidate = base
        n = 1
        while True:
            clash = db.exec(
                select(ChatSession).where(
                    ChatSession.title == candidate,
                    ChatSession.id != self.session_id,
                )
            ).first()
            if clash is None:
                return candidate
            n += 1
            candidate = f"{base} ({n})"

    def _add_assistant_message(self, content: str) -> int | None:
        """
        Append an assistant message in memory and persist it with stats.

        Description:
            Appends to ``self.history`` and writes a ``messages``
            row tagged with the most recent per-turn token and
            duration stats. Bumps the session's ``updated_at``.

        Args:
            content: Accumulated assistant response text.

        Return:
            The inserted Message's id (so the caller can cache a
            related thinking block), or None if the insert didn't
            produce one.
        """
        self.history.append({"role": "assistant", "content": content})
        with DBSession(self.engine) as db:
            m = Message(
                session_id=self.session_id,
                role="assistant",
                content=content,
                input_tokens=self.last_input_tokens,
                output_tokens=self.last_output_tokens,
                eval_duration_ns=self.last_eval_duration_ns,
            )
            db.add(m)
            s = db.get(ChatSession, self.session_id)
            if s is not None:
                s.updated_at = _now()
            db.commit()
            db.refresh(m)
            return m.id

    def _build_messages(self) -> list[dict[str, str]]:
        """
        Compose the messages payload to send to the model.

        Description:
            Prepends the current system prompt to the full
            in-memory history. This is the single point where
            retrieval, summaries, or pruning would hook in.

        Args:
            None.

        Return:
            List of ``{role, content}`` dicts ordered as Ollama's
            chat API expects.
        """
        return [{"role": "system", "content": self.system_prompt}] + self.history

    def _build_options(self) -> dict[str, Any]:
        """
        Build the ``options`` kwarg for ``ollama.chat()``.

        Description:
            Always sets ``temperature`` and ``num_predict``. Adds
            ``num_ctx`` only when explicitly configured; leaving
            it unset respects the Modelfile's parameter.

        Args:
            None.

        Return:
            Dict suitable for the ``options`` parameter of
            ``ollama.chat``.
        """
        opts: dict[str, Any] = {
            "temperature": self.temperature,
            "num_predict": self.max_tokens,
        }
        if self.num_ctx is not None:
            opts["num_ctx"] = self.num_ctx
        return opts

    def _resolve_ctx_total(self) -> None:
        """
        Populate ``self.ctx_total`` from the Modelfile if not set.

        Description:
            Calls ``ollama.show(model)`` and parses its
            ``parameters`` text for a ``num_ctx <N>`` line.
            Silently leaves ``ctx_total`` unchanged if the lookup
            fails (network, missing field, etc.).

        Args:
            None.

        Return:
            None.
        """
        if self.ctx_total is not None:
            return
        try:
            params = getattr(ollama.show(self.model), "parameters", "") or ""
            for line in params.splitlines():
                parts = line.split(None, 1)
                if len(parts) == 2 and parts[0] == "num_ctx":
                    self.ctx_total = int(parts[1])
                    return
        except Exception:
            pass

    # ─── Session operations ───────────────────────────────────────────────

    def _list_sessions(self, limit: int = 20) -> None:
        """
        Print a table of recent sessions, marking the current one.

        Description:
            Fetches the ``limit`` most-recently-updated sessions
            ordered by ``updated_at DESC`` and prints id, updated
            timestamp, model, and title. A leading ``*`` marks the
            active session.

        Args:
            limit: Maximum number of sessions to display.

        Return:
            None.
        """
        with DBSession(self.engine) as db:
            rows = db.exec(
                select(ChatSession)
                .order_by(ChatSession.updated_at.desc())  # type: ignore[union-attr]
                .limit(limit)
            ).all()
        if not rows:
            print("No sessions yet.")
            return
        print(f"{'ID':>4}  {'Updated':19}  {'Model':24}  Title")
        for s in rows:
            marker = "*" if s.id == self.session_id else " "
            stamp = s.updated_at.strftime("%Y-%m-%d %H:%M:%S")
            title = s.title or "(untitled)"
            print(f"{marker}{s.id:>3}  {stamp}  {s.model[:24]:24}  {title}")

    def _switch_to(self, sid: int) -> bool:
        """
        Replace in-memory state with another session loaded from DB.

        Description:
            Loads the target session row and its messages, then
            overwrites ``session_id``, ``system_prompt``, ``title``,
            and ``history`` on the instance. Token counters are
            left untouched so /tokens remains a run-wide summary.

        Args:
            sid: Target ``ChatSession.id``.

        Return:
            True on success, False if the session does not exist.
        """
        with DBSession(self.engine) as db:
            s = db.get(ChatSession, sid)
            if s is None:
                print(f"Session {sid} not found.")
                return False
            msgs = db.exec(
                select(Message).where(Message.session_id == sid).order_by(Message.id)  # type: ignore[arg-type]
            ).all()
            self.session_id = sid
            self.system_prompt = s.system_prompt
            self.title = s.title
            self.history = [{"role": m.role, "content": m.content} for m in msgs]
        return True

    def _new_session(self) -> None:
        """
        Create a fresh session row and clear in-memory state.

        Description:
            Inserts a new ``ChatSession`` with the current model
            and system prompt, switches the instance to that new
            id, and resets history and per-turn counters. Used by
            the ``/new`` slash command.

        Args:
            None.

        Return:
            None.
        """
        with DBSession(self.engine) as db:
            s = ChatSession(model=self.model, system_prompt=self.system_prompt)
            db.add(s)
            db.commit()
            db.refresh(s)
        self.session_id = s.id
        self.title = None
        self.history = []
        self.tokens_total = {"input": 0, "output": 0}
        self.durations_total_ns = {"input": 0, "output": 0}
        self.last_input_tokens = 0
        self.last_output_tokens = 0
        self.last_eval_duration_ns = 0

    # ─── Rendering ────────────────────────────────────────────────────────

    def _render(self) -> None:
        """
        Repaint the terminal screen for the current session.

        Description:
            Thin wrapper over ``ui.render_screen`` that forwards
            the instance state it needs to paint the header and
            replay stored history.

        Args:
            None.

        Return:
            None.
        """
        ui.render_screen(
            engine=self.engine,
            model=self.model,
            session_id=self.session_id,
            title=self.title,
            ctx_total=self.ctx_total,
            thinking_log=self.thinking_log,
            incognito=self.incognito,
        )
