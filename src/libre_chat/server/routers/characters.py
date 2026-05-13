"""
characters.py
===========


Description:
-----------
Endpoints de personajes (CRUD) y de su asociación con sesiones
(``session_characters``).

Endpoints:
- GET    /characters
- POST   /characters
- PATCH  /characters/{id}
- DELETE /characters/{id}
- PUT    /sessions/{id}/characters     → reemplaza la lista activa


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

from fastapi import APIRouter, Body, HTTPException
from sqlalchemy import text

from libre_chat.server.engine import get_engine
from libre_chat.server.helpers import (
    CHAR_COLS,
    char_row_to_out,
    load_characters_by_ids,
    now,
    touch_session,
)
from libre_chat.server.schemas import CharacterIn, CharacterOut

router = APIRouter(tags=["characters"])


@router.get("/characters", response_model=list[CharacterOut])
def list_characters() -> list[CharacterOut]:
    """
    Devuelve todos los personajes ordenados alfabéticamente.

    Description:
        Orden case-insensitive (``COLLATE NOCASE``) para que la
        lista del móvil quede natural. Sin paginación — se asume
        un puñado de personajes por usuario.

    Return:
        Lista de ``CharacterOut``, posiblemente vacía.
    """
    with get_engine().begin() as conn:
        rows = conn.execute(text(
            f"SELECT {CHAR_COLS} FROM characters ORDER BY name COLLATE NOCASE"
        )).fetchall()
        return [char_row_to_out(r) for r in rows]


@router.post("/characters", response_model=CharacterOut)
def create_character(payload: CharacterIn) -> CharacterOut:
    """
    Crea un personaje nuevo.

    Description:
        ``name`` se trimea y debe ser único (la tabla tiene UNIQUE
        en esa columna). Si ``avatar`` viene vacío, se usa la
        primera letra del nombre en mayúscula como fallback.

    Args:
        payload: ``name``, ``avatar``, ``color``, ``system_prompt``.

    Return:
        El ``CharacterOut`` recién creado con su id asignado.

    Raises:
        HTTPException 400 si el nombre queda vacío tras trim;
        HTTPException 409 si el nombre ya está en uso.
    """
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Name required")
    avatar = payload.avatar or name[:1].upper()
    ts = now()
    with get_engine().begin() as conn:
        clash = conn.execute(
            text("SELECT id FROM characters WHERE name = :n LIMIT 1"), {"n": name}
        ).fetchone()
        if clash is not None:
            raise HTTPException(409, "Name already in use")
        result = conn.execute(text("""
            INSERT INTO characters (name, avatar, color, system_prompt, created_at, updated_at)
            VALUES (:n, :a, :c, :sp, :ts, :ts)
        """), {
            "n": name, "a": avatar,
            "c": payload.color, "sp": payload.system_prompt, "ts": ts,
        })
        new_id = result.lastrowid
        return char_row_to_out((
            new_id, name, avatar, payload.color, payload.system_prompt, ts, ts,
        ))


@router.patch("/characters/{character_id}", response_model=CharacterOut)
def update_character(character_id: int, payload: CharacterIn) -> CharacterOut:
    """
    Actualiza un personaje existente (reemplazo total de campos).

    Description:
        Pese al verbo ``PATCH``, este endpoint pisa todos los
        campos del personaje con los valores del payload (mismo
        contrato que ``POST``). Si renombrar lo hace chocar contra
        otro personaje existente, responde 409.

    Args:
        character_id: Id del personaje a actualizar.
        payload: ``name``, ``avatar``, ``color``, ``system_prompt``.

    Return:
        El ``CharacterOut`` resultante después del update.

    Raises:
        HTTPException 400 si el nombre queda vacío tras trim;
        HTTPException 404 si el personaje no existe;
        HTTPException 409 si el nuevo nombre choca con otro
        personaje.
    """
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Name required")
    ts = now()
    with get_engine().begin() as conn:
        existing = conn.execute(
            text("SELECT id FROM characters WHERE id = :i"), {"i": character_id}
        ).fetchone()
        if existing is None:
            raise HTTPException(404, "Character not found")
        clash = conn.execute(text(
            "SELECT id FROM characters WHERE name = :n AND id != :i LIMIT 1"
        ), {"n": name, "i": character_id}).fetchone()
        if clash is not None:
            raise HTTPException(409, "Name already in use")
        conn.execute(text("""
            UPDATE characters
            SET name = :n, avatar = :a, color = :c, system_prompt = :sp, updated_at = :ts
            WHERE id = :i
        """), {
            "n": name, "a": payload.avatar or name[:1].upper(),
            "c": payload.color, "sp": payload.system_prompt, "ts": ts, "i": character_id,
        })
        row = conn.execute(text(
            f"SELECT {CHAR_COLS} FROM characters WHERE id = :i"
        ), {"i": character_id}).fetchone()
        if row is None:
            raise HTTPException(500, "Update failed")
        return char_row_to_out(row)


@router.delete("/characters/{character_id}")
def delete_character(character_id: int) -> dict[str, bool]:
    """
    Borra un personaje y todas sus asociaciones con sesiones.

    Description:
        Limpia también ``session_characters`` para que ninguna
        sesión quede apuntando a un id muerto. Los mensajes
        históricos con ``character_id`` viejo se conservan; el
        móvil pintará el avatar genérico cuando no encuentre el
        personaje en la lista.

    Args:
        character_id: Id del personaje a borrar.

    Return:
        ``{"ok": True}``. Idempotente.
    """
    with get_engine().begin() as conn:
        conn.execute(text("DELETE FROM characters WHERE id = :i"), {"i": character_id})
        conn.execute(
            text("DELETE FROM session_characters WHERE character_id = :i"),
            {"i": character_id},
        )
    return {"ok": True}


@router.put("/sessions/{session_id}/characters", response_model=list[CharacterOut])
def set_session_characters(
    session_id: int,
    payload: list[int] = Body(...),
) -> list[CharacterOut]:
    """
    Reemplaza la lista de personajes activos de una sesión.

    Description:
        Semántica de PUT: borra todas las asociaciones previas e
        inserta las nuevas. Pasar ``[]`` deja la sesión sin
        personajes activos (modo "assistant clásico"). Bumpea
        ``updated_at`` para que la sesión suba en el drawer.

    Args:
        session_id: Id de la sesión.
        payload: Lista de ids de personajes a marcar como activos.

    Return:
        Lista de ``CharacterOut`` con los personajes activos
        resultantes, en el orden devuelto por SQLite.
    """
    with get_engine().begin() as conn:
        conn.execute(
            text("DELETE FROM session_characters WHERE session_id = :s"),
            {"s": session_id},
        )
        for cid in payload:
            conn.execute(
                text("INSERT INTO session_characters (session_id, character_id) VALUES (:s, :c)"),
                {"s": session_id, "c": cid},
            )
        touch_session(conn, session_id)
        return load_characters_by_ids(conn, payload)
