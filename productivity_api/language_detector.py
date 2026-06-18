"""
Multi-language NLP support: French & English
Detects language and adapts keyword extraction accordingly.
"""

import re
from typing import Dict, Optional, Tuple


def detect_language(text: str) -> str:
    """
    Detect if text is in French (fr) or English (en)
    Uses keyword and character pattern matching.
    Returns: "fr" or "en"
    """
    text_lower = text.lower()
    
    # French keywords
    fr_keywords = {
        "appelle", "appeler", "ajoute", "ajouter", "crée", "créer", "supprime", "supprimer",
        "planifie", "planifier", "demain", "aujourd'hui", "hier", "jeudi", "vendredi", 
        "lundi", "mardi", "mercredi", "samedi", "dimanche", "urgent", "important", 
        "normal", "avant", "après", "avec", "sans", "la", "le", "de", "du", "au",
        "et", "ou", "est", "a", "à", "pour", "par", "sur", "dans", "chez",
        "démarrer", "arrêter", "terminer", "finir", "commencer", "rappel", "événement"
    }
    
    # English keywords
    en_keywords = {
        "call", "add", "create", "delete", "remove", "schedule", "plan", "start",
        "tomorrow", "today", "yesterday", "monday", "tuesday", "wednesday", "thursday",
        "friday", "saturday", "sunday", "urgent", "important", "normal", "before",
        "after", "with", "without", "the", "a", "and", "or", "is", "has", "have",
        "to", "for", "by", "in", "at", "from", "on", "meet", "event", "reminder",
        "focus", "session", "task", "timer", "minute", "hour", "day", "week"
    }
    
    words = re.findall(r'\w+', text_lower)
    fr_score = sum(1 for w in words if w in fr_keywords)
    en_score = sum(1 for w in words if w in en_keywords)
    
    # If tie, check common French patterns
    if fr_score == en_score:
        if re.search(r'ç|à|é|è|ê|ë|î|ï|ô|ù|û', text):
            return "fr"
        if re.search(r'\b(is|are|has|have|does|can|would|should)\b', text_lower):
            return "en"
    
    return "fr" if fr_score >= en_score else "en"


def get_priority_keywords(lang: str = "fr") -> Dict[int, list]:
    """
    Get priority level keywords for the detected language.
    Returns mapping of priority (5-1) to keyword lists.
    """
    if lang == "en":
        return {
            5: ["urgent", "critical", "asap", "emergency", "immediately", "critical!"],
            4: ["important", "high", "significant", "must do", "priority"],
            3: ["normal", "regular", "standard", "todo", "task"],
            2: ["low", "can wait", "eventually", "maybe", "consider"],
            1: ["trivial", "ignore", "skip", "optional", "whenever"],
        }
    else:  # French
        return {
            5: ["urgent", "critique", "asap", "immédiat", "dès que possible", "urgent!", "critique!"],
            4: ["important", "élevé", "priorité", "à faire", "crucial"],
            3: ["normal", "régulier", "standard", "tâche", "todo"],
            2: ["bas", "peut attendre", "éventuellement", "peut-être", "à considérer"],
            1: ["trivial", "ignorer", "sauter", "optionnel", "quand tu veux"],
        }


def get_intent_keywords(lang: str = "fr") -> Dict[str, list]:
    """
    Get intent detection keywords for the detected language.
    """
    if lang == "en":
        return {
            "create_task": ["add", "create", "make", "new task", "task", "do", "need to"],
            "delete_task": ["delete", "remove", "remove task", "cancel", "forget"],
            "create_event": ["schedule", "add event", "plan", "meeting", "event", "call"],
            "start_focus": ["focus", "start focus", "pomodoro", "timer", "concentrate", "work"],
            "complete_task": ["done", "finish", "complete", "mark done", "finished"],
        }
    else:  # French
        return {
            "create_task": ["ajoute", "ajouter", "crée", "créer", "nouvelle tâche", "tâche", "faire", "dois"],
            "delete_task": ["supprime", "supprimer", "retire", "retirer", "annule", "annuler", "oublie"],
            "create_event": ["planifie", "planifier", "ajoute un événement", "événement", "meeting", "appelle", "rendez-vous"],
            "start_focus": ["focus", "démarrer focus", "pomodoro", "minuteur", "concentre", "travaille"],
            "complete_task": ["fait", "termine", "complet", "marque fait", "terminé"],
        }


def get_date_patterns(lang: str = "fr") -> Dict[str, str]:
    """
    Get regex patterns for date parsing in the detected language.
    """
    if lang == "en":
        return {
            "tomorrow": r"(tomorrow|tmrw|next day)",
            "today": r"(today|this day)",
            "yesterday": r"(yesterday)",
            "days": r"(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)",
            "time": r"(\d{1,2}(?:am|pm|a\.m\.|p\.m\.)|\d{1,2}:\d{2}(?:am|pm)?)",
        }
    else:  # French
        return {
            "tomorrow": r"(demain|lendemain)",
            "today": r"(aujourd'hui|ce jour)",
            "yesterday": r"(hier)",
            "days": r"(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lu|ma|me|je|ve|sa|di)",
            "time": r"(\d{1,2}h(?:\d{2})?|\d{1,2}:\d{2})",
        }


def extract_verb_by_language(text: str, lang: str) -> Optional[str]:
    """
    Extract main verb based on language.
    """
    if lang == "en":
        en_verbs = ["add", "create", "delete", "remove", "schedule", "plan", "call", "send",
                    "finish", "complete", "start", "begin", "make", "do", "organize", "arrange"]
        for verb in en_verbs:
            if re.search(rf'\b{verb}\b', text.lower()):
                return verb.lower()
    else:  # French
        fr_verbs = ["ajoute", "ajouter", "crée", "créer", "supprime", "supprimer", "planifie", 
                    "planifier", "appelle", "appeler", "envoie", "envoyer", "termine", "terminer",
                    "complete", "complet", "démarre", "démarrer", "fais", "faire", "organise", "organiser"]
        for verb in fr_verbs:
            if re.search(rf'\b{verb}\b', text.lower()):
                return verb.lower()
    
    return None


def translate_intent(intent: str, from_lang: str = "fr", to_lang: str = "en") -> str:
    """
    Translate intent names between languages.
    Intent names stay the same internally (create_task, etc) but labels can be translated.
    """
    labels = {
        "fr": {
            "create_task": "Créer tâche",
            "delete_task": "Supprimer tâche",
            "create_event": "Créer événement",
            "start_focus": "Démarrer focus",
            "complete_task": "Compléter tâche",
        },
        "en": {
            "create_task": "Create Task",
            "delete_task": "Delete Task",
            "create_event": "Create Event",
            "start_focus": "Start Focus",
            "complete_task": "Complete Task",
        }
    }
    
    return labels.get(to_lang, {}).get(intent, intent)


def get_priority_label(priority: int, lang: str = "fr") -> str:
    """
    Get priority label in the detected language.
    """
    if lang == "en":
        return {
            5: "CRITICAL",
            4: "HIGH",
            3: "NORMAL",
            2: "LOW",
            1: "TRIVIAL",
        }.get(priority, "NORMAL")
    else:  # French
        return {
            5: "URGENT",
            4: "IMPORTANT",
            3: "NORMAL",
            2: "BAS",
            1: "TRIVIAL",
        }.get(priority, "NORMAL")
