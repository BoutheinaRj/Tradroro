import re
from datetime import datetime, timedelta
import dateparser
from dateparser.search import search_dates

try:
    import spacy
    nlp = spacy.load("fr_core_news_md")
except:
    nlp = None


# ================= CLEAN =================
def normalize(text: str):
    return text.lower().strip()


# ================= DATE ENGINE =================
def extract_datetime(text: str):
    settings = {
        "PREFER_DATES_FROM": "future",
        "RELATIVE_BASE": datetime.now()
    }

    result = search_dates(text, languages=["fr", "en"], settings=settings)

    if not result:
        return None, None

    phrase, dt = max(result, key=lambda x: len(x[0]))
    return dt, dt + timedelta(hours=1)


# ================= INTENT =================
def detect_intent(text: str):
    t = normalize(text)

    if any(k in t for k in ["meeting", "rdv", "réunion", "event", "calendrier"]):
        if "supprime" in t or "delete" in t:
            return "delete_event"
        return "create_event"

    if any(k in t for k in ["tache", "task"]):
        if "supprime" in t or "delete" in t:
            return "delete_task"
        return "create_task"

    return "unknown"


# ================= ID (SAFE) =================
def extract_id(text: str):
    m = re.search(r"(?:task|event|tache)?\s*#?\s*(\d+)", text.lower())
    return int(m.group(1)) if m else None


# ================= DATE ONLY FILTER (IMPORTANT FIX) =================
def extract_date(text: str):
    dt, _ = extract_datetime(text)
    return dt


# ================= TITLE =================
def extract_title(text: str):
    text = re.sub(r"(ajoute|create|planifie|meeting|rdv|tache|task|supprime)", "", text, flags=re.I)
    text = re.sub(r"\d+", "", text)
    return text.strip()


# ================= MAIN =================
def parse_command(text: str, context="tasks"):

    intent = detect_intent(text)

    # -------- EVENTS --------
    if intent == "create_event":
        dt, end = extract_datetime(text)
        return {
            "intent": "create_event",
            "params": {
                "title": extract_title(text),
                "start_at": dt.isoformat() if dt else None,
                "end_at": end.isoformat() if end else None
            }
        }

    if intent == "delete_event":
        return {
            "intent": "delete_event",
            "params": {
                "id": extract_id(text),     # si #3
                "date": extract_date(text)  # si "10 june"
            }
        }

    # -------- TASKS --------
    if intent == "create_task":
        return {
            "intent": "create_task",
            "params": {
                "title": extract_title(text)
            }
        }

    if intent == "delete_task":
        return {
            "intent": "delete_task",
            "params": {
                "id": extract_id(text),
                "date": extract_date(text)
            }
        }

    return {"intent": "unknown", "params": {}}