"""
config.py
===========


Description:
-----------
Loads configuration for the libre_chat package from
`config.yml` at the project root. Falls back to sane built-in
defaults if the file is missing or a key is absent.

Handles:
- Locating and parsing config.yml
- Exposing typed constants (DEFAULT_*) consumed by chatbot and CLI


Metadata:
----------
* Author: zxxz6 (Bryan Violante Arriaga)
* Version: 0.0.1-alpha
* License: MIT


History:
------------
Author      Date            Description
zxxz6       20/04/2026      DB_PATH, package rename, docstrings
zxxz6       19/04/2026      Added DEFAULT_NUM_CTX (Ollama context window size)
zxxz6       18/04/2026      Switched from hard-coded constants to YAML loader
zxxz6       17/04/2026      Creation

"""

import os
from pathlib import Path
from typing import Any

import yaml


# ─── Path resolution ──────────────────────────────────────────────────────

# config.py lives at <root>/src/libre_chat/config.py
# so parents[2] is the project root.
PROJECT_ROOT: Path = Path(__file__).resolve().parents[2]
CONFIG_PATH: Path = PROJECT_ROOT / "config.yml"


# ─── Built-in fallbacks ───────────────────────────────────────────────────

def _xdg_data_home() -> Path:
    """
    Resolve the XDG data directory for the current user.

    Description:
        Returns ``$XDG_DATA_HOME`` if it's set and non-empty,
        otherwise falls back to ``~/.local/share`` per the XDG
        Base Directory spec.

    Args:
        None.

    Return:
        Path to the user's data root (no existence check).
    """
    raw = os.environ.get("XDG_DATA_HOME")
    return Path(raw) if raw else Path.home() / ".local" / "share"


DEFAULT_DB_PATH_FALLBACK: Path = _xdg_data_home() / "libre_chat" / "history.db"


_FALLBACK: dict[str, Any] = {
    "system_prompt": "",
    "temperature": 0.80,
    "max_tokens": 2048,
    "num_ctx": None,
    "think": False,
    "db_path": None,
}


def _load() -> dict[str, Any]:
    """
    Load the user config, falling back to built-in defaults.

    Description:
        Reads ``CONFIG_PATH`` (project-root ``config.yml``). A
        missing file yields a copy of ``_FALLBACK``. Existing
        keys in the YAML override fallback values. Called once
        at import time; the result is cached into ``_cfg``.

    Args:
        None.

    Return:
        Merged dict with all expected config keys.
    """
    if not CONFIG_PATH.is_file():
        return dict(_FALLBACK)
    with CONFIG_PATH.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return {**_FALLBACK, **data}


_cfg = _load()


# ─── Exported constants ───────────────────────────────────────────────────

DEFAULT_SYSTEM_PROMPT: str = _cfg["system_prompt"]
DEFAULT_TEMPERATURE: float = float(_cfg["temperature"])
DEFAULT_MAX_TOKENS: int = int(_cfg["max_tokens"])
DEFAULT_NUM_CTX: int | None = (
    int(_cfg["num_ctx"]) if _cfg["num_ctx"] is not None else None
)
DEFAULT_THINK: bool | str = _cfg["think"]
DEFAULT_DB_PATH: Path = (
    Path(_cfg["db_path"]).expanduser()
    if _cfg["db_path"]
    else DEFAULT_DB_PATH_FALLBACK
)
