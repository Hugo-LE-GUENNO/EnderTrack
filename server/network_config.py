"""
network_config.py — Configuration réseau du serveur EnderTrack.
Host, port, CORS, et préparation pour l'accès distant futur.
"""

import os
import socket

# ─── Defaults ────────────────────────────────────────────────────────────────

DEFAULT_HOST = '127.0.0.1'
DEFAULT_PORT = 5000

# ─── Config (overridable via env vars) ───────────────────────────────────────

# Priority: CLI args > env vars > defaults
import sys as _sys

def _parse_args():
    host = os.environ.get('ENDERTRACK_HOST', DEFAULT_HOST)
    port = int(os.environ.get('ENDERTRACK_PORT', DEFAULT_PORT))
    args = _sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] in ('--host', '-h') and i + 1 < len(args):
            host = args[i + 1]; i += 2
        elif args[i] in ('--port', '-p') and i + 1 < len(args):
            port = int(args[i + 1]); i += 2
        elif args[i] == '--lan':
            host = '0.0.0.0'; i += 1
        else:
            i += 1
    return host, port

HOST, PORT = _parse_args()


def get_local_ip():
    """Retourne l'IP locale de la machine (pour affichage info)."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


def print_startup_info():
    """Affiche les infos de démarrage du serveur."""
    local_ip = get_local_ip()
    print(f"  🌐 Écoute sur http://{HOST}:{PORT}")
    if HOST == '0.0.0.0':
        print(f"  🌐 Accès LAN: http://{local_ip}:{PORT}")
    elif HOST == '127.0.0.1':
        print(f"  🌐 Accès local uniquement")
        print(f"  💡 Réseau local ? → python3 endertrack-server.py --lan")
