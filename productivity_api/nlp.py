import re
from datetime import datetime, timedelta

from dateparser.search import search_dates

try:
    from intent_embeddings import predict_intent
except Exception:
    predict_intent = None

INTENT_THRESHOLD = 0.45

# ---------------- KEYWORDS ----------------
DELETE_KEYWORDS = ["supprime", "supprimer", "delete", "remove", "efface", "retire", "annule"]
SHOW_KEYWORDS = ["liste", "affiche", "montre", "voir", "show", "list"]
UPDATE_KEYWORDS = ["modifie", "modifier", "change", "changer", "update", "edit",
                   "devient", "renommer", "renomme", "marquer", "passer"]
EVENT_KEYWORDS = ["meeting", "réunion", "rdv", "rendez-vous", "agenda", "calendrier",
                  "event", "événement", "évènement", "meet", "call", "schedule"]
FOCUS_KEYWORDS = ["focus", "pomodoro", "concentration"]
TASK_ACTION_WORDS = r"\b(acheter|faire|finir|préparer|envoyer|appeler|réserver|organiser|" \
                    r"réviser|terminer|corriger|écrire|lire|payer)\b"
CREATE_HINTS = [r"\bje\s+dois\b", r"\bil\s+faut\b", r"\bje\s+veux\b",
                r"\bj['’ ]ai\s+besoin\b", r"\brappelle[- ]moi\b", r"\bnote\b"]

# Mots à retirer pour nettoyer un titre
STOPWORDS_TITLE = (
    r"\b(ajoute|ajouter|crée|créer|create|add|planifie|planifier|note|mets|"
    r"je veux|je dois|il faut|une|un|le|la|les|de|du|à|a|pour|"
    r"meeting|réunion|rdv|rendez-vous|event|événement|évènement|meet|call|"
    r"task|tache|tâche|supprime|supprimer|delete)\b"
)

# Bruit temporel pour nettoyage
DATE_NOISE = {
    "demain", "today", "tomorrow", "aujourd'hui", "soir", "matin", "midi", "nuit",
    "prochain", "prochaine", "next",
    "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december",
    "janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
    "septembre", "octobre", "novembre", "décembre"
}

# ---------------- DATE ----------------
def extract_datetime(text: str):
    """
    Retourne (start_dt, end_dt, phrase_date) ou (None, None, None)
    en utilisant search_dates (dateparser) + fallback manuel.
    """
    now = datetime.now()
    # 1) dateparser
    found = search_dates(
        text,
        languages=["fr", "en"],
        settings={"PREFER_DATES_FROM": "future", "RELATIVE_BASE": now}
    )
    if found:
        phrase, dt = max(found, key=lambda x: len(x[0]))
        return dt, dt + timedelta(hours=1), phrase

    # 2) Fallback manuel (phrase = None pour ne pas effacer le titre)
    hour = None
    minute = 0
    hm = re.search(r"(?:at\s+)?(\d{1,2})\s*(?:h|:|\.)?\s*(\d{2})?\s*(am|pm)?", text, re.I)
    if hm and (hm.group(2) or "h" in (hm.group(0) or "") or hm.group(3)):
        hour = int(hm.group(1))
        if hm.group(2):
            minute = int(hm.group(2))
        ampm = (hm.group(3) or "").lower()
        if ampm == "pm" and hour < 12:
            hour += 12
        elif ampm == "am" and hour == 12:
            hour = 0
    else:
        m = re.search(r"(\d{1,2})\s*(?:h|heures|hour|hr)", text, re.I)
        if m:
            hour = int(m.group(1))
            minute = 0

    date_part = None
    if "tomorrow" in text.lower() or "demain" in text.lower():
        date_part = now + timedelta(days=1)
    elif "today" in text.lower() or "aujourd'hui" in text.lower():
        date_part = now
    elif "next" in text.lower():
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
                "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
        for d in days:
            if d in text.lower():
                target = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].index(d) if d in ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] else None
                if target is None:
                    fr_to_en = {"lundi":"monday","mardi":"tuesday","mercredi":"wednesday","jeudi":"thursday","vendredi":"friday","samedi":"saturday","dimanche":"sunday"}
                    d_en = fr_to_en.get(d, d)
                    target = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].index(d_en)
                today = now.weekday()
                delta = (target - today) % 7
                if delta == 0:
                    delta = 7
                date_part = now + timedelta(days=delta)
                break
    elif "in" in text.lower():
        m = re.search(r"in\s+(\d+)\s+(day|days|jour|jours)", text.lower())
        if m:
            date_part = now + timedelta(days=int(m.group(1)))

    if date_part and hour is not None:
        return date_part.replace(hour=hour, minute=minute, second=0, microsecond=0), \
               date_part.replace(hour=hour, minute=minute, second=0, microsecond=0) + timedelta(hours=1), None
    if date_part:
        return date_part.replace(hour=9, minute=0, second=0, microsecond=0), \
               date_part.replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(hours=1), None
    if hour is not None:
        return now.replace(hour=hour, minute=minute, second=0, microsecond=0), \
               now.replace(hour=hour, minute=minute, second=0, microsecond=0) + timedelta(hours=1), None

    return None, None, None

# ---------------- IDS ----------------
def extract_task_id(text: str):
    m = re.search(r"(task|tache|tâche)\s*#?\s*(\d+)", text, re.I)
    if m:
        return int(m.group(2))
    m = re.search(r"#\s*(\d+)", text)
    return int(m.group(1)) if m else None

def extract_event_id(text: str):
    m = re.search(r"(event|événement|évènement|meeting|réunion|rdv)\s*#?\s*(\d+)", text, re.I)
    if m:
        return int(m.group(2))
    m = re.search(r"id\s*#?\s*(\d+)", text, re.I)
    return int(m.group(1)) if m else None

# ---------------- TITLE ----------------
def clean_title(text: str, date_phrase: str | None = None):
    """
    Nettoie le texte pour obtenir un titre :
    - retire la portion date si fournie
    - retire les mots-outils, les indicateurs de temps, les chiffres isolés
    """
    t = text
    if date_phrase:
        t = t.replace(date_phrase, " ")
    # retire les patterns d'heure comme "10h", "10h30", "14:30"
    t = re.sub(r"\b\d{1,2}\s*[h:]\s*\d{0,2}\b", " ", t)
    # supprime les mots-outils
    t = re.sub(STOPWORDS_TITLE, " ", t, flags=re.I)
    # supprime les bruits de date
    for noise in DATE_NOISE:
        t = re.sub(rf"\b{noise}\b", " ", t, flags=re.I)
    # nettoie les espaces multiples et la ponctuation
    t = re.sub(r"\s+", " ", t).strip(" .,:-")
    return t if len(t) > 1 else ""

# ---------------- STATUS ----------------
def extract_status(text: str):
    low = text.lower()
    if "done" in low or "terminé" in low or "fini" in low:
        return "done"
    if "doing" in low or "en cours" in low:
        return "doing"
    if "todo" in low or "à faire" in low:
        return "todo"
    return None

def extract_minutes(text: str, default: int = 25):
    m = re.search(r"(\d+)\s*(min|minutes|m)?", text.lower())
    return int(m.group(1)) if m else default

# ==================== FALLBACK IA ====================
def ai_fallback(text: str):
    if predict_intent is None:
        return None
    try:
        intent, score = predict_intent(text)
    except Exception:
        return None

    if score < INTENT_THRESHOLD:
        return None

    mapping = {
        "tasks.create": "create_task",
        "tasks.list": "list_tasks",
        "tasks.delete": "delete_task",
        "tasks.get": "get_task",
        "tasks.update": "update_task",
        "calendar.create": "create_event",
        "calendar.list": "list_events",
        "calendar.delete": "delete_event",
        "focus.start": "start_focus",
        "focus.stop": "stop_focus",
        "focus.list": "list_focus",
    }
    mapped = mapping.get(intent)
    if mapped is None:
        return None

    params = {}
    if mapped in ["get_task", "delete_task", "update_task"]:
        tid = extract_task_id(text)
        if tid is not None:
            params["id"] = tid
    if mapped == "delete_event":
        eid = extract_event_id(text)
        if eid is not None:
            params["id"] = eid
        else:
            # Essayer d'extraire date ou titre
            start, end, phrase = extract_datetime(text)
            if start:
                params["start_at"] = start.isoformat()
            else:
                title = clean_title(text)
                if title:
                    params["title"] = title
    if mapped == "create_task":
        title = clean_title(text)
        if title:
            params["title"] = title
    if mapped == "create_event":
        start, end, phrase = extract_datetime(text)
        if start:
            params["start_at"] = start.isoformat()
            params["end_at"] = end.isoformat() if end else (start + timedelta(hours=1)).isoformat()
        title = clean_title(text.replace(phrase, " ") if phrase else text)
        if title:
            params["title"] = title
        else:
            params["title"] = "Événement"
    if mapped == "start_focus":
        minutes = extract_minutes(text, 25)
        params["minutes"] = minutes

    return {"intent": mapped, "params": params}

# ---------------- MAIN PARSER ----------------
def parse_command(text: str, context: str | None = None):
    text = (text or "").strip()
    if not text:
        return {"intent": "unknown", "params": {}}
    low = text.lower()

    has_delete = any(k in low for k in DELETE_KEYWORDS)
    has_show = any(k in low for k in SHOW_KEYWORDS)
    has_update = any(k in low for k in UPDATE_KEYWORDS)

    # ============ FOCUS ============
    if any(k in low for k in FOCUS_KEYWORDS):
        if any(w in low for w in ["stop", "arrête", "arreter", "termine"]):
            return {"intent": "stop_focus", "params": {}}
        if any(w in low for w in ["start", "démarre", "demarre", "lance"]):
            return {"intent": "start_focus", "params": {"minutes": extract_minutes(text)}}
        return {"intent": "start_focus", "params": {"minutes": extract_minutes(text)}}

    # ============ EVENTS ============
    if any(k in low for k in EVENT_KEYWORDS) or context == "calendar":
        if has_delete:
            # 1) Essayer ID
            eid = extract_event_id(low)
            if eid:
                return {"intent": "delete_event", "params": {"id": eid}}
            # 2) Essayer date
            start, end, phrase = extract_datetime(text)
            if start:
                return {"intent": "delete_event", "params": {"start_at": start.isoformat()}}
            # 3) Essayer titre (nettoyé)
            title = clean_title(text, phrase)
            if title:
                return {"intent": "delete_event", "params": {"title": title}}
            # 4) Sinon demande ID
            return {"intent": "need_event_id", "params": {}}
        if has_show:
            return {"intent": "list_events", "params": {}}
        # CREATE
        start, end, phrase = extract_datetime(text)
        title = clean_title(text.replace(phrase, " ") if phrase else text) or "Événement"
        if not start:
            return {"intent": "need_event_time", "params": {"title": title}}
        return {
            "intent": "create_event",
            "params": {
                "title": title,
                "start_at": start.isoformat(),
                "end_at": end.isoformat(),
            },
        }

    # ============ TASKS ============
    if has_show:
        tid = extract_task_id(low)
        if tid:
            return {"intent": "get_task", "params": {"id": tid}}
        return {"intent": "list_tasks", "params": {}}
    if has_delete:
        tid = extract_task_id(low)
        if tid:
            return {"intent": "delete_task", "params": {"id": tid}}
        return {"intent": "need_task_id", "params": {}}
    if has_update:
        tid = extract_task_id(low)
        if not tid:
            return {"intent": "need_task_id", "params": {}}
        status = extract_status(low)
        if status:
            return {"intent": "update_task", "params": {"id": tid, "status": status}}
        new_title = clean_title(text)
        if new_title:
            return {"intent": "update_task", "params": {"id": tid, "title": new_title}}
        return {"intent": "need_task_title", "params": {"id": tid}}
    if any(re.search(p, low) for p in CREATE_HINTS) or re.search(TASK_ACTION_WORDS, low):
        title = clean_title(text)
        if len(title) > 2:
            return {"intent": "create_task", "params": {"title": title}}
        return {"intent": "need_task_title", "params": {}}

    # ============ FALLBACK IA ============
    ai_result = ai_fallback(text)
    if ai_result:
        return ai_result

    return {"intent": "unknown", "params": {}}