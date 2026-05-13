"""
messages.py
===========


Description:
-----------
Endpoints de mensajes dentro de una sesión, incluyendo el
"rebobinar" (borrar un mensaje + todos los posteriores).

Endpoints:
- GET    /sessions/{id}/messages
- POST   /sessions/{id}/messages
- DELETE /sessions/{id}/messages
- DELETE /sessions/{id}/messages/{mid}   → rebobinar


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

from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlmodel import Session as DBSession, select

from libre_chat.models import ChatSession, Message
from libre_chat.server.engine import get_engine
from libre_chat.server.helpers import (
    msg_to_out,
    now,
    touch_session,
    unique_session_title,
)
from libre_chat.server.schemas import MessageIn, MessageOut

router = APIRouter(tags=["messages"])


@router.get("/sessions/{session_id}/messages", response_model=list[MessageOut])
def list_messages(session_id: int) -> list[MessageOut]:
    """
    Lista todos los mensajes de una sesión ordenados por id ASC.

    Description:
        No pagina — el móvil renderea la lista completa. Si una
        sesión crece a miles de mensajes habría que paginar; por
        ahora la compresión (resumen + ``summary_upto_message_id``)
        es el mecanismo para mantener el contexto manejable.

    Args:
        session_id: Id de la sesión a leer.

    Return:
        Lista de ``MessageOut`` en orden cronológico.
    """
    with DBSession(get_engine()) as db:
        msgs = db.exec(
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(Message.id)  # type: ignore[arg-type]
        ).all()
        return [msg_to_out(m) for m in msgs]


@router.post("/sessions/{session_id}/messages", response_model=MessageOut)
def add_message(session_id: int, payload: MessageIn) -> MessageOut:
    """
    Inserta un mensaje y bumpea ``sessions.updated_at``.

    Description:
        Si el mensaje es el primer ``user`` de la sesión y la sesión
        aún no tiene título, se deriva uno del contenido (primeros
        60 caracteres) y se deduplica via ``unique_session_title``.
        Se inserta por SQL crudo para poder setear ``character_id``,
        que no está en el modelo SQLModel del CLI.

    Args:
        session_id: Id de la sesión destino.
        payload: ``role``, ``content``, stats opcionales,
            ``character_id`` opcional.

    Return:
        El ``MessageOut`` recién insertado, con id asignado.

    Raises:
        HTTPException 404 si la sesión no existe;
        HTTPException 500 si el insert no devuelve el row.
    """
    with DBSession(get_engine()) as db:
        session = db.get(ChatSession, session_id)
        if session is None:
            raise HTTPException(404, "Session not found")
        ts = now()
        # Insert via raw SQL para poder setear character_id (no está
        # en el modelo SQLModel del CLI).
        result = db.exec(text("""
            INSERT INTO messages (
                session_id, role, content, created_at,
                input_tokens, output_tokens, eval_duration_ns, character_id
            ) VALUES (
                :sid, :role, :content, :ts,
                :it, :ot, :ed, :cid
            )
        """).bindparams(
            sid=session_id, role=payload.role, content=payload.content, ts=ts,
            it=payload.input_tokens, ot=payload.output_tokens,
            ed=payload.eval_duration_ns, cid=payload.character_id,
        ))
        new_id = result.lastrowid
        # Auto-título si era el primer ``user`` y aún no había título.
        if payload.role == "user" and not session.title:
            base = " ".join(payload.content.split())[:60]
            if base:
                session.title = unique_session_title(db, base, session_id)
        session.updated_at = ts
        db.add(session)
        db.commit()
        row = db.get(Message, new_id)
        if row is None:
            raise HTTPException(500, "Insert failed")
        return msg_to_out(row, character_id=payload.character_id)


@router.delete("/sessions/{session_id}/messages")
def clear_messages(session_id: int) -> dict[str, bool]:
    """
    Borra todos los mensajes de la sesión, sin tocar la sesión en sí.

    Description:
        Equivalente al ``/clear`` del CLI. La sesión queda viva
        (mantiene título, modelo, escena, resumen, personajes
        activos) y lista para empezar una nueva conversación.

    Args:
        session_id: Id de la sesión cuyos mensajes se borran.

    Return:
        ``{"ok": True}``.
    """
    with get_engine().begin() as conn:
        conn.execute(text("DELETE FROM messages WHERE session_id = :s"), {"s": session_id})
        touch_session(conn, session_id)
    return {"ok": True}


@router.delete("/sessions/{session_id}/messages/{message_id}")
def rewind_from_message(session_id: int, message_id: int) -> dict[str, int]:
    """
    "Rebobinar": borra el mensaje indicado + todos los con id mayor
    en la misma sesión. Equivale a regresar la conversación al
    estado previo a ese turno.
    """
    with get_engine().begin() as conn:
        result = conn.execute(text(
            "DELETE FROM messages WHERE session_id = :s AND id >= :m"
        ), {"s": session_id, "m": message_id})
        touch_session(conn, session_id)
    return {"deleted": result.rowcount or 0}
