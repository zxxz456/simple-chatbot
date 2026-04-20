"""
__main__.py
===========


Description:
-----------
Allows the package to be run as a module via
`python -m libre_chat`. Delegates to `cli.main`.


Metadata:
----------
* Author: zxxz6 (Bryan Violante Arriaga)
* Version: 0.0.1-alpha
* License: MIT


History:
------------
Author      Date            Description
zxxz6       19/04/2026      Package renamed simple_chatbot → libre_chat
zxxz6       17/04/2026      Creation

"""

from libre_chat.cli import main

if __name__ == "__main__":
    main()
