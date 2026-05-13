"""
app.py
===========


Description:
-----------
Construye la instancia FastAPI: lifespan que arranca el engine
SQLite + migraciones, middleware CORS y el include de cada router
por recurso. ``run()`` lanza uvicorn en el puerto LAN.


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

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from libre_chat.server.engine import init_engine
from libre_chat.server.routers import characters, health, messages, sessions


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Init/cierre del engine SQLite y de las tablas de personajes."""
    init_engine()
    yield


app = FastAPI(
    title="libre-chat-server",
    version="0.0.1-alpha",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(sessions.router)
app.include_router(messages.router)
app.include_router(characters.router)


def run() -> None:
    """
    Lanza el servidor en ``0.0.0.0:8765`` con auto-reload off.

    Description:
        Bind a todas las interfaces para que el teléfono lo alcance
        por la IP LAN. El puerto es 8765 (libre frente a otros
        uvicorn locales en 8000). Para producción usar
        ``uvicorn libre_chat.server:app`` con gunicorn/workers.
    """
    uvicorn.run(
        "libre_chat.server:app",
        host="0.0.0.0",
        port=8765,
        log_level="info",
    )


if __name__ == "__main__":
    run()
