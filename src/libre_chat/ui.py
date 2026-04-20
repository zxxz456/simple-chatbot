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


Metadata:
----------
* Author: zxxz6 (Bryan Violante Arriaga)
* Version: 0.0.1-alpha
* License: MIT


History:
------------
Author      Date            Description
zxxz6       17/04/2026      Creation (extracted from chatbot.py)

"""

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
        Colors the outer Unicode box frame green, the letter glyphs
        (`█`) blue, and the letter shadow chars (`╔╗╚╝═║`) red.
        Non-art characters (e.g. the version label) keep the
        terminal's default color.

    Behavior:
        Pure — reads _BANNER_RAW and returns a new string with
        embedded ANSI escape codes.

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
