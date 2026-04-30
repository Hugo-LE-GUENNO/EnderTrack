"""
basic_functions.py — Fonctions OS/filesystem accessibles via API REST.
Tout ce que Python sait faire et pas JavaScript en mode file://.
Base commune pour tous les plugins.
"""

import os
import platform
import subprocess

# ─── Résolution de projet ────────────────────────────────────────────────────

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def get_project_root():
    return PROJECT_ROOT


def resolve_path(path):
    """Résout un chemin relatif par rapport au projet, ou absolu."""
    if os.path.isabs(path):
        return os.path.abspath(path)
    return os.path.abspath(os.path.join(PROJECT_ROOT, path))


# ─── Browse directories (Jupyter-style) ─────────────────────────────────────

def browse_directory(path=None):
    """Liste les sous-dossiers d'un chemin. Retourne chemin absolu + parent + liste."""
    path = path or os.path.expanduser('~')
    path = os.path.abspath(path)

    if not os.path.isdir(path):
        path = os.path.dirname(path)
    if not os.path.isdir(path):
        path = os.path.expanduser('~')

    try:
        entries = sorted([
            name for name in os.listdir(path)
            if os.path.isdir(os.path.join(path, name)) and not name.startswith('.')
        ])
    except (PermissionError, FileNotFoundError, OSError) as e:
        return {'success': False, 'error': str(e)}

    parent = os.path.dirname(path)
    return {
        'success': True,
        'path': path,
        'parent': parent if parent != path else None,
        'dirs': entries
    }


# ─── List files ──────────────────────────────────────────────────────────────

def list_files(path=None, extensions=None):
    """Liste les fichiers d'un dossier, optionnellement filtrés par extension."""
    path = resolve_path(path or '.')
    if not os.path.isdir(path):
        return {'success': False, 'error': f'Dossier introuvable: {path}'}

    try:
        files = []
        for name in sorted(os.listdir(path)):
            full = os.path.join(path, name)
            if not os.path.isfile(full) or name.startswith('.'):
                continue
            if extensions:
                ext = os.path.splitext(name)[1].lower()
                if ext not in extensions:
                    continue
            stat = os.stat(full)
            files.append({
                'name': name,
                'path': full,
                'size': stat.st_size,
                'modified': stat.st_mtime
            })
        return {'success': True, 'path': path, 'files': files}
    except PermissionError:
        return {'success': False, 'error': f'Permission refusée: {path}'}


# ─── Ensure directory exists ─────────────────────────────────────────────────

def ensure_directory(path):
    """Crée un dossier s'il n'existe pas. Retourne le chemin absolu."""
    path = resolve_path(path)
    os.makedirs(path, exist_ok=True)
    return {'success': True, 'path': path}


# ─── System info ─────────────────────────────────────────────────────────────

def get_system_info():
    """Informations système utiles pour le debug."""
    return {
        'success': True,
        'platform': platform.system(),
        'hostname': platform.node(),
        'python': platform.python_version(),
        'project_root': PROJECT_ROOT,
        'home': os.path.expanduser('~'),
        'cwd': os.getcwd()
    }


# ─── Open in file manager (optionnel, desktop) ──────────────────────────────

def open_in_file_manager(path):
    """Ouvre un dossier dans le gestionnaire de fichiers natif."""
    path = resolve_path(path)
    if not os.path.exists(path):
        return {'success': False, 'error': f'Chemin introuvable: {path}'}
    try:
        system = platform.system()
        if system == 'Linux':
            subprocess.Popen(['xdg-open', path])
        elif system == 'Darwin':
            subprocess.Popen(['open', path])
        elif system == 'Windows':
            subprocess.Popen(['explorer', path])
        return {'success': True, 'path': path}
    except Exception as e:
        return {'success': False, 'error': str(e)}


# ─── Native OS dialogs (tkinter) ─────────────────────────────────────────────

def open_directory_dialog(title='Choisir un dossier', initial_dir=None):
    """Ouvre le dialog natif de l'OS pour choisir un dossier.
    Priorité: zenity (GNOME) > kdialog (KDE) > osascript (macOS) > tkinter (universel).
    """
    initial_dir = initial_dir or os.path.expanduser('~')
    if not os.path.isdir(initial_dir):
        initial_dir = os.path.expanduser('~')
    system = platform.system()

    # macOS — AppleScript (dialog Finder natif)
    if system == 'Darwin':
        try:
            script = f'tell application "Finder" to activate\nset f to POSIX path of (choose folder with prompt "{title}" default location POSIX file "{initial_dir}")\nreturn f'
            result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True, timeout=300)
            if result.returncode == 0 and result.stdout.strip():
                return {'success': True, 'path': result.stdout.strip().rstrip('/')}
            return {'success': False, 'error': 'Annulé'}
        except Exception:
            pass

    # Linux — zenity (GNOME/GTK)
    if system == 'Linux':
        try:
            result = subprocess.run(
                ['zenity', '--file-selection', '--directory', f'--title={title}', f'--filename={initial_dir}/'],
                capture_output=True, text=True, timeout=300
            )
            if result.returncode == 0 and result.stdout.strip():
                return {'success': True, 'path': result.stdout.strip()}
            if result.returncode == 1:
                return {'success': False, 'error': 'Annulé'}
        except FileNotFoundError:
            pass

    # Linux — kdialog (KDE)
    if system == 'Linux':
        try:
            result = subprocess.run(
                ['kdialog', '--getexistingdirectory', initial_dir, '--title', title],
                capture_output=True, text=True, timeout=300
            )
            if result.returncode == 0 and result.stdout.strip():
                return {'success': True, 'path': result.stdout.strip()}
            if result.returncode == 1:
                return {'success': False, 'error': 'Annulé'}
        except FileNotFoundError:
            pass

    # Universel — tkinter (Windows utilise le dialog natif, Linux/macOS en fallback)
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        path = filedialog.askdirectory(title=title, initialdir=initial_dir)
        root.destroy()
        if path:
            return {'success': True, 'path': os.path.abspath(path)}
        return {'success': False, 'error': 'Annulé'}
    except Exception as e:
        return {'success': False, 'error': f'Aucun dialog disponible: {e}'}


def open_file_dialog(title='Choisir un fichier', initial_dir=None, filetypes=None):
    """Ouvre le dialog natif de l'OS pour choisir un fichier.
    Priorité: zenity > kdialog > osascript > tkinter.
    """
    initial_dir = initial_dir or os.path.expanduser('~')
    if not os.path.isdir(initial_dir):
        initial_dir = os.path.expanduser('~')
    system = platform.system()

    # macOS
    if system == 'Darwin':
        try:
            script = f'set f to POSIX path of (choose file with prompt "{title}" default location POSIX file "{initial_dir}")\nreturn f'
            result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True, timeout=300)
            if result.returncode == 0 and result.stdout.strip():
                return {'success': True, 'path': result.stdout.strip()}
            return {'success': False, 'error': 'Annulé'}
        except Exception:
            pass

    # Linux — zenity
    if system == 'Linux':
        try:
            cmd = ['zenity', '--file-selection', f'--title={title}', f'--filename={initial_dir}/']
            if filetypes:
                for desc, pattern in filetypes:
                    cmd.extend(['--file-filter', f'{desc} | {pattern}'])
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if result.returncode == 0 and result.stdout.strip():
                return {'success': True, 'path': result.stdout.strip()}
            if result.returncode == 1:
                return {'success': False, 'error': 'Annulé'}
        except FileNotFoundError:
            pass

    # Linux — kdialog
    if system == 'Linux':
        try:
            result = subprocess.run(
                ['kdialog', '--getopenfilename', initial_dir, '--title', title],
                capture_output=True, text=True, timeout=300
            )
            if result.returncode == 0 and result.stdout.strip():
                return {'success': True, 'path': result.stdout.strip()}
            if result.returncode == 1:
                return {'success': False, 'error': 'Annulé'}
        except FileNotFoundError:
            pass

    # Universel — tkinter
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        ft = []
        if filetypes:
            for item in filetypes:
                ft.append((item[0], item[1]))
        ft.append(('Tous les fichiers', '*.*'))
        path = filedialog.askopenfilename(title=title, initialdir=initial_dir, filetypes=ft)
        root.destroy()
        if path:
            return {'success': True, 'path': os.path.abspath(path)}
        return {'success': False, 'error': 'Annulé'}
    except Exception as e:
        return {'success': False, 'error': f'Aucun dialog disponible: {e}'}


# ─── Flask routes registration ───────────────────────────────────────────────

def register_routes(app):
    """Enregistre les routes /api/fs/* sur l'app Flask."""
    from flask import request, jsonify

    @app.route('/api/browse', methods=['GET'])
    def _browse():
        path = request.args.get('path', os.path.expanduser('~'))
        return jsonify(browse_directory(path))

    @app.route('/api/fs/list', methods=['GET'])
    def _list_files():
        path = request.args.get('path', '.')
        exts = request.args.get('extensions')
        ext_list = exts.split(',') if exts else None
        return jsonify(list_files(path, ext_list))

    @app.route('/api/fs/resolve', methods=['GET'])
    def _resolve():
        path = request.args.get('path', '.')
        return jsonify({'success': True, 'path': resolve_path(path)})

    @app.route('/api/fs/mkdir', methods=['POST'])
    def _mkdir():
        data = request.get_json() or {}
        path = data.get('path', '')
        if not path:
            return jsonify({'success': False, 'error': 'path required'})
        return jsonify(ensure_directory(path))

    @app.route('/api/fs/open', methods=['POST'])
    def _open_fm():
        data = request.get_json() or {}
        path = data.get('path', '')
        return jsonify(open_in_file_manager(path))

    @app.route('/api/fs/dialog/directory', methods=['POST'])
    def _dialog_dir():
        data = request.get_json() or {}
        title = data.get('title', 'Choisir un dossier')
        initial = data.get('initialDir')
        return jsonify(open_directory_dialog(title, initial))

    @app.route('/api/fs/dialog/file', methods=['POST'])
    def _dialog_file():
        data = request.get_json() or {}
        title = data.get('title', 'Choisir un fichier')
        initial = data.get('initialDir')
        filetypes = data.get('filetypes')
        return jsonify(open_file_dialog(title, initial, filetypes))

    @app.route('/api/system', methods=['GET'])
    def _system_info():
        return jsonify(get_system_info())

    print("  📁 basic_functions: routes /api/browse, /api/fs/*, /api/system")
