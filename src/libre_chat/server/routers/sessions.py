"""
sessions.py
===========


Description:
-----------
Endpoints CRUD para ``ChatSession`` y operaciones asociadas
(resumen comprimido, vista compuesta ``SessionFull``).

Endpoints:
- GET    /sessions
- POST   /sessions
- GET    /sessions/{id}              → ``SessionFull`` (sesión + mensajes + personajes)
- PATCH  /sessions/{id}
- DELETE /sessions/{id}
- POST   /sessions/{id}/summary
- DELETE /sessions/{id}/summary


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
    load_characters_by_ids,
    msg_to_out,
    now,
    session_to_out,
)
from libre_chat.server.schemas import (
    SessionFull,
    SessionIn,
    SessionOut,
    SessionPatch,
    SummaryIn,
)

router = APIRouter(tags=["sessions"])


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(limit: int = 50) -> list[SessionOut]:
    """
    Lista las sesiones más recientes ordenadas por ``updated_at`` desc.

    Description:
        Punto de entrada del drawer del móvil. No incluye mensajes
        — sólo metadata de cada sesión (id, título, modelo, escena,
        resumen activo). Para una sesión completa usar
        ``GET /sessions/{id}``.

    Args:
        limit: Máximo de sesiones a devolver (default 50).

    Return:
        Lista de ``SessionOut``, posiblemente vacía.
    """
    with DBSession(get_engine()) as db:
        rows = db.exec(
            select(ChatSession).order_by(ChatSession.updated_at.desc()).limit(limit)  # type: ignore[union-attr]
        ).all()
        return [session_to_out(r) for r in rows]


@router.post("/sessions", response_model=SessionOut)
def create_session(payload: SessionIn) -> SessionOut:
    """
    Crea una sesión nueva.

    Description:
        Si ``title`` viene en el payload y ya existe otra sesión con
        ese mismo título, responde 409. ``scene`` se persiste por
        SQL crudo porque no es columna del modelo SQLModel del CLI.

    Args:
        payload: ``model``, ``system_prompt``, ``title?``, ``scene``.

    Return:
        La ``SessionOut`` recién creada con su id asignado.
    """
    with DBSession(get_engine()) as db:
        if payload.title:
            clash = db.exec(
                select(ChatSession).where(ChatSession.title == payload.title)
            ).first()
            if clash is not None:
                raise HTTPException(409, "Title already in use")
        row = ChatSession(
            model=payload.model,
            system_prompt=payload.system_prompt,
            title=payload.title,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        # ``scene`` no es columna del modelo SQLModel del CLI.
        if payload.scene:
            db.exec(text(
                "UPDATE sessions SET scene = :s, updated_at = :u WHERE id = :i"
            ).bindparams(s=payload.scene, u=now(), i=row.id))
            db.commit()
        out = session_to_out(row)
        out.scene = payload.scene
        return out


@router.get("/sessions/{session_id}", response_model=SessionFull)
def get_session(session_id: int) -> SessionFull:
    """
    Devuelve la sesión + mensajes + personajes referenciados.

    Description:
        Vista "full" para la pantalla de chat del móvil. Incluye
        todos los mensajes (sin paginar) y los personajes que
        aparezcan tanto como activos como referenciados por
        mensajes históricos (para poder pintar avatares en
        mensajes antiguos aunque el personaje ya no esté activo).

    Args:
        session_id: Id de la sesión a leer.

    Return:
        ``SessionFull`` con session, messages, characters,
        active_character_ids.

    Raises:
        HTTPException 404 si la sesión no existe.
    """
    with DBSession(get_engine()) as db:
        session = db.get(ChatSession, session_id)
        if session is None:
            raise HTTPException(404, "Session not found")
        msgs = db.exec(
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(Message.id)  # type: ignore[arg-type]
        ).all()
        # Personajes referenciados por mensajes + activos en sesión.
        char_ids: set[int] = {
            cid for m in msgs
            if (cid := getattr(m, "character_id", None)) is not None
        }
        active_rows = db.exec(text(
            "SELECT character_id FROM session_characters WHERE session_id = :s"
        ).bindparams(s=session_id)).all()
        active_ids = [row[0] for row in active_rows]
        char_ids.update(active_ids)
        with get_engine().begin() as conn:
            characters = load_characters_by_ids(conn, char_ids)
        return SessionFull(
            session=session_to_out(session),
            messages=[msg_to_out(m) for m in msgs],
            characters=characters,
            active_character_ids=active_ids,
        )


@router.patch("/sessions/{session_id}", response_model=SessionOut)
def patch_session(session_id: int, payload: SessionPatch) -> SessionOut:
    """
    Actualiza campos parciales de una sesión existente.

    Description:
        Sólo aplica los campos que vengan no-None en ``payload``.
        Renombrar a un título ya ocupado (en otra sesión) responde
        409. ``scene`` se persiste por SQL crudo. Bumpea
        ``updated_at`` siempre que entra al endpoint.

    Args:
        session_id: Id de la sesión a actualizar.
        payload: Campos opcionales (``title``, ``system_prompt``,
            ``scene``, ``model``).

    Return:
        La ``SessionOut`` resultante después del update.

    Raises:
        HTTPException 404 si la sesión no existe;
        HTTPException 409 si ``title`` choca con otra sesión.
    """
    with DBSession(get_engine()) as db:
        row = db.get(ChatSession, session_id)
        if row is None:
            raise HTTPException(404, "Session not found")
        if payload.title is not None and payload.title != row.title:
            clash = db.exec(
                select(ChatSession).where(
                    ChatSession.title == payload.title,
                    ChatSession.id != session_id,
                )
            ).first()
            if clash is not None:
                raise HTTPException(409, "Title already in use")
            row.title = payload.title
        if payload.system_prompt is not None:
            row.system_prompt = payload.system_prompt
        if payload.model is not None:
            row.model = payload.model
        row.updated_at = now()
        db.add(row)
        db.commit()
        db.refresh(row)
        if payload.scene is not None:
            db.exec(text(
                "UPDATE sessions SET scene = :s, updated_at = :u WHERE id = :i"
            ).bindparams(s=payload.scene, u=now(), i=session_id))
            db.commit()
        out = session_to_out(row)
        if payload.scene is not None:
            out.scene = payload.scene
        return out


@router.delete("/sessions/{session_id}")
def delete_session(session_id: int) -> dict[str, bool]:
    """
    Borra una sesión completa más todas sus filas dependientes.

    Description:
        El FK de ``messages.session_id`` no tiene cascade declarado,
        así que limpiamos a mano ``messages`` y ``session_characters``
        en una segunda transacción. Idempotente: si la sesión no
        existía, devuelve ``{"ok": True}`` igual.

    Args:
        session_id: Id de la sesión a borrar.

    Return:
        ``{"ok": True}`` siempre que termine sin excepción.
    """
    with DBSession(get_engine()) as db:
        row = db.get(ChatSession, session_id)
        if row is not None:
            db.delete(row)
            db.commit()
    # Cleanup manual (FK cascade no estaba declarado).
    with get_engine().begin() as conn:
        conn.execute(text("DELETE FROM messages WHERE session_id = :s"), {"s": session_id})
        conn.execute(
            text("DELETE FROM session_characters WHERE session_id = :s"),
            {"s": session_id},
        )
    return {"ok": True}


@router.post("/sessions/{session_id}/summary", response_model=SessionOut)
def set_summary(session_id: int, payload: SummaryIn) -> SessionOut:
    """
    Persiste el resumen activo de una sesión + el id del último
    mensaje que cubre. El siguiente turno usará este resumen como
    contexto en vez de los mensajes con id <= upto_message_id.
    """
    with DBSession(get_engine()) as db:
        row = db.get(ChatSession, session_id)
        if row is None:
            raise HTTPException(404, "Session not found")
        with get_engine().begin() as conn:
            conn.execute(text(
                "UPDATE sessions SET summary = :s, summary_upto_message_id = :u, "
                "updated_at = :t WHERE id = :i"
            ), {"s": payload.content, "u": payload.upto_message_id, "t": now(), "i": session_id})
        db.refresh(row)
        return session_to_out(row)


@router.delete("/sessions/{session_id}/summary", response_model=SessionOut)
def clear_summary(session_id: int) -> SessionOut:
    """Borra el resumen activo — todos los mensajes vuelven al contexto."""
    with DBSession(get_engine()) as db:
        row = db.get(ChatSession, session_id)
        if row is None:
            raise HTTPException(404, "Session not found")
        with get_engine().begin() as conn:
            conn.execute(text(
                "UPDATE sessions SET summary = '', summary_upto_message_id = NULL, "
                "updated_at = :t WHERE id = :i"
            ), {"t": now(), "i": session_id})
        db.refresh(row)
        return session_to_out(row)
