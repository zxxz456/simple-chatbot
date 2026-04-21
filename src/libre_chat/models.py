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
        message). Messages link back via `session_id`.
    """

    __tablename__ = "sessions"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)
    title: Optional[str] = Field(default=None, max_length=120)
    model: str
    system_prompt: str = ""

    messages: list["Message"] = Relationship(
        back_populates="session",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class Message(SQLModel, table=True):
    """
    A single turn within a ChatSession.

    Description:
        One row per user input or assistant reply. For assistant
        rows we also record token and duration stats extracted from
        the final Ollama chunk so token/sec can be reconstructed
        across sessions.
    """

    __tablename__ = "messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="sessions.id", index=True)
    role: str  # "user" | "assistant" | "system"
    content: str
    created_at: datetime = Field(default_factory=_now)

    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    eval_duration_ns: Optional[int] = None

    session: Optional[ChatSession] = Relationship(back_populates="messages")
