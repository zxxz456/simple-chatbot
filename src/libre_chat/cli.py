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
zxxz6       20/04/2026      Banner/clear/intro line moved from LibreChat.run to main
zxxz6       17/04/2026      Added --num-ctx flag
zxxz6       16/04/2026      Creation

"""

import argparse
import os

from libre_chat import __version__
from libre_chat.chatbot import ChatBot
from libre_chat.config import (
    DEFAULT_MAX_TOKENS,
    DEFAULT_NUM_CTX,
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_TEMPERATURE,
    DEFAULT_THINK,
)
from libre_chat.ui import BANNER


def main() -> None:
    """
    Command-line entry point for libre-chat.

    Description:
        Parses CLI arguments, clears the terminal, prints the
        startup banner and model/commands line, then launches an
        interactive ChatBot session.

    Behavior:
        Reads sys.argv via argparse. Writes banner and intro line
        to stdout. Blocks until the REPL exits (user typed /q,
        hit Ctrl+C, or sent EOF).

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
        "-V", "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )
    args = parser.parse_args()

    os.system("clear")
    print(BANNER)
    print(f"Model: {args.model}  |  Commands: /help /q\n")

    ChatBot(
        model=args.model,
        system_prompt=args.system,
        temperature=args.temperature,
        max_tokens=args.max_tokens,
        num_ctx=args.num_ctx,
        think=args.think,
    ).run()


if __name__ == "__main__":
    main()
