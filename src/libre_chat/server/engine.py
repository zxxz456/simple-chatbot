"""
engine.py
===========


Description:
-----------
Manejo del engine SQLite del server: singleton a nivel de módulo
inicializado en el ``lifespan`` de FastAPI, más las migraciones
SQL crudas que el CLI Python no declara (tablas ``characters`` /
``session_characters`` y columnas extra de ``sessions`` /
``messages``).


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

from typing import Optional

from sqlalchemy import Engine, text

from libre_chat.config import DEFAULT_DB_PATH
from libre_chat.db import make_engine


# El engine vive en module scope para que los routers FastAPI lo
# encuentren via ``get_engine()``. Se inicializa una sola vez en el
# ``lifespan`` (``init_engine``) para que la DB y el esquema existan
# antes del primer request.
_engine: Optional[Engine] = None


def get_engine() -> Engine:
    """Devuelve el engine inicializado o falla si aún no existe."""
    if _engine is None:
        raise RuntimeError("Engine no inicializado todavía.")
    return _engine


def init_engine() -> Engine:
    """Crea (idempotente) el engine SQLite y aplica migraciones."""
    global _engine
    if _engine is None:
        _engine = make_engine(DEFAULT_DB_PATH)
        ensure_characters_schema(_engine)
    return _engine


def ensure_characters_schema(engine: Engine) -> None:
    """
    Crea las tablas ``characters`` y ``session_characters`` si no
    existen, y agrega columnas que el CLI no declara.

    Description:
        SQLModel.metadata.create_all (en make_engine) sólo crea
        las tablas declaradas como SQLModel. Personajes los
        introdujo la app móvil, no el CLI Python; las definimos
        aquí en SQL crudo para no acoplar el CLI a esta feature.
    """
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS characters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                avatar TEXT NOT NULL,
                color TEXT NOT NULL,
                system_prompt TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS session_characters (
                session_id INTEGER NOT NULL,
                character_id INTEGER NOT NULL,
                PRIMARY KEY (session_id, character_id)
            );
        """))
        # SQLite no soporta ``ALTER TABLE ADD COLUMN IF NOT EXISTS``,
        # emulamos con PRAGMA + skip.
        cols_sessions = {
            r[1] for r in conn.exec_driver_sql("PRAGMA table_info(sessions)").fetchall()
        }
        if "scene" not in cols_sessions:
            conn.exec_driver_sql(
                "ALTER TABLE sessions ADD COLUMN scene TEXT NOT NULL DEFAULT ''"
            )
        if "summary" not in cols_sessions:
            conn.exec_driver_sql(
                "ALTER TABLE sessions ADD COLUMN summary TEXT NOT NULL DEFAULT ''"
            )
        if "summary_upto_message_id" not in cols_sessions:
            conn.exec_driver_sql(
                "ALTER TABLE sessions ADD COLUMN summary_upto_message_id INTEGER"
            )
        cols_messages = {
            r[1] for r in conn.exec_driver_sql("PRAGMA table_info(messages)").fetchall()
        }
        if "character_id" not in cols_messages:
            conn.exec_driver_sql("ALTER TABLE messages ADD COLUMN character_id INTEGER")
