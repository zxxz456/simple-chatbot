"""
health.py
===========


Description:
-----------
Endpoint ``/health`` para que el cliente móvil verifique
conectividad con el server (la app lo pingea al arrancar y al
cambiar de red).


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

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Ping simple — el móvil lo usa para detectar 'sin conexión'."""
    return {"status": "ok"}
