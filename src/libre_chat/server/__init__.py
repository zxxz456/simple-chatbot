"""
libre_chat.server
==================


Description:
-----------
Paquete del FastAPI server. Re-exporta ``app`` (la instancia
FastAPI usada por uvicorn) y ``run`` (entry point del console
script ``libre-chat-server``) para mantener compatibilidad con
imports históricos (``libre_chat.server:app`` /
``libre_chat.server:run``).

Estructura interna:
- app.py        → FastAPI + lifespan + ``run()``
- engine.py     → singleton del engine SQLite y migraciones
- schemas.py    → modelos Pydantic (contrato HTTP)
- helpers.py    → mappers y utilidades compartidas
- routers/      → un router por recurso (health, sessions,
                  messages, characters)


Metadata:
----------
* Author: zxxz6 (Bryan Violante Arriaga)
* Version: 0.0.1-alpha
* License: MIT


History:
------------
Author      Date            Description
zxxz6       13/05/2026      Split del antiguo server.py monolítico

"""

from libre_chat.server.app import app, run

__all__ = ["app", "run"]
