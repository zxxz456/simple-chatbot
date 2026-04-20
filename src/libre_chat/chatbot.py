"""
chatbot.py
===========


Description:
-----------
Core chatbot class for the libre_chat package. Drives a
multi-turn terminal conversation against an Ollama model with
pluggable hooks for history persistence (e.g. SQLite) and
context-compression strategies (e.g. RAG, summaries).

Handles:
- Message history (user + assistant turns)
- Slash commands (/help, /clear, /system, /tokens, /context, /q)
- Per-turn and cumulative token accounting
- Extension points: _add_user_message, _add_assistant_message,
  _build_messages


Metadata:
----------
* Author: zxxz6 (Bryan Violante Arriaga)
* Version: 0.0.1-alpha
* License: MIT


History:
------------
Author      Date            Description
zxxz6       20/04/2026      Refactor to LibreChat class with hooks for SQLite/RAG
zxxz6       17/04/2026      Creation

"""

from typing import Any

import ollama

from libre_chat.config import (
    DEFAULT_MAX_TOKENS,
    DEFAULT_NUM_CTX,
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_TEMPERATURE,
    DEFAULT_THINK,
)
from libre_chat.ui import BANNER_WIDTH, GRAY, RESET, SEP


class ChatBot:
    """
    Interactive terminal chatbot session against an Ollama model.

    Description:
        Encapsulates the REPL loop and per-turn state so subclasses
        can override hook methods for history persistence (e.g.
        SQLite) and context-compression strategies (e.g. RAG or
        rolling summaries) without rewriting the loop.

    Behavior:
        Mutable state lives on the instance (history, tokens_total,
        ctx_total, last_input_tokens) and is updated each turn.
        Call `.run()` to start the interactive loop.

    Hooks:
        _add_user_message, _add_assistant_message, _build_messages,
        _build_options, _resolve_ctx_total.
    """

    def __init__(
        self,
        model: str,
        system_prompt: str = DEFAULT_SYSTEM_PROMPT,
        temperature: float = DEFAULT_TEMPERATURE,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        num_ctx: int | None = DEFAULT_NUM_CTX,
        think: bool | str = DEFAULT_THINK,
    ) -> None:
        """
        Configure a ChatBot session.

        Description:
            Stores the model parameters and initializes empty
            in-memory history and token counters.

        Behavior:
            Pure setter — no I/O. Modelfile introspection is
            deferred to `_resolve_ctx_total()` (called by `run()`).

        Args:
            model: Ollama model name (e.g. llama3, qwen3.5:35b-a3b).
            system_prompt: Initial system prompt.
            temperature: Sampling temperature.
            max_tokens: Max tokens generated per response.
            num_ctx: Context window size in tokens. None = respect
                the Modelfile's PARAMETER num_ctx.
            think: False to disable thinking, True to enable, or
                'low'/'medium'/'high' for models that support levels.

        Return:
            None.
        """
        self.model = model
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.num_ctx = num_ctx
        self.think = think

        self.history: list[dict[str, str]] = []
        self.tokens_total: dict[str, int] = {"input": 0, "output": 0}
        self.last_input_tokens: int = 0
        self.ctx_total: int | None = num_ctx

    # ─── Main loop ────────────────────────────────────────────────────────

    def run(self) -> None:
        """
        Start the interactive REPL.

        Description:
            Resolves the model's context window, prints the opening
            separator, then loops reading user input until EOF,
            KeyboardInterrupt, or /quit.

        Behavior:
            Reads from stdin and writes to stdout. Dispatches slash
            commands and conversation turns. Updates instance state
            (history, tokens_total, last_input_tokens) each turn.

        Args:
            None.

        Return:
            None.
        """
        self._resolve_ctx_total()

        print(SEP)
        print()

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

    # ─── Commands ─────────────────────────────────────────────────────────

    def _handle_command(self, cmd: str) -> str | None:
        """
        Dispatch a slash command typed by the user.

        Description:
            Matches cmd against the known set (help, clear, system,
            tokens, context, quit/q) and runs the corresponding
            action.

        Behavior:
            Prints feedback to stdout. Mutates self.history on
            `/clear` and self.system_prompt on `/system`.

        Args:
            cmd: Command string without the leading '/', already
                stripped of surrounding whitespace.

        Return:
            'exit' if the REPL should break, else None.
        """
        if cmd in ("quit", "q"):
            return "exit"

        if cmd == "help":
            self._print_help()
            return None

        if cmd == "clear":
            self.history = []
            print("History cleared.")
            return None

        if cmd.startswith("system"):
            new = cmd[6:].strip()
            if new:
                self.system_prompt = new
                print(f"System prompt: {self.system_prompt}")
            else:
                print(f"Current system prompt: {self.system_prompt}")
            return None

        if cmd == "tokens":
            total = self.tokens_total["input"] + self.tokens_total["output"]
            print(f"Input:  {self.tokens_total['input']} tokens")
            print(f"Output: {self.tokens_total['output']} tokens")
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

        print(f"Unknown command: /{cmd}")
        return None

    def _print_help(self) -> None:
        """
        Print the list of available slash commands.

        Description:
            Shows every command with a one-line description.

        Behavior:
            Writes to stdout only; no state changes.

        Args:
            None.

        Return:
            None.
        """
        print("Available commands:")
        print("  /help            Show this help")
        print("  /clear           Reset conversation history")
        print("  /system [text]   Set system prompt (or show current if no arg)")
        print("  /tokens          Show cumulative input/output token counts")
        print("  /context         Show context window usage (used/total + %)")
        print("  /q, /quit        Exit")

    # ─── Turn ─────────────────────────────────────────────────────────────

    def _chat_turn(self, user_input: str) -> None:
        """
        Run a single user → assistant conversation turn.

        Description:
            Records the user message, calls Ollama with the composed
            message list, streams the reply, persists the assistant's
            message, and prints the end-of-turn stats separator.

        Behavior:
            Side effects: history append via hooks, token counters
            updated, network I/O to the Ollama server, writes to
            stdout.

        Args:
            user_input: Raw text entered at the `>>>` prompt.

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

        text, final_chunk = self._stream_response(stream)
        self._add_assistant_message(text)
        self._update_and_print_stats(final_chunk)

    def _stream_response(self, stream: Any) -> tuple[str, dict[str, Any] | None]:
        """
        Consume an Ollama streaming response and print it live.

        Description:
            Iterates over the streamed chunks, separating thinking
            tokens from content tokens and printing them with the
            appropriate ANSI styling and `>>> ` prefix.

        Behavior:
            Writes incrementally to stdout. Tracks phase transitions
            (thinking ↔ content) to insert the right prefix and
            blank-line spacing between them.

        Args:
            stream: Iterable of chunk dicts yielded by ollama.chat().

        Return:
            Tuple of (accumulated_content_text, final_chunk_or_None).
        """
        text = ""
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

        return text, final_chunk

    def _update_and_print_stats(self, final_chunk: dict[str, Any] | None) -> None:
        """
        Update token counters and print the end-of-turn context line.

        Description:
            Reads prompt_eval_count and eval_count from the final
            streamed chunk, updates cumulative and last-turn stats,
            and prints a gray line centered within the banner width
            with "Context: used/total (x.x%)".

        Behavior:
            Mutates self.tokens_total and self.last_input_tokens.
            Writes to stdout.

        Args:
            final_chunk: Last chunk returned by the stream, or None
                if the stream produced nothing.

        Return:
            None.
        """
        input_tokens = final_chunk.get("prompt_eval_count", 0) if final_chunk else 0
        output_tokens = final_chunk.get("eval_count", 0) if final_chunk else 0
        self.tokens_total["input"] += input_tokens
        self.tokens_total["output"] += output_tokens
        self.last_input_tokens = input_tokens

        if self.ctx_total and input_tokens:
            ctx_label = (
                f" Context: {input_tokens}/{self.ctx_total} "
                f"({input_tokens / self.ctx_total * 100:.1f}%) "
            )
        else:
            ctx_label = f" Context: {input_tokens}/? "
        left = "─" * ((BANNER_WIDTH - len(ctx_label)) // 2)
        right = "─" * (BANNER_WIDTH - len(ctx_label) - len(left))
        print()
        print(f"{GRAY}{left}{ctx_label}{right}{RESET}")
        print()

    # ─── Hooks (override in subclasses) ───────────────────────────────────

    def _add_user_message(self, content: str) -> None:
        """
        Record a user message in the history.

        Description:
            Default hook appending {role: user, content: ...} to
            the in-memory list. Override to persist to SQLite or
            send to another store.

        Behavior:
            Mutates self.history.

        Args:
            content: The user's raw input text.

        Return:
            None.
        """
        self.history.append({"role": "user", "content": content})

    def _add_assistant_message(self, content: str) -> None:
        """
        Record an assistant message in the history.

        Description:
            Default hook appending {role: assistant, content: ...}
            to the in-memory list. Override to persist to SQLite
            or send to another store.

        Behavior:
            Mutates self.history.

        Args:
            content: The assistant's accumulated response text.

        Return:
            None.
        """
        self.history.append({"role": "assistant", "content": content})

    def _build_messages(self) -> list[dict[str, str]]:
        """
        Compose the messages payload to send to the model.

        Description:
            Default implementation prepends the system prompt to
            the full in-memory history. Override to inject RAG
            retrievals, rolling summaries, or to prune old messages.

        Behavior:
            Pure — reads self.system_prompt and self.history, returns
            a fresh list.

        Args:
            None.

        Return:
            List of {role, content} dicts ordered as Ollama's chat
            API expects.
        """
        return [{"role": "system", "content": self.system_prompt}] + self.history

    def _build_options(self) -> dict[str, Any]:
        """
        Build the `options` kwarg for ollama.chat().

        Description:
            Always sets temperature and num_predict. Adds num_ctx
            only when explicitly configured (None respects the
            Modelfile's PARAMETER num_ctx).

        Behavior:
            Pure — reads instance config, returns a fresh dict.

        Args:
            None.

        Return:
            Dict suitable for the `options` parameter of ollama.chat.
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
        Populate self.ctx_total from the Modelfile if not set.

        Description:
            Calls ollama.show(model) and parses its `parameters`
            text for a `num_ctx <N>` line. Silently leaves
            ctx_total as None if the lookup fails.

        Behavior:
            Mutates self.ctx_total. Performs network I/O via Ollama.

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
