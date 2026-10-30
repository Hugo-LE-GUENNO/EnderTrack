import json
import urllib.request

NAME        = "Enderman"
VERSION     = "1.0.0"
DESCRIPTION = "Natural language control via Ollama"

OLLAMA_URL = "http://localhost:11434/api/chat"

SYSTEM_PROMPT = """You are Enderman, an assistant controlling a motorized XYZ microscope stage with camera and light.

Available actions — respond with ONLY valid JSON (no markdown) when the user asks you to do something:
{"action": "move_absolute",  "params": {"x": float, "y": float, "z": float}}
{"action": "move_relative",  "params": {"dx": float, "dy": float, "dz": float}}
{"action": "home",           "params": {}}
{"action": "capture",        "params": {"path": string}}
{"action": "light_on",       "params": {"r": int, "g": int, "b": int, "intensity": float}}
{"action": "light_off",      "params": {}}
{"action": "get_position",   "params": {}}

If the user asks a question or you cannot map to an action, respond with plain text.
Units are millimeters. Default feedrate is 3000 mm/min.
"""

SECTIONS = {
    "navigation": {
        "inputs": [
            {"type": "select", "id": "model",  "label": "Model", "options": ["mistral", "llama3.2", "llama3.1", "qwen2.5"], "default": "mistral"},
            {"type": "input",  "id": "prompt", "label": "Command", "default": ""},
            {"type": "button", "label": "Send", "action": "run", "style": "primary"},
        ],
        "outputs": [
            {"type": "text", "id": "response", "label": "Response"},
            {"type": "text", "id": "status",   "label": "Status"},
        ]
    }
}


def _ask_ollama(model, prompt):
    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ],
        "stream": False
    }).encode()

    req = urllib.request.Request(OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())["message"]["content"].strip()


def _execute(ctx, action, params):
    stage = ctx.stage
    cam   = ctx.cam
    light = ctx.light

    if action == "move_absolute":
        pos = stage.position
        x = params.get("x", pos["X"])
        y = params.get("y", pos["Y"])
        z = params.get("z", pos["Z"])
        stage.move_absolute(x, y, z)
        stage.finish_moves()
        return f"Moved to X={x} Y={y} Z={z}"

    if action == "move_relative":
        stage.move_relative(dx=params.get("dx", 0), dy=params.get("dy", 0), dz=params.get("dz", 0))
        stage.finish_moves()
        return f"Moved by dx={params.get('dx',0)} dy={params.get('dy',0)} dz={params.get('dz',0)}"

    if action == "home":
        stage.home()
        return "Homed"

    if action == "get_position":
        pos = stage.position
        return f"X={pos['X']} Y={pos['Y']} Z={pos['Z']}"

    if action == "capture":
        path = params.get("path", "./captures/enderman.tiff")
        result = cam.capture(path)
        return f"Captured: {result.get('path', path)}"

    if action == "light_on":
        light.on(r=params.get("r", 255), g=params.get("g", 255), b=params.get("b", 255), intensity=params.get("intensity", 1.0))
        return "Light on"

    if action == "light_off":
        light.off()
        return "Light off"

    return f"Unknown action: {action}"


def run(ctx, params):
    model  = params.get("model", "mistral")
    prompt = params.get("prompt", "").strip()

    if not prompt:
        return {"success": False}

    ctx.update_output("status",   "Thinking...")
    ctx.update_output("response", "")

    try:
        reply = _ask_ollama(model, prompt)
    except Exception as e:
        ctx.update_output("status", f"Ollama error: {e}")
        return {"success": False}

    try:
        data   = json.loads(reply)
        action = data.get("action", "")
        result = _execute(ctx, action, data.get("params", {}))
        ctx.update_output("response", result)
        ctx.update_output("status",   f"Action: {action}")
        ctx.log(f"Enderman: {action} -> {result}", level="ok")
    except (json.JSONDecodeError, ValueError):
        ctx.update_output("response", reply)
        ctx.update_output("status",   "")

    return {"success": True}
