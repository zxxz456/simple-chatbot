"""
schemas.py
===========


Description:
-----------
Modelos Pydantic compartidos por todos los routers del server.
Definen el contrato HTTP que consume la app móvil (entradas con
``*In`` / ``*Patch`` y respuestas con ``*Out``).

Handles:
- Character: input/output (CRUD personajes)
- Session: input/patch/output + SessionFull compuesto
- Message: input/output
- Summary: input para compresión de contexto


Metadata:
----------
* Author: zxxz6 (Bryan Violante Arriaga)
* Version: 0.0.1-alpha
* License: MIT


History:
------------
Author      Date            Description
zxxz6       13/05/2026      Docs per-field via after-attribute strings
zxxz6       13/05/2026      Extracción desde server.py monolítico

"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ─── Characters ───────────────────────────────────────────────────────────

class CharacterIn(BaseModel):
    """
    Payload de creación / edición de personaje.

    Description:
        Mismo schema para ``POST /characters`` (crear) y
        ``PATCH /characters/{id}`` (reemplazo total). El server
        trimea ``name`` y rellena ``avatar`` con la inicial si
        viene vacío.
    """

    name: str
    """Nombre único del personaje; debe ser no-vacío tras trim."""

    avatar: str
    """1-2 chars o emoji para el círculo. Vacío → inicial del ``name``."""

    color: str
    """Color de fondo del avatar (``#RRGGBB``). Elegido en el cliente."""

    system_prompt: str
    """Prompt de sistema específico del personaje (su voz/persona)."""


class CharacterOut(BaseModel):
    """
    Respuesta con un personaje persistido.

    Description:
        Incluye los timestamps que el server genera (no vienen en
        el payload de entrada). ``from_attributes`` está activo
        para permitir ``model_validate`` desde rows SQLAlchemy.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    """Id autogenerado del personaje."""

    name: str
    """Nombre único."""

    avatar: str
    """Avatar resuelto (nunca vacío en la salida)."""

    color: str
    """Color de fondo del avatar."""

    system_prompt: str
    """Prompt de sistema asociado al personaje."""

    created_at: datetime
    """Timestamp UTC de creación."""

    updated_at: datetime
    """Timestamp UTC del último update."""


# ─── Sessions ─────────────────────────────────────────────────────────────

class SessionIn(BaseModel):
    """
    Payload de creación de sesión (``POST /sessions``).

    Description:
        ``title`` opcional — si se omite, el server lo deriva del
        primer mensaje de usuario. Si viene y choca con otra
        sesión, el endpoint responde 409.
    """

    model: str
    """Modelo de Ollama que usará la sesión (ej. ``llama3``)."""

    system_prompt: str = ""
    """Prompt base de la sesión (sobrescrito por personajes activos)."""

    title: Optional[str] = None
    """Título explícito; si es None se auto-derivará al primer turno."""

    scene: str = ""
    """Descripción de la escena (vista al móvil como bloque editable)."""


class SessionPatch(BaseModel):
    """
    Patch parcial de sesión (``PATCH /sessions/{id}``).

    Description:
        Sólo los campos no-None se aplican. ``title`` no-None que
        choque con otra sesión devuelve 409.
    """

    title: Optional[str] = None
    """Nuevo título; None = no tocar."""

    system_prompt: Optional[str] = None
    """Nuevo system prompt; None = no tocar."""

    scene: Optional[str] = None
    """Nueva escena; None = no tocar. Cadena vacía sí limpia."""

    model: Optional[str] = None
    """Cambio de modelo Ollama; None = no tocar."""


class SessionOut(BaseModel):
    """
    Respuesta con una sesión (sin mensajes).

    Description:
        Vista metadata-only usada por el drawer y por endpoints
        que devuelven la sesión tras un update. Para incluir
        mensajes y personajes ver ``SessionFull``.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    """Id autogenerado."""

    created_at: datetime
    """Timestamp UTC de creación de la sesión."""

    updated_at: datetime
    """Timestamp UTC del último cambio (mensaje, patch, etc.)."""

    title: Optional[str]
    """Título visible; None hasta que se derive del primer turno."""

    model: str
    """Modelo Ollama actual."""

    system_prompt: str
    """System prompt base."""

    scene: str
    """Escena descriptiva (puede ser cadena vacía)."""

    summary: str = ""
    """Resumen comprimido activo; vacío si no hay compresión."""

    summary_upto_message_id: Optional[int] = None
    """Id del último mensaje que cubre el resumen. None = sin resumen."""


class SummaryIn(BaseModel):
    """
    Payload para setear/reemplazar el resumen activo de una sesión.

    Description:
        Lo emite el móvil tras pedir compresión a Ollama. El
        próximo turno usará este resumen en lugar de los mensajes
        con id <= ``upto_message_id``.
    """

    content: str
    """Texto del resumen ya generado por el cliente."""

    upto_message_id: int
    """Id del último mensaje que el resumen incluye."""


# ─── Messages ─────────────────────────────────────────────────────────────

class MessageIn(BaseModel):
    """
    Payload para insertar un mensaje (``POST /sessions/{id}/messages``).

    Description:
        Stats de tokens y ``character_id`` son opcionales; sólo
        las respuestas de assistant las traen, los mensajes de
        usuario las dejan en None.
    """

    role: str
    """``"user"`` | ``"assistant"`` | ``"system"``."""

    content: str
    """Texto del mensaje (puede incluir Markdown inline)."""

    input_tokens: Optional[int] = None
    """``prompt_eval_count`` reportado por Ollama (sólo assistant)."""

    output_tokens: Optional[int] = None
    """``eval_count`` reportado por Ollama (sólo assistant)."""

    eval_duration_ns: Optional[int] = None
    """Duración de generación en ns (sólo assistant). Para tok/s."""

    character_id: Optional[int] = None
    """Id del personaje que emite el mensaje; None = assistant genérico."""


class MessageOut(BaseModel):
    """
    Respuesta con un mensaje persistido.

    Description:
        El móvil consume estas filas tanto en streaming (live)
        como en replay al abrir la conversación.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    """Id autogenerado del mensaje (ordenable cronológicamente)."""

    session_id: int
    """FK a ``sessions.id``."""

    role: str
    """Role del mensaje."""

    content: str
    """Texto."""

    created_at: datetime
    """Timestamp UTC de inserción."""

    input_tokens: Optional[int]
    """Tokens de prompt reportados por Ollama."""

    output_tokens: Optional[int]
    """Tokens generados reportados por Ollama."""

    eval_duration_ns: Optional[int]
    """Duración de generación en ns."""

    character_id: Optional[int]
    """Id del personaje que emitió el mensaje (si aplica)."""


# ─── Composite ────────────────────────────────────────────────────────────

class SessionFull(BaseModel):
    """
    Sesión + sus mensajes + personajes referenciados + activos.

    Description:
        Vista compuesta que devuelve ``GET /sessions/{id}``. Le
        permite al móvil renderear toda la pantalla de chat con
        una sola request (metadata, historial, avatares y picker
        de personajes).
    """

    session: SessionOut
    """Metadata de la sesión."""

    messages: list[MessageOut]
    """Historial completo, ordenado por id ASC."""

    characters: list[CharacterOut]
    """Todos los personajes referenciados (activos + huérfanos por
    mensajes históricos). Útil para renderear avatares incluso
    cuando un personaje ya no está activo en la sesión."""

    active_character_ids: list[int]
    """Subset que está activo para nuevos turnos en esta sesión."""
