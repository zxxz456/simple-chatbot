"""
helpers.py
===========


Description:
-----------
Helpers compartidos por los routers del server: mapeo de filas SQL
a esquemas Pydantic, bump de ``updated_at``, lookup masivo de
personajes y dedup de títulos de sesión.

Centralizar estos helpers evita que cada router repita el mismo
``model_validate`` o el mismo ``UPDATE sessions SET updated_at``.


Metadata:
----------
* Author: zxxz6 (Bryan Violante Arriaga)
* Version: 0.0.1-alpha
* License: MIT


History:
------------
Author      Date            Description
zxxz6       13/05/2026      Extracción desde server.py monolítico

"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable, Optional

from sqlalchemy import Engine, text
from sqlalchemy.engine import Connection
from sqlmodel import Session as DBSession, select

from libre_chat.models import ChatSession, Message
from libre_chat.server.engine import get_engine
from libre_chat.server.schemas import CharacterOut, MessageOut, SessionOut


# Orden canónico del SELECT contra ``characters``. Debe coincidir con
# los índices que consume ``char_row_to_out`` (0..6).
CHAR_COLS = "id, name, avatar, color, system_prompt, created_at, updated_at"


def now() -> datetime:
    """Timestamp UTC actual con tzinfo."""
    return datetime.now(timezone.utc)


def char_row_to_out(r: Any) -> CharacterOut:
    """Mapea una fila (tuple) de ``characters`` a ``CharacterOut``.

    Description:
        La fila debe respetar el orden de ``CHAR_COLS``.
    """
    return CharacterOut.model_validate({
        "id": r[0],
        "name": r[1],
        "avatar": r[2],
        "color": r[3],
        "system_prompt": r[4],
        "created_at": r[5],
        "updated_at": r[6],
    })


def msg_to_out(m: Message, character_id: Optional[int] = None) -> MessageOut:
    """Mapea un ``Message`` SQLModel a ``MessageOut``.

    Description:
        ``character_id`` no existe en el modelo SQLModel del CLI;
        se lee con ``getattr`` si no se pasa explícito.
    """
    cid = character_id if character_id is not None else getattr(m, "character_id", None)
    return MessageOut.model_validate({
        "id": m.id,
        "session_id": m.session_id,
        "role": m.role,
        "content": m.content,
        "created_at": m.created_at,
        "input_tokens": m.input_tokens,
        "output_tokens": m.output_tokens,
        "eval_duration_ns": m.eval_duration_ns,
        "character_id": cid,
    })


def touch_session(conn: Connection, session_id: int) -> None:
    """Bump de ``sessions.updated_at`` para marcar actividad reciente."""
    conn.execute(
        text("UPDATE sessions SET updated_at = :u WHERE id = :i"),
        {"u": now(), "i": session_id},
    )


def load_characters_by_ids(
    conn: Connection, ids: Iterable[int]
) -> list[CharacterOut]:
    """Carga personajes por id usando un IN dinámico (vacío → ``[]``)."""
    id_list = list(ids)
    if not id_list:
        return []
    rows = conn.execute(text(
        f"SELECT {CHAR_COLS} FROM characters "
        f"WHERE id IN ({','.join('?' * len(id_list))})"
    ).bindparams(*id_list)).fetchall()
    return [char_row_to_out(r) for r in rows]


def unique_session_title(db: DBSession, base: str, exclude_id: int) -> str:
    """Devuelve ``base`` o ``"<base> (n)"`` para el menor n libre.

    Description:
        Excluye la propia sesión para que renombrarla a su título
        actual no sea un clash.
    """
    candidate = base
    n = 1
    while True:
        clash = db.exec(
            select(ChatSession).where(
                ChatSession.title == candidate,
                ChatSession.id != exclude_id,
            )
        ).first()
        if clash is None:
            return candidate
        n += 1
        candidate = f"{base} ({n})"


def session_to_out(row: ChatSession, engine: Optional[Engine] = None) -> SessionOut:
    """Convierte una fila ChatSession a SessionOut, jalando scene/summary
    por SQL crudo (no son columnas del modelo SQLModel del CLI)."""
    eng = engine or get_engine()
    with eng.begin() as conn:
        extras = conn.exec_driver_sql(
            "SELECT scene, summary, summary_upto_message_id FROM sessions WHERE id = ?",
            (row.id,),
        ).fetchone()
    scene = (extras[0] if extras else "") or ""
    summary = (extras[1] if extras else "") or ""
    summary_upto = extras[2] if extras else None
    return SessionOut.model_validate({
        "id": row.id,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "title": row.title,
        "model": row.model,
        "system_prompt": row.system_prompt,
        "scene": scene,
        "summary": summary,
        "summary_upto_message_id": summary_upto,
    })
