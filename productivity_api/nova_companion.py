"""
Nova companion mode: free-form supportive conversation via Gemini.
No JSON parsing, plain conversational text output.
"""

import os
import re
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
MODEL_NAME = "gemini-flash-lite-latest"

_MIN_INTERVAL = 1.2
_SESSION_TTL = 1800  # 30 min
_MAX_HISTORY = 24

_last_api_call: float = 0.0
_sessions: Dict[str, Dict[str, Any]] = {}


NOVA_SYSTEM_PROMPT = """You are Nova, the user's personal companion.
You are warm, kind, playful when needed, and motivating when needed.

LANGUAGE POLICY (STRICT):
- Support French, English, and Arabic (Modern Standard, Darija, or Arabizi latin-letters).
- If user writes in English -> reply fully in English.
- If user writes in French -> reply fully in French.
- If user writes in Arabic or Arabizi -> reply fully in Arabic script.
- If message is mixed/ambiguous -> prefer English.

RULES:
- Keep replies short (1 to 3 sentences max unless user asks for more).
- Adapt tone to emotion: sad -> comforting, stressed -> calm, happy -> upbeat.
- You can joke, motivate, listen, and ask caring follow-up questions.
- If user asks for real task/event/focus actions, gently suggest switching to Productivity mode.
- Never invent facts about the user. If you do not know, ask.

STYLE:
- Use up to 2 emojis max.
- Sound human and natural, never robotic.
- Keep continuity from recent conversation.
"""


def _detect_language(text: str) -> str:
    """Return 'en', 'fr', or 'ar'. English is default for mixed/ambiguous input."""
    # Arabic Unicode block check
    if re.search(r'[\u0600-\u06FF]', text or ""):
        return "ar"
    low = (text or "").lower()
    # Arabizi (arabic in latin letters)
    arabizi = re.findall(
        r"\b(salam|marhaba|ahlan|shukran|inshallah|habibi|wach|kifach|bghit|ndir|kteb|3andi|w9t|walla|ma3ak|labas|wakha|zwina|hadi|dyal|dyali|hna|huma|nta|nti|ana|kif|ach|bach|fach)\b",
        low,
    )
    if len(arabizi) >= 1:
        return "ar"
    fr_words = re.findall(
        r"\b(je|tu|il|elle|nous|vous|ils|elles|le|la|les|de|du|des|est|sont|avec|pour|dans|sur|pas|ne|bonjour|salut|merci|oui|non|tache|evenement|rendez|stresse|triste|heureux)\b",
        low,
    )
    en_words = re.findall(
        r"\b(i|you|he|she|we|they|the|a|an|is|are|with|for|in|on|not|hello|thanks|yes|no|task|event|meeting|stressed|sad|happy|motivation|joke)\b",
        low,
    )
    if len(fr_words) > len(en_words) and len(fr_words) >= 2:
        return "fr"
    return "en"


def _classify_emotion(text: str) -> str:
    """Return one of: triste | stresse | joyeux | neutre."""
    low = (text or "").lower()

    stress_words = ["stress", "stresse", "pression", "anx", "panic", "burnout", "fatigue", "overwhelmed",
                    "ضغط", "قلق", "توتر", "تعب", "مضغوط"]
    sad_words = ["triste", "deprime", "mal", "seul", "vide", "pleure", "decu", "sad", "down",
                 "حزين", "زعفان", "مكسور", "وحيد", "بكيت"]
    happy_words = ["heureux", "content", "genial", "super", "top", "cool", "joie", "happy", "great",
                   "فرحان", "سعيد", "زوين", "مزيان", "رائع"]

    if any(w in low for w in stress_words):
        return "stresse"
    if any(w in low for w in sad_words):
        return "triste"
    if any(w in low for w in happy_words):
        return "joyeux"

    try:
        from nlp_advanced import extract_sentiment

        s = extract_sentiment(text)
        polarity = float(s.get("polarity", 0.0))
        if polarity >= 0.25:
            return "joyeux"
        if polarity <= -0.25:
            return "triste"
    except Exception:
        pass

    return "neutre"


def _get_or_create_session(session_id: Optional[str]) -> Tuple[str, List[Dict[str, Any]]]:
    now = time.time()
    expired = [sid for sid, val in _sessions.items() if (now - val.get("last_active", 0)) > _SESSION_TTL]
    for sid in expired:
        del _sessions[sid]

    sid = session_id or str(uuid.uuid4())
    if sid not in _sessions:
        _sessions[sid] = {"history": [], "last_active": now}
    else:
        _sessions[sid]["last_active"] = now

    return sid, _sessions[sid]["history"]


def _call_gemini_free_text(history: List[Dict[str, Any]], user_text: str) -> str:
    global _last_api_call

    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY missing")

    elapsed = time.time() - _last_api_call
    if elapsed < _MIN_INTERVAL:
        time.sleep(_MIN_INTERVAL - elapsed)

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    payload = {
        "system_instruction": {
            "parts": [{"text": NOVA_SYSTEM_PROMPT + f"\nDate/heure actuelle: {now_str}"}]
        },
        "contents": list(history) + [{"role": "user", "parts": [{"text": user_text}]}],
        "generationConfig": {
            "temperature": 0.9,
            "topP": 0.95,
            "maxOutputTokens": 220,
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
    candidates = data.get("candidates", [])
    if not candidates:
        raise ValueError("Gemini response is empty")

    text = candidates[0]["content"]["parts"][0].get("text", "").strip()
    if not text:
        raise ValueError("Gemini returned empty text")
    return text


def chat_with_nova(text: str, session_id: Optional[str] = None) -> Dict[str, Any]:
    user_text = (text or "").strip()
    lang = _detect_language(user_text)
    if not user_text:
        fallback_empty = (
            "أنا هنا معك. أخبرني بما يدور في بالك."
            if lang == "ar"
            else "I'm here for you. Tell me what is on your mind."
            if lang == "en"
            else "Je suis la pour toi. Dis-moi ce que tu as sur le coeur."
        )
        return {
            "reply": fallback_empty,
            "emotion": "neutre",
            "lang": lang,
            "session_id": session_id or "",
            "source": "local_fallback",
        }

    emotion = _classify_emotion(user_text)
    sid, history = _get_or_create_session(session_id)

    lang_instruction = (
        "Reply in Arabic script (Modern Standard or Darija). Do NOT use French or English."
        if lang == "ar"
        else "Reply in English only."
        if lang == "en"
        else "Reply in French only."
    )
    framed_input = (
        f"Detected emotion: user seems {emotion}. Adapt your tone accordingly.\n"
        f"Language detected: {lang}. {lang_instruction}\n\n"
        f"User message: {user_text}"
    )

    try:
        reply = _call_gemini_free_text(history, framed_input)

        history.append({"role": "user", "parts": [{"text": user_text}]})
        history.append({"role": "model", "parts": [{"text": reply}]})
        if len(history) > _MAX_HISTORY:
            _sessions[sid]["history"] = history[-_MAX_HISTORY:]

        _sessions[sid]["last_active"] = time.time()
        return {
            "reply": reply,
            "emotion": emotion,
            "lang": lang,
            "session_id": sid,
            "source": "gemini",
        }
    except Exception:
        fallback = (
            "أنا هنا معك. هل تريد أن تخبرني أكثر حتى أساعدك بشكل أفضل؟"
            if lang == "ar"
            else "I'm here with you. Do you want to tell me a bit more so I can help better?"
            if lang == "en"
            else "Je suis avec toi. Tu veux m'en dire un peu plus pour que je t'aide mieux ?"
        )
        return {
            "reply": fallback,
            "emotion": emotion,
            "lang": lang,
            "session_id": sid,
            "source": "local_fallback",
        }
