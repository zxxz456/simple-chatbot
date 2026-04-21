"""
cli.py
===========


Description:
-----------
Command-line entry point for the libre_chat package.
Parses arguments and launches the chatbot loop.

Handles:
- Argument parsing (model, system prompt, temperature, max tokens)
- Version reporting
- Delegation to `ChatBot.run`


Metadata:
----------
* Author: zxxz6 (Bryan Violante Arriaga)
* Version: 0.0.1-alpha
* License: MIT


History:
------------
Author      Date            Description
zxxz6       20/04/2026      Persistence, incognito, docstrings
zxxz6       17/04/2026      Added --num-ctx flag
zxxz6       16/04/2026      Creation

"""

import argparse
from pathlib import Path

from sqlmodel import Session as DBSession, select

from libre_chat import __version__
from libre_chat.chatbot import ChatBot, resolve_session_id
from libre_chat.config import (
    DEFAULT_DB_PATH,
    DEFAULT_MAX_TOKENS,
    DEFAULT_NUM_CTX,
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_TEMPERATURE,
    DEFAULT_THINK,
)
from libre_chat.db import make_engine, make_memory_engine
from libre_chat.models import ChatSession


def main() -> None:
    """
    Command-line entry point for libre-chat.

    Description:
        Parses CLI arguments, opens (or creates) the SQLite
        history file, optionally prints the session list and
        exits, otherwise launches an interactive ChatBot. The
        banner and intro line are now painted by ChatBot itself.

    Args:
        None.

    Return:
        None.
    """
    parser = argparse.ArgumentParser(
        prog="libre-chat",
        description="Chatbot de terminal multi-turno con Ollama",
    )
    parser.add_argument(
        "-m", "--model",
        default="llama3",
        help="Nombre del modelo de Ollama (ej: llama3, qwen3.5:35b-a3b)",
    )
    parser.add_argument(
        "-s", "--system",
        default=DEFAULT_SYSTEM_PROMPT,
        help="System prompt inicial",
    )
    parser.add_argument(
        "-t", "--temperature",
        type=float,
        default=DEFAULT_TEMPERATURE,
        help="Temperatura de muestreo (default: %(default)s)",
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=DEFAULT_MAX_TOKENS,
        help="Máximo de tokens por respuesta (default: %(default)s)",
    )
    parser.add_argument(
        "--num-ctx",
        type=int,
        default=DEFAULT_NUM_CTX,
        help="Sobreescribe num_ctx del Modelfile (default: %(default)s, "
             "None = respetar Modelfile)",
    )
    parser.add_argument(
        "--think",
        nargs="?",
        const=True,
        default=DEFAULT_THINK,
        choices=[True, "low", "medium", "high"],
        help="Activa thinking. Sin valor = True; admite 'low'/'medium'/'high'. "
             "Por defecto desactivado.",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB_PATH,
        help=f"Ruta al archivo SQLite (default: {DEFAULT_DB_PATH})",
    )
    parser.add_argument(
        "--session",
        type=str,
        default=None,
        help="ID numérico o título exacto de una sesión existente para "
             "continuar. Si se omite, arranca una sesión nueva.",
    )
    parser.add_argument(
        "--list-sessions",
        action="store_true",
        help="Lista las sesiones guardadas y sale.",
    )
    parser.add_argument(
        "--incognito",
        action="store_true",
        help="Modo incógnito: DB en memoria, nada se escribe a disco.",
    )
    parser.add_argument(
        "-V", "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )
    args = parser.parse_args()

    if args.incognito and args.session is not None:
        raise SystemExit("--incognito cannot be combined with --session (nothing to resume).")
    if args.incognito and args.list_sessions:
        raise SystemExit("--incognito cannot be combined with --list-sessions.")

    engine = make_memory_engine() if args.incognito else make_engine(args.db)

    if args.list_sessions:
        _print_sessions(engine)
        return

    session_id: int | None = None
    if args.session is not None:
        session_id = resolve_session_id(engine, args.session)
        if session_id is None:
            raise SystemExit(f"No session matching '{args.session}'.")

    ChatBot(
        model=args.model,
        engine=engine,
        session_id=session_id,
        system_prompt=args.system,
        temperature=args.temperature,
        max_tokens=args.max_tokens,
        num_ctx=args.num_ctx,
        think=args.think,
        incognito=args.incognito,
    ).run()


def _print_sessions(engine: object, limit: int = 50) -> None:
    """
    Print a table of the most-recently-updated sessions.

    Description:
        Used by ``--list-sessions`` to show what the SQLite file
        contains without launching the REPL. Shows id, updated
        timestamp, model, and title.

    Args:
        engine: SQLAlchemy engine for the history DB.
        limit: Maximum number of sessions to display.

    Return:
        None.
    """
    with DBSession(engine) as db:  # type: ignore[arg-type]
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
        stamp = s.updated_at.strftime("%Y-%m-%d %H:%M:%S")
        title = s.title or "(untitled)"
        print(f"{s.id:>4}  {stamp}  {s.model[:24]:24}  {title}")


if __name__ == "__main__":
    main()
