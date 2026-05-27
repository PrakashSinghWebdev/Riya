"""Automation engine — RIYA's hands on the system.

Safety model (chosen by the user): routine actions (open, type, click, move,
switch) run instantly; only DESTRUCTIVE / irreversible actions (deleting files,
killing apps that may hold unsaved work) require explicit confirmation.

`propose()` maps a natural request to a structured action without executing.
`execute()` performs it — refusing destructive actions unless `confirm=True`.
Cursor + keyboard control use pyautogui (FAILSAFE on: slam the mouse to a screen
corner to abort anything).
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import webbrowser

from .brain import brain

try:
    import pyautogui

    pyautogui.FAILSAFE = True
    pyautogui.PAUSE = 0.02
    _GUI = True
except Exception:  # pragma: no cover - headless / not installed
    pyautogui = None  # type: ignore[assignment]
    _GUI = False

# Action -> needs the target argument? (documentation + light validation)
ACTIONS = {
    "open_app",     # target = friendly app name (allowlisted)
    "open_url",     # target = website
    "open_path",    # target = file/folder path
    "type_text",    # target = text to type at the cursor
    "press_key",    # target = key or combo, e.g. "enter", "ctrl+s"
    "move_cursor",  # target = "x,y"
    "click",        # target = "x,y" (optional; clicks current pos if blank)
    "scroll",       # target = amount (e.g. "-300")
    "switch_window",# target = ignored (alt+tab)
    "close_app",    # target = process image name (DESTRUCTIVE)
    "delete_path",  # target = file/folder path (DESTRUCTIVE)
}

# These can lose data / are irreversible -> require confirmation.
DESTRUCTIVE = {"close_app", "delete_path"}

APPS: dict[str, str] = {
    "notepad": "notepad.exe",
    "calculator": "calc.exe",
    "calc": "calc.exe",
    "paint": "mspaint.exe",
    "explorer": "explorer.exe",
    "file explorer": "explorer.exe",
    "files": "explorer.exe",
    "settings": "explorer.exe",
    "task manager": "taskmgr.exe",
    "snipping tool": "snippingtool.exe",
    "wordpad": "write.exe",
    "cmd": "cmd.exe",
}


def is_destructive(action: str) -> bool:
    return action in DESTRUCTIVE


# ── individual actions ────────────────────────────────────────────
def _ok(msg: str) -> dict:
    return {"ok": True, "did": msg}


def _err(msg: str) -> dict:
    return {"ok": False, "error": msg}


def _open_url(t: str) -> dict:
    if not t:
        return _err("No URL given.")
    if not t.startswith(("http://", "https://")):
        t = "https://" + t
    webbrowser.open(t)
    return _ok(f"Opened {t}")


def _open_path(t: str) -> dict:
    if not t or not os.path.exists(t):
        return _err("Path not found.")
    if sys.platform == "win32":
        os.startfile(t)  # noqa: S606
    elif sys.platform == "darwin":
        subprocess.Popen(["open", t])
    else:
        subprocess.Popen(["xdg-open", t])
    return _ok(f"Opened {t}")


def _open_app(t: str) -> dict:
    exe = APPS.get((t or "").strip().lower())
    if not exe:
        return _err(f"'{t}' isn't allowed. Apps: {', '.join(sorted(APPS))}.")
    subprocess.Popen([exe])
    return _ok(f"Launched {t}")


def _xy(t: str):
    try:
        x, y = (int(v) for v in t.replace(" ", "").split(","))
        return x, y
    except Exception:
        return None


def execute(action: str, target: str = "", confirm: bool = False) -> dict:
    """Run a single action. Destructive actions need confirm=True."""
    action = (action or "").strip()
    target = target or ""
    if action not in ACTIONS:
        return _err(f"Action '{action}' is not allowed.")
    if is_destructive(action) and not confirm:
        return {
            "ok": False,
            "needs_confirmation": True,
            "action": action,
            "target": target,
            "label": f"Confirm: {action} {target}",
        }
    if not _GUI and action not in {"open_app", "open_url", "open_path"}:
        return _err("Input control unavailable (no GUI session).")

    try:
        if action == "open_url":
            return _open_url(target)
        if action == "open_path":
            return _open_path(target)
        if action == "open_app":
            return _open_app(target)
        if action == "type_text":
            pyautogui.write(target, interval=0.01)
            return _ok(f"Typed {len(target)} chars")
        if action == "press_key":
            keys = [k.strip() for k in target.replace("+", " ").split() if k.strip()]
            if len(keys) > 1:
                pyautogui.hotkey(*keys)
            elif keys:
                pyautogui.press(keys[0])
            return _ok(f"Pressed {target}")
        if action == "move_cursor":
            xy = _xy(target)
            if not xy:
                return _err("move_cursor needs 'x,y'.")
            pyautogui.moveTo(*xy, duration=0.2)
            return _ok(f"Moved cursor to {xy}")
        if action == "click":
            xy = _xy(target)
            if xy:
                pyautogui.click(*xy)
            else:
                pyautogui.click()
            return _ok("Clicked")
        if action == "scroll":
            try:
                pyautogui.scroll(int(target or "-300"))
            except ValueError:
                return _err("scroll needs a number.")
            return _ok(f"Scrolled {target}")
        if action == "switch_window":
            pyautogui.hotkey("alt", "tab")
            return _ok("Switched window")
        if action == "close_app":
            if sys.platform == "win32":
                subprocess.run(["taskkill", "/IM", target, "/F"], capture_output=True)
            else:
                subprocess.run(["pkill", "-f", target], capture_output=True)
            return _ok(f"Closed {target}")
        if action == "delete_path":
            if not os.path.exists(target):
                return _err("Path not found.")
            if os.path.isdir(target):
                shutil.rmtree(target)
            else:
                os.remove(target)
            return _ok(f"Deleted {target}")
    except Exception as exc:
        return _err(str(exc))
    return _err("Unhandled action.")


def propose(request: str) -> dict:
    """Map a natural-language request to a structured action (no execution)."""
    request = (request or "").strip()
    if not request:
        return {"action": None, "target": None, "label": "", "reason": "Empty request."}
    if not brain.online:
        return {"action": None, "target": None, "label": "", "reason": "Brain offline."}

    prompt = (
        "Translate the user's request into ONE system action.\n"
        "Actions and their target:\n"
        "- open_app (target: one of " + ", ".join(sorted(APPS)) + ")\n"
        "- open_url (target: website)\n"
        "- open_path (target: file/folder path)\n"
        "- type_text (target: the exact text to type)\n"
        "- press_key (target: key or combo like 'enter' or 'ctrl+s')\n"
        "- move_cursor (target: 'x,y')\n- click (target: 'x,y' or empty)\n"
        "- scroll (target: number)\n- switch_window (target: empty)\n"
        "- close_app (target: process exe like 'notepad.exe')\n"
        "- delete_path (target: file/folder path)\n"
        'Reply with ONLY JSON: {"action":"...","target":"...","label":"short summary"}. '
        'If nothing safe fits use {"action":null,"target":null,"label":"why"}.\n\n'
        f"Request: {request}"
    )
    out = brain.respond([{"role": "user", "content": prompt}], mode_key="agent")
    raw = out["reply"].strip()
    try:
        data = json.loads(raw[raw.index("{") : raw.rindex("}") + 1])
    except Exception:
        return {"action": None, "target": None, "label": raw[:120], "reason": "Parse failed."}

    action = data.get("action")
    if action not in ACTIONS:
        action = None
    return {
        "action": action,
        "target": data.get("target"),
        "label": data.get("label", ""),
        "destructive": is_destructive(action) if action else False,
        "reason": None if action else "No safe action matched.",
    }
