"""
ui.py
===========


Description:
-----------
Terminal UI primitives for libre_chat: ANSI color codes, the
ASCII-art startup banner (with per-character coloring), and the
gray separator line used between turns.

Handles:
- ANSI color constants (GRAY, RESET, plus internal banner palette)
- Colored BANNER (ANSI Shadow "libre chat" inside a Unicode box)
- SEP line used to separate turns
- print_ctx_line / replay_history / render_screen rendering helpers


Metadata:
----------
* Author: zxxz6 (Bryan Violante Arriaga)
* Version: 0.0.1-alpha
* License: MIT


History:
------------
Author      Date            Description
zxxz6       20/04/2026      Standardized function docstrings 
zxxz6       17/04/2026      Creation (extracted from chatbot.py)

"""

import os

from sqlalchemy import Engine
from sqlmodel import Session as DBSession, select

from libre_chat.models import ChatSession, Message  # noqa: F401  (ChatSession kept for future use)


# ─── ANSI color codes ─────────────────────────────────────────────────────

GRAY = "\033[90m"
RESET = "\033[0m"

_BLUE = "\033[94m"
_RED = "\033[91m"
_GREEN = "\033[92m"


# ─── Banner geometry ──────────────────────────────────────────────────────

BANNER_WIDTH = 78

_SHADOW_CHARS = set("╔╗╚╝═║")

_BANNER_RAW = """\
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║  ██╗     ██╗██████╗ ██████╗ ███████╗     ██████╗██╗  ██╗ █████╗ ████████╗  ║
║  ██║     ██║██╔══██╗██╔══██╗██╔════╝    ██╔════╝██║  ██║██╔══██╗╚══██╔══╝  ║
║  ██║     ██║██████╔╝██████╔╝█████╗      ██║     ███████║███████║   ██║     ║
║  ██║     ██║██╔══██╗██╔══██╗██╔══╝      ██║     ██╔══██║██╔══██║   ██║     ║
║  ███████╗██║██████╔╝██║  ██║███████╗    ╚██████╗██║  ██║██║  ██║   ██║     ║
║  ╚══════╝╚═╝╚═════╝ ╚═╝  ╚═╝╚══════╝     ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝     ║
║                                                                            ║
║                                                              v0.0.1-alpha  ║
╚════════════════════════════════════════════════════════════════════════════╝"""


def _render_banner() -> str:
    """
    Apply ANSI colors to the raw banner art.

    Description:
        Colors the outer Unicode box frame green, the letter
        glyphs (`█`) blue, and the letter shadow chars
        (`╔╗╚╝═║`) red. Non-art characters (e.g. the version
        label) keep the terminal's default color.

    Args:
        None.

    Return:
        Multi-line string ready to print as the startup banner.
    """
    lines = _BANNER_RAW.splitlines()
    out_lines = []
    for i, line in enumerate(lines):
        if i == 0 or i == len(lines) - 1:
            out_lines.append(f"{_GREEN}{line}{RESET}")
            continue
        if line.startswith("║") and line.endswith("║"):
            inner_chars = []
            for ch in line[1:-1]:
                if ch == "█":
                    inner_chars.append(f"{_BLUE}{ch}{RESET}")
                elif ch in _SHADOW_CHARS:
                    inner_chars.append(f"{_RED}{ch}{RESET}")
                else:
                    inner_chars.append(ch)
            out_lines.append(f"{_GREEN}║{RESET}{''.join(inner_chars)}{_GREEN}║{RESET}")
        else:
            out_lines.append(line)
    return "\n".join(out_lines)


# ─── Public exports ───────────────────────────────────────────────────────

BANNER: str = _render_banner()
SEP: str = f"{GRAY}{'─' * BANNER_WIDTH}{RESET}"


# ─── Rendering helpers ────────────────────────────────────────────────────

def print_ctx_line(input_tokens: int, ctx_total: int | None) -> None:
    """
    Draw the centered ``Context: used/total (x%)`` separator line.

    Description:
        Renders a gray horizontal rule spanning ``BANNER_WIDTH``
        columns with the usage label centered inside it. Used as
        the end-of-turn separator (both live and on replay).

    Args:
        input_tokens: Prompt-eval count of the turn being
            summarized.
        ctx_total: Total context window size, or None if unknown.

    Return:
        None.
    """
    if ctx_total and input_tokens:
        ctx_label = (
            f" Context: {input_tokens}/{ctx_total} "
            f"({input_tokens / ctx_total * 100:.1f}%) "
        )
    else:
        ctx_label = f" Context: {input_tokens}/? "
    left = "─" * ((BANNER_WIDTH - len(ctx_label)) // 2)
    right = "─" * (BANNER_WIDTH - len(ctx_label) - len(left))
    print()
    print(f"{GRAY}{left}{ctx_label}{right}{RESET}")
    print()


def replay_history(
    engine: Engine,
    session_id: int,
    ctx_total: int | None,
    thinking_log: dict[int, str],
) -> None:
    """
    Re-print stored messages of a session as if typed live.

    Description:
        Walks the session's messages in order and pairs each
        user message with its following assistant message to
        reconstruct the per-turn layout (user line, SEP,
        optional cached thinking block, assistant line, context
        bar). Orphan user messages without a reply are printed
        alone.

    Args:
        engine: SQLAlchemy engine pointing at the history DB.
        session_id: Session whose messages should be replayed.
        ctx_total: Total context window size, or None if unknown.
        thinking_log: In-memory map of Message.id → thinking text,
            populated during the current run.

    Return:
        None.
    """
    with DBSession(engine) as db:
        msgs = db.exec(
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(Message.id)  # type: ignore[arg-type]
        ).all()
    i = 0
    while i < len(msgs):
        m = msgs[i]
        if m.role == "user" and i + 1 < len(msgs) and msgs[i + 1].role == "assistant":
            a = msgs[i + 1]
            print(f">>> {m.content}")
            print()
            print(SEP)
            print()
            cached_thinking = thinking_log.get(a.id) if a.id else None
            if cached_thinking:
                print(f"\033[2m[thinking] {cached_thinking}\033[0m")
                print()
            print(f">>> {a.content}")
            print_ctx_line(a.input_tokens or 0, ctx_total)
            i += 2
        elif m.role == "user":
            print(f">>> {m.content}")
            i += 1
        else:
            i += 1


def render_screen(
    engine: Engine,
    model: str,
    session_id: int | None,
    title: str | None,
    ctx_total: int | None,
    thinking_log: dict[int, str],
    incognito: bool = False,
) -> None:
    """
    Clear the terminal and repaint header + replayed history.

    Description:
        Runs ``clear``, prints the ANSI banner, the status line
        (model + session/title + command hint), the opening
        separator, then replays the stored turns of the current
        session through ``replay_history``. Prepends a red
        ``[INCOGNITO]`` tag to the status line when in ephemeral
        mode so the user can tell at a glance.

    Args:
        engine: SQLAlchemy engine pointing at the history DB.
        model: Ollama model name shown in the status line.
        session_id: Currently active session id (None = no session).
        title: Session title (None → shown as "(untitled)").
        ctx_total: Total context window size, or None if unknown.
        thinking_log: In-memory map of Message.id → thinking text.
        incognito: When True, show the INCOGNITO indicator.

    Return:
        None.
    """
    os.system("clear")
    print(BANNER)
    shown_title = title or "(untitled)"
    session_label = (
        f"Session #{session_id}: {shown_title}"
        if session_id is not None else "(no session)"
    )
    prefix = f"{_RED}[INCOGNITO]{RESET}  " if incognito else ""
    print(f"{prefix}Model: {model}  |  {session_label}  |  Commands: /help /q")
    print()
    print(SEP)
    print()
    if session_id is not None:
        replay_history(engine, session_id, ctx_total, thinking_log)
