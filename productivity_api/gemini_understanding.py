"""
TRADRLY — Gemini LLM Understanding
Conversation multi-tours avec mémoire de session.
"""

import os, json, re, time, hashlib, uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
API_BASE_URL   = "https://generativelanguage.googleapis.com/v1beta/models"
MODEL_NAME     = "gemini-flash-lite-latest"

# Throttle
_last_api_call: float = 0.0
_MIN_INTERVAL  = 2.0

# Cache reponses
_cache: Dict[str, Any] = {}
_CACHE_TTL = 120

# Memoire de conversations : session_id -> { history, last_active }
_sessions: Dict[str, Dict[str, Any]] = {}
_SESSION_TTL = 1800  # 30 min

_JOURS_FR = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"]
_MOIS_FR  = ["janvier","fevrier","mars","avril","mai","juin",
              "juillet","aout","septembre","octobre","novembre","decembre"]


def _now_str() -> str:
    now = datetime.now()
    return f"{_JOURS_FR[now.weekday()]} {now.day} {_MOIS_FR[now.month-1]} {now.year}, {now.strftime('%H:%M')}"


SYSTEM_INSTRUCTION = """You are NOVA, an intelligent AI assistant embedded in a productivity application.

# YOUR INTELLIGENCE
You are NOT a keyword matcher. You UNDERSTAND meaning, intent and context like a human assistant.
- Understand ANY language: French, English, Arabic (including Arabizi / arabic-in-latin-letters), or mixed.
- Reason about what the user REALLY wants, even with typos, slang, indirect phrasing or unusual wording.
- Always reply in `natural_response` using the SAME language the user wrote in.
- Never get fooled by surface words: focus on the true intention behind the sentence.

# DOMAINS YOU MANAGE
1. tasks  — to-do items (create, list, rename, change status, delete)
2. events — calendar (schedule meetings/appointments, list, update, delete)
3. focus  — Pomodoro/focus sessions (start with a duration, stop, pause, resume)

# HOW TO PICK THE INTENT (semantic reasoning, not keywords)
- Decide the DOMAIN from meaning: a task is a thing to do; an event has a date/time/place; focus is a work timer.
- Decide the ACTION from meaning:
  * Creating/adding something new           -> create_task | schedule_event | start_focus
  * Viewing/showing/listing/asking about    -> list_tasks  | list_events
  * Changing/renaming/marking/updating      -> update_task | update_event
  * Removing/deleting/cancelling            -> delete_task | delete_event
  * Stopping/pausing/resuming a timer       -> stop_focus | pause_focus | resume_focus
- CRITICAL distinction: "show me / give me / get / display / what is" = LIST (read), NEVER delete.
  Only true removal verbs (delete, remove, cancel, supprime, efface, annule, احذف, امسح) = DELETE.

# CONTEXT HANDLING
- A `CONTEXT ACTIF` line may tell you the current screen (tasks/events/focus). Prefer it when the message is ambiguous.
- If context = "general" OR no context is given, AUTO-DETECT the right domain from the message meaning.
- A clear instruction overrides the active context (e.g. on the tasks screen, "schedule a meeting tomorrow 3pm" is still schedule_event).

# PARAMETER EXTRACTION
[TASKS]
- Each task shown as "#N title" -> N is the real database id.
- Create: put the task text in `title`.
- Rename / change wording of a task -> intent=update_task, set `id` (the task number) AND `new_title` (the new text).
  Examples: "rename task 3 to groceries", "renomme la tache 2 en projet", "change task 5 title to call mom".
- Mark status (done/todo/in progress) -> intent=update_task, set `id` and `status` ("done" | "todo" | "in_progress").
- Change priority (urgency level) -> intent=update_task, set `id` and `priority` (string: "urgent"|"important"|"normal"|"minor"|"low").
  Examples: "mark task 12 as urgent", "set finir le projet to urgent", "tache 12 est urgente" -> update_task, id=12, priority="urgent"
  Priority values: urgent=5, important=4, normal=3, minor=2, low=1
- When creating a task with urgency words -> include `priority` in create_task params. E.g., "add urgent task call boss" -> create_task, title="call boss", priority="urgent"
- Mark ALL tasks -> intent=update_task, all=true, status=...
- Delete ONE task -> intent=delete_task, id=N.
- Delete SEVERAL tasks -> intent=delete_task, ids=[5,7,...]  (use the list, not a single id).
- If only a task title is referenced (no number), put it in `title` so the backend can match it.

[EVENTS - SCHEDULE]
- Schedule: intent=schedule_event, `title`, AND one of:
  * `start_time` (full ISO8601 like "2026-06-19T14:00:00") — for events with a specific time
  * `due_date` (ISO8601 date like "2026-06-19") — for deadlines (e.g. "due tomorrow", "deadline friday")
  When user says "due" -> use `due_date` (deadline), NOT start_time.
  When start_time is given (specific hour) -> use `start_time`.
  If user says "due" but no specific time -> `due_date` only.

[EVENTS - DURATION]
- If user mentions a duration, compute end_time = start_time + duration:
  * "réunion demain 14h pendant 2h" -> start_time="2026-06-19T14:00:00", end_time="2026-06-19T16:00:00"
  * "1h" = 60min, "30min" = 30min, "toute la matinée" = 4h (09:00-13:00), "toute la journée" = 8h (09:00-17:00)
  * Always include both start_time AND end_time when duration is given.

[EVENTS - UPDATE]
- Move/reschedule -> intent=update_event. Use `title` to identify the event (or `event_id`), AND `new_start_time` (ISO8601).
  Example: "déplace le rdv avec Manel à 16h demain" -> update_event, title="Manel", new_start_time="2026-06-19T16:00:00"
  Example: "move the team meeting to 3pm" -> update_event, title="team meeting", new_start_time="2026-06-18T15:00:00"
- Rename event -> intent=update_event, set `title` OR `event_id` to identify it, AND `new_title` (the new name).
  Example: "renomme la réunion en sync quotidien" -> update_event, title="réunion", new_title="sync quotidien"

[EVENTS - DELETE]
- Delete a SPECIFIC event by its name -> intent=delete_event, set `title` to the event/person name mentioned.
  Example: "delete the meeting with Manel tomorrow", "annule le rdv avec Manel demain" -> delete_event, title="Manel".
  IMPORTANT: when a name/subject is given, ALWAYS fill `title`. Only that matching event must be removed, NOT the whole day.
- Delete by id -> intent=delete_event, event_id=N.
- Delete ALL events -> intent=delete_event, all=true.
- Use `filter_date` ONLY when the user clearly means "everything on/after a date" with NO specific event name.

[EVENTS - LIST]
- "what's on my calendar this week?" -> list_events, filter_range="week"
- "show events today" -> list_events, filter_range="today"
- "events this month" -> list_events, filter_range="month"
- "next meeting" / "prochain rdv" -> intent=next_event (no params needed)

[LIST FILTERS for TASKS]
- "show done tasks" / "mes tâches terminées" -> list_tasks, filter_status="done"
- "show todo tasks" -> list_tasks, filter_status="todo"
- "show urgent tasks" / "tâches urgentes" -> list_tasks, filter_priority="urgent"
- "show important tasks" -> list_tasks, filter_priority="important"
- filter_status values: "done" | "todo" | "in_progress"
- filter_priority values: "urgent" | "important" | "normal" | "minor" | "low"

[SEARCH]
- "do I have a task about X?" / "as-tu une tâche sur X?" -> search_task, search_query="X"
- "find event meeting" -> search_event, search_query="meeting"

[SPECIAL INTENTS]
- "delete completed tasks" / "supprime les tâches terminées" -> clear_completed (no params)
- "what's my next event?" / "prochain rdv?" -> next_event (no params)
- "summarize my day" / "résume ma journée" -> today_summary (no params)

- Resolve relative dates ("tomorrow", "demain", "next monday", "غدا") using the CURRENT DATE/TIME provided below.

[FOCUS]
- Start: intent=start_focus, `duration` in minutes (1h=60, 30min=30). Default 25 if unspecified.
- Stop: stop_focus. Pause: pause_focus. Resume: resume_focus.
- "delete/clear all sessions" is NOT a focus action -> intent=unknown.

# RESPONSE FORMAT — STRICT JSON ONLY (no text before or after)
{
  "intent": "greeting|chat|question|create_task|list_tasks|update_task|delete_task|search_task|clear_completed|schedule_event|list_events|update_event|delete_event|search_event|next_event|today_summary|start_focus|stop_focus|pause_focus|resume_focus|unknown",
  "context": "tasks|events|focus|general",
  "confidence": 0.0 to 1.0,
  "parameters": {
    "title": null,
    "new_title": null,
    "start_time": null,
    "end_time": null,
    "new_start_time": null,
    "due_date": null,
    "filter_date": null,
    "filter_range": null,
    "filter_status": null,
    "filter_priority": null,
    "search_query": null,
    "event_id": null,
    "id": null,
    "ids": null,
    "all": null,
    "status": null,
    "priority": null,
    "duration": null
  },
  "natural_response": "your conversational reply, in the SAME language as the user, confirming what you will do",
  "notes": null
}"""


def _get_system_message() -> str:
    return SYSTEM_INSTRUCTION + f"\n\nDATE ET HEURE ACTUELLES : {_now_str()}\nUtilise toujours cette date pour 'aujourd hui', 'demain', 'lundi prochain', etc."


def _get_or_create_session(session_id):
    now = time.time()
    expired = [sid for sid, s in _sessions.items() if now - s["last_active"] > _SESSION_TTL]
    for sid in expired:
        del _sessions[sid]
    sid = session_id or str(uuid.uuid4())
    if sid not in _sessions:
        _sessions[sid] = {"history": [], "last_active": now}
    else:
        _sessions[sid]["last_active"] = now
    return sid, _sessions[sid]["history"]


def _call_gemini(history, user_text, retries=0):
    global _last_api_call
    elapsed = time.time() - _last_api_call
    if elapsed < _MIN_INTERVAL:
        time.sleep(_MIN_INTERVAL - elapsed)

    contents = list(history) + [{"role": "user", "parts": [{"text": user_text}]}]

    payload = {
        "system_instruction": {"parts": [{"text": _get_system_message()}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 512},
    }

    url = f"{API_BASE_URL}/{MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"
    _last_api_call = time.time()
    resp = requests.post(url, json=payload, timeout=20)

    if resp.status_code == 429:
        if retries == 0:
            time.sleep(10)
            return _call_gemini(history, user_text, retries=1)
        raise ValueError("QUOTA_EXCEEDED")

    resp.raise_for_status()
    data = resp.json()
    candidates = data.get("candidates", [])
    if not candidates:
        raise ValueError("Reponse Gemini vide")
    return candidates[0]["content"]["parts"][0]["text"]


def _parse_json_response(raw):
    raw = raw.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    j0 = raw.find('{')
    j1 = raw.rfind('}') + 1
    if j0 >= 0 and j1 > j0:
        return json.loads(raw[j0:j1])
    raise ValueError("Pas de JSON dans la reponse")


def _local_fallback(text, context, reason):
    return {
        "intent": "unknown",
        "context": context or "general",
        "confidence": 0.1,
        "parameters": {},
        "natural_response": f"Je ne peux pas repondre maintenant ({reason}). Reessaie dans quelques secondes.",
        "notes": reason,
        "_source": "local_fallback",
    }


def _format_state(state: dict) -> str:
    """Format current app state as a compact string for Gemini context injection."""
    lines = []
    tasks = state.get("tasks") or []
    if tasks:
        task_parts = [f"#{t['id']} {t['title']} ({t.get('status','todo')}, {t.get('priority_label','normal')})" for t in tasks[:15]]
        lines.append("TASKS: " + ", ".join(task_parts))
    else:
        lines.append("TASKS: none")

    events = state.get("events") or []
    if events:
        evt_parts = [f"#{e['id']} {e['title']} ({e.get('start_at','?')[:16].replace('T',' ')})" for e in events[:10]]
        lines.append("EVENTS: " + ", ".join(evt_parts))
    else:
        lines.append("EVENTS: none")

    focus = state.get("focus")
    if focus:
        lines.append(f"FOCUS: #{focus.get('id')} {focus.get('minutes')}min ({focus.get('status','?')})")
    else:
        lines.append("FOCUS: no active session")

    return "\n".join(lines)


def understand_command(text, context=None, session_id=None, state=None):
    if not text or not text.strip():
        return _local_fallback(text, context, "message vide")
    if not GEMINI_API_KEY:
        return _local_fallback(text, context, "cle API manquante")

    today = datetime.now().strftime("%Y-%m-%d")
    cache_key = hashlib.md5(f"{today}|{session_id}|{text.strip().lower()}".encode()).hexdigest()
    cached = _cache.get(cache_key)
    if cached and (time.time() - cached["_ts"]) < _CACHE_TTL:
        result = {k: v for k, v in cached.items() if k != "_ts"}
        result["_cached"] = True
        return result

    sid, history = _get_or_create_session(session_id)
    user_msg = text.strip()

    # Injecter le contexte de façon explicite pour guider Gemini
    _CONTEXT_RULES = {
        "tasks":  "CONTEXT ACTIF = tasks (the user is on the Tasks screen). Prefer task actions, but if the message clearly asks for an event or focus action, honor that instead.",
        "events": "CONTEXT ACTIF = events (the user is on the Calendar screen). Prefer event actions, but if the message clearly asks for a task or focus action, honor that instead.",
        "focus":  "CONTEXT ACTIF = focus (the user is on the Focus screen). Prefer focus actions (start/stop/pause/resume). If the message clearly asks for a task or event action, honor that instead.",
        "general": "CONTEXT ACTIF = general (universal command bar). AUTO-DETECT the right domain (tasks/events/focus) from the meaning of the message.",
    }
    if context and context in _CONTEXT_RULES:
        user_msg = f"{_CONTEXT_RULES[context]}\nMessage: {user_msg}"
    elif not context:
        user_msg = f"{_CONTEXT_RULES['general']}\nMessage: {user_msg}"

    # Inject current app state so Gemini knows exact ids/titles
    if state:
        state_str = _format_state(state)
        user_msg = user_msg + f"\n\nCURRENT STATE:\n{state_str}"

    try:
        raw = _call_gemini(history, user_msg)
        parsed = _parse_json_response(raw)

        _sessions[sid]["history"].append({"role": "user",  "parts": [{"text": user_msg}]})
        _sessions[sid]["history"].append({"role": "model", "parts": [{"text": raw}]})
        if len(_sessions[sid]["history"]) > 20:
            _sessions[sid]["history"] = _sessions[sid]["history"][-20:]

        # ── VALIDATION POST-GEMINI ──
        # On fait confiance au raisonnement de Gemini pour choisir le bon domaine.
        # On vérifie seulement que l'intent est globalement valide.
        VALID_INTENTS = {
            "create_task", "list_tasks", "update_task", "delete_task", "search_task", "clear_completed",
            "schedule_event", "list_events", "update_event", "delete_event", "search_event", "next_event", "today_summary",
            "start_focus", "stop_focus", "pause_focus", "resume_focus",
            "unknown", "greeting", "chat", "question",
        }
        if parsed.get("intent") not in VALID_INTENTS:
            parsed["intent"] = "unknown"
            parsed["confidence"] = 0.0

        parsed["_source"] = "gemini"
        parsed["_session_id"] = sid
        _cache[cache_key] = {**parsed, "_ts": time.time()}
        return parsed

    except ValueError as e:
        err = str(e)
        if "QUOTA_EXCEEDED" in err:
            return _local_fallback(text, context, "quota Gemini depasse, reessaie dans 1 min")
        return _local_fallback(text, context, f"erreur: {err}")
    except Exception as e:
        return _local_fallback(text, context, f"erreur reseau: {type(e).__name__}")


def clear_session(session_id):
    if session_id in _sessions:
        _sessions[session_id]["history"] = []
        return True
    return False


def batch_understand_commands(texts, context=None):
    return [understand_command(t, context) for t in texts]


def get_gemini_status():
    return {
        "configured": bool(GEMINI_API_KEY),
        "model": MODEL_NAME,
        "endpoint": API_BASE_URL,
        "active_sessions": len(_sessions),
    }
