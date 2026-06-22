"""
Desktop Control mode: Gemini understands the command, Python executes it for real on Windows.
"""

import os
import re
import time
import ctypes
import subprocess
import requests
from typing import Any, Dict
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
MODEL_NAME = "gemini-flash-lite-latest"

_MIN_INTERVAL = 1.2
_last_api_call: float = 0.0

# ─── App name → executable mapping ──────────────────────────────────────────
APP_MAP = {
    "chrome": "chrome.exe",
    "google chrome": "chrome.exe",
    "firefox": "firefox.exe",
    "mozilla firefox": "firefox.exe",
    "edge": "msedge.exe",
    "microsoft edge": "msedge.exe",
    "notepad": "notepad.exe",
    "calculator": "calc.exe",
    "calculatrice": "calc.exe",
    "vs code": "code.exe",
    "visual studio code": "code.exe",
    "vscode": "code.exe",
    "file explorer": "explorer.exe",
    "explorateur de fichiers": "explorer.exe",
    "explorer": "explorer.exe",
    "word": "winword.exe",
    "excel": "excel.exe",
    "powerpoint": "powerpnt.exe",
    "task manager": "taskmgr.exe",
    "gestionnaire des taches": "taskmgr.exe",
    "paint": "mspaint.exe",
    "cmd": "cmd.exe",
    "powershell": "powershell.exe",
    "spotify": "spotify.exe",
    "discord": "discord.exe",
    "vlc": "vlc.exe",
    "zoom": "zoom.exe",
    "teams": "teams.exe",
    "outlook": "outlook.exe",
    "settings": "ms-settings:",
    "parametres": "ms-settings:",
}

DESKTOP_SYSTEM_PROMPT = """You are a desktop control AI assistant.
Extract the user's intent and parameters from any desktop command.

SUPPORTED ACTIONS:
- open_app: open an application. params: { "app": "app name" }
- close_app: kill/close an application. params: { "app": "app name" }
- volume_mute: toggle mute. params: {}
- volume_up: increase volume. params: { "step": 5 }
- volume_down: decrease volume. params: { "step": 5 }
- set_brightness: set screen brightness. params: { "value": 80 }
- minimize_all: minimize all windows. params: {}
- restore_all: restore all minimized windows. params: {}
- lock_screen: lock the screen. params: {}
- sleep: put PC to sleep. params: {}
- open_desktop: show desktop. params: {}
- create_folder: create folder on desktop. params: { "name": "folder name" }
- create_file: create text file on desktop. params: { "name": "filename.txt", "content": "" }
- unknown: not understood. params: {}

LANGUAGE: detect from input (French, English, or Arabic including Arabizi), reply in same language.

You MUST respond ONLY with valid JSON, no markdown fences:
{
  "action": "one of the actions above",
  "params": {},
  "reply_fr": "Confirmation courte en français",
  "reply_en": "Short confirmation in English",
  "reply_ar": "تأكيد قصير بالعربية",
  "emoji": "relevant emoji"
}
"""


def _call_gemini_extract(user_text: str) -> Dict[str, Any]:
    """Call Gemini to extract structured action + params from free-form text."""
    global _last_api_call

    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY missing")

    elapsed = time.time() - _last_api_call
    if elapsed < _MIN_INTERVAL:
        time.sleep(_MIN_INTERVAL - elapsed)

    payload = {
        "system_instruction": {
            "parts": [{"text": DESKTOP_SYSTEM_PROMPT}]
        },
        "contents": [
            {"role": "user", "parts": [{"text": user_text}]}
        ],
        "generationConfig": {
            "temperature": 0.3,
            "topP": 0.95,
            "maxOutputTokens": 200,
        },
    }

    url = f"{API_BASE_URL}/{MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"
    _last_api_call = time.time()
    resp = requests.post(url, json=payload, timeout=25)
    if resp.status_code == 429:
        time.sleep(2.5)
        resp = requests.post(url, json=payload, timeout=25)
    resp.raise_for_status()

    data = resp.json()
    raw = data["candidates"][0]["content"]["parts"][0].get("text", "").strip()

    # Strip markdown fences if present
    raw = re.sub(r"^```json\s*|^```\s*|\s*```$", "", raw.strip(), flags=re.MULTILINE).strip()

    import json
    return json.loads(raw)


# ─── Real Windows executors ──────────────────────────────────────────────────

def _open_app(app_name: str) -> str:
    key = app_name.lower().strip()
    exe = APP_MAP.get(key)
    # Fuzzy match
    if not exe:
        for k, v in APP_MAP.items():
            if k in key or key in k:
                exe = v
                break
    if not exe:
        exe = app_name  # Try directly

    try:
        if exe.startswith("ms-"):
            os.startfile(exe)
        else:
            subprocess.Popen(exe, shell=True)
        return f"✅ {app_name} launched."
    except Exception as e:
        return f"⚠️ Could not open {app_name}: {e}"


def _close_app(app_name: str) -> str:
    key = app_name.lower().strip()
    exe = APP_MAP.get(key)
    if not exe:
        for k, v in APP_MAP.items():
            if k in key or key in k:
                exe = v
                break
    if not exe:
        exe = app_name if app_name.endswith(".exe") else app_name + ".exe"

    try:
        subprocess.run(["taskkill", "/F", "/IM", exe], capture_output=True)
        return f"✅ {app_name} closed."
    except Exception as e:
        return f"⚠️ Could not close {app_name}: {e}"


def _volume_mute() -> str:
    subprocess.run(
        ["powershell", "-Command",
         "(new-object -com WScript.Shell).SendKeys([char]173)"],
        capture_output=True
    )
    return "🔇 Volume muted/unmuted."


def _volume_up(step: int = 5) -> str:
    for _ in range(step):
        subprocess.run(
            ["powershell", "-Command",
             "(new-object -com WScript.Shell).SendKeys([char]175)"],
            capture_output=True
        )
    return f"🔊 Volume increased."


def _volume_down(step: int = 5) -> str:
    for _ in range(step):
        subprocess.run(
            ["powershell", "-Command",
             "(new-object -com WScript.Shell).SendKeys([char]174)"],
            capture_output=True
        )
    return f"🔉 Volume decreased."


def _set_brightness(value: int) -> str:
    value = max(0, min(100, int(value)))
    try:
        subprocess.run(
            ["powershell", "-Command",
             f"(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,{value})"],
            capture_output=True, timeout=10
        )
        return f"☀️ Brightness set to {value}%."
    except Exception as e:
        return f"⚠️ Brightness control failed: {e}"


def _minimize_all() -> str:
    subprocess.run(
        ["powershell", "-Command", "(new-object -com Shell.Application).MinimizeAll()"],
        capture_output=True
    )
    return "🪟 All windows minimized."


def _restore_all() -> str:
    subprocess.run(
        ["powershell", "-Command", "(new-object -com Shell.Application).UndoMinimizeALL()"],
        capture_output=True
    )
    return "🪟 All windows restored."


def _lock_screen() -> str:
    ctypes.windll.user32.LockWorkStation()
    return "🔒 Screen locked."


def _sleep() -> str:
    subprocess.Popen(
        ["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"]
    )
    return "💤 Going to sleep..."


def _open_desktop() -> str:
    subprocess.run(
        ["powershell", "-Command", "(new-object -com Shell.Application).ToggleDesktop()"],
        capture_output=True
    )
    return "📂 Desktop shown."


def _create_folder(name: str) -> str:
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    # Sanitize name
    name = re.sub(r'[<>:"/\\|?*]', '_', name).strip() or "New Folder"
    path = os.path.join(desktop, name)
    os.makedirs(path, exist_ok=True)
    return f"📁 Folder '{name}' created on the Desktop."


def _create_file(name: str, content: str = "") -> str:
    desktop = os.path.join(os.path.expanduser("~"), "Desktop")
    name = re.sub(r'[<>:"/\\|?*]', '_', name).strip() or "new_file.txt"
    path = os.path.join(desktop, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return f"📝 File '{name}' created on the Desktop."


# ─── Action dispatcher ───────────────────────────────────────────────────────

_DISPATCHER = {
    "open_app":       lambda p: _open_app(p.get("app", "")),
    "close_app":      lambda p: _close_app(p.get("app", "")),
    "volume_mute":    lambda p: _volume_mute(),
    "volume_up":      lambda p: _volume_up(int(p.get("step", 5))),
    "volume_down":    lambda p: _volume_down(int(p.get("step", 5))),
    "set_brightness": lambda p: _set_brightness(p.get("value", 80)),
    "minimize_all":   lambda p: _minimize_all(),
    "restore_all":    lambda p: _restore_all(),
    "lock_screen":    lambda p: _lock_screen(),
    "sleep":          lambda p: _sleep(),
    "open_desktop":   lambda p: _open_desktop(),
    "create_folder":  lambda p: _create_folder(p.get("name", "New Folder")),
    "create_file":    lambda p: _create_file(p.get("name", "file.txt"), p.get("content", "")),
}


def execute_desktop_command(text: str) -> Dict[str, Any]:
    """
    1. Gemini extracts intent + params from free-form text.
    2. Python executor actually runs the Windows command.
    """
    user_text = (text or "").strip()
    if not user_text:
        return {"success": False, "message": "Please tell me what to do.", "understood": False}

    try:
        gemini = _call_gemini_extract(user_text)
    except Exception as e:
        return {
            "success": False,
            "message": f"⚠️ Gemini unavailable: {e}",
            "understood": False,
        }

    action = gemini.get("action", "unknown")
    params = gemini.get("params", {})
    emoji  = gemini.get("emoji", "🖥️")

    # Detect language from input text
    has_arabic_script = bool(re.search(r'[\u0600-\u06FF]', text))
    raw_text = text.lower()
    arabizi = ["salam", "wach", "bghit", "ndir", "kifach", "habibi", "walla", "labas"]
    fr_hints = ["ouvre", "ferme", "crée", "monte", "baisse", "coupe", "verrouille", "créer", "affiche"]

    if has_arabic_script or any(h in raw_text for h in arabizi):
        lang = "ar"
    elif any(h in raw_text for h in fr_hints):
        lang = "fr"
    else:
        lang = "en"

    reply_key = "reply_ar" if lang == "ar" else "reply_fr" if lang == "fr" else "reply_en"
    gemini_reply = gemini.get(reply_key) or gemini.get("reply_en", "")

    if action == "unknown" or action not in _DISPATCHER:
        return {
            "success": False,
            "understood": False,
            "message": f"❓ {gemini_reply or 'Command not recognized.'}",
        }

    # Execute for real
    try:
        exec_result = _DISPATCHER[action](params)
        return {
            "success": True,
            "understood": True,
            "action": action,
            "message": f"{emoji} {gemini_reply}\n{exec_result}",
        }
    except Exception as e:
        return {
            "success": False,
            "understood": True,
            "action": action,
            "message": f"⚠️ Execution failed: {e}",
        }

