"""
models.py
===========


Description:
-----------
SQLModel tables for libre_chat persistence. Defines the two
entities that back the chat history on disk: a conversation
session and the individual messages exchanged within it.

Handles:
- ChatSession table (conversation metadata)
- Message table (user/assistant/system turns)


Metadata:
----------
* Author: zxxz6 (Bryan Violante Arriaga)
* Version: 0.0.1-alpha
* License: MIT


History:
------------
Author      Date            Description
zxxz6       13/05/2026      Docs per-field (props) en ChatSession/Message
zxxz6       20/04/2026      Creation

"""

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


def _now() -> datetime:
    """
    Return the current UTC timestamp as a timezone-aware datetime.

    Description:
        Used as the ``default_factory`` for ``created_at`` and
        ``updated_at`` so all rows share the same UTC clock.

    Args:
        None.

    Return:
        Aware ``datetime`` in UTC.
    """
    return datetime.now(timezone.utc)


class ChatSession(SQLModel, table=True):
    """
    A conversation session.

    Description:
        Tracks one end-to-end chat: when it started, when it was
        last touched, which model/system_prompt were in use, and
        an optional title (auto-derived from the first user
        message). Messages link back via ``session_id``.

        Note: this model declares only the columns the Python CLI
        needs. The server adds extra columns at runtime via raw
        SQL (``scene``, ``summary``, ``summary_upto_message_id``)
        so the CLI doesn't get coupled to mobile-only features.

    Behavior:
        On delete the relationship cascades to ``messages`` rows
        (via SQLAlchemy's ``cascade='all, delete-orphan'``); the
        server's ``DELETE /sessions/{id}`` also cleans
        ``session_characters`` manually since that table is
        outside the SQLModel metadata.
    """

    __tablename__ = "sessions"

    id: Optional[int] = Field(default=None, primary_key=True)
    """Primary key. Auto-assigned by SQLite on insert."""

    created_at: datetime = Field(default_factory=_now)
    """UTC timestamp set once on creation."""

    updated_at: datetime = Field(default_factory=_now)
    """UTC timestamp bumped on every mutation (turn, rename, patch)."""

    title: Optional[str] = Field(default=None, max_length=120)
    """Human-readable title. None until the first user message
    arrives; then auto-derived (deduplicated against existing
    titles via a partial UNIQUE index on non-NULL values)."""

    model: str
    """Ollama model name pinned to this session (e.g. ``llama3``)."""

    system_prompt: str = ""
    """System prompt active for the session. May be overridden per
    turn by character-specific prompts in the mobile client."""

    messages: list["Message"] = Relationship(
        back_populates="session",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    """Reverse relationship: messages belonging to this session,
    in insertion order. Deleting the session cascades to these."""


class Message(SQLModel, table=True):
    """
    A single turn within a ChatSession.

    Description:
        One row per user input or assistant reply. For assistant
        rows we also record token and duration stats extracted from
        the final Ollama chunk so tokens/sec can be reconstructed
        across sessions.

        The mobile server adds an extra ``character_id`` column at
        runtime via raw SQL — it's not declared here so the CLI
        stays independent of the multi-character feature.
    """

    __tablename__ = "messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    """Primary key. Auto-assigned by SQLite; also doubles as the
    chronological order key (``ORDER BY id ASC``)."""

    session_id: int = Field(foreign_key="sessions.id", index=True)
    """FK to ``sessions.id``. Indexed because every read filters
    by it."""

    role: str
    """``"user"`` | ``"assistant"`` | ``"system"``. Stored as a
    plain string instead of an enum so the column survives schema
    drift if new roles are introduced."""

    content: str
    """Verbatim message text. May contain Markdown inline tokens
    (``**bold**``, ``_italic_``, etc.) which the mobile client
    parses on render."""

    created_at: datetime = Field(default_factory=_now)
    """UTC timestamp at insert time."""

    input_tokens: Optional[int] = None
    """``prompt_eval_count`` from Ollama's final chunk. Only set
    on assistant rows; None on user/system rows."""

    output_tokens: Optional[int] = None
    """``eval_count`` from Ollama's final chunk (generated tokens).
    Only set on assistant rows."""

    eval_duration_ns: Optional[int] = None
    """``eval_duration`` in nanoseconds. Combined with
    ``output_tokens`` to compute tokens/sec on replay."""

    session: Optional[ChatSession] = Relationship(back_populates="messages")
    """Forward relationship back to the owning ``ChatSession``."""
