"""
db.py
===========


Description:
-----------
SQLite engine factory for libre_chat. Creates (or opens) the
history database, ensures the parent directory exists, and
registers the ORM metadata so CREATE TABLE IF NOT EXISTS runs
on first use.

Handles:
- make_engine(db_path): disk-backed SQLAlchemy engine (persistent)
- make_memory_engine(): in-memory SQLAlchemy engine (incognito)


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

from pathlib import Path

from sqlalchemy import Engine, text
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine

# Side-effect import: registers ChatSession / Message on SQLModel.metadata.
from libre_chat import models  # noqa: F401


_UNIQUE_TITLE_INDEX = (
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_sessions_title_unique "
    "ON sessions(title) WHERE title IS NOT NULL"
)


def make_engine(db_path: Path) -> Engine:
    """
    Build an engine and create tables if missing.

    Description:
        Ensures the directory exists, opens a SQLite file at
        `db_path`, and runs `SQLModel.metadata.create_all` so the
        schema is ready on first launch.

    Args:
        db_path: Filesystem path to the SQLite file.

    Return:
        Ready-to-use SQLAlchemy Engine bound to that file.
    """
    db_path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///{db_path}", echo=False)
    SQLModel.metadata.create_all(engine)

    # Partial unique index on sessions.title so that NULL titles are
    # allowed (drafts without a first message yet) but concrete titles
    # must be distinct. Idempotent — safe to run on existing DBs.
    with engine.begin() as conn:
        conn.execute(text(_UNIQUE_TITLE_INDEX))
    return engine


def make_memory_engine() -> Engine:
    """
    Build an in-memory SQLite engine (incognito mode).

    Description:
        Uses ``sqlite:///:memory:`` with a StaticPool so every
        request reuses the same underlying connection (otherwise
        each connection would see a fresh, empty DB). Tables and
        the partial unique index are created up front so the
        chatbot can use the engine exactly like a disk-backed one.
        Nothing is written to disk; all rows vanish when the
        process exits.

    Args:
        None.

    Return:
        A Ready-to-use in-memory SQLAlchemy Engine.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text(_UNIQUE_TITLE_INDEX))
    return engine
