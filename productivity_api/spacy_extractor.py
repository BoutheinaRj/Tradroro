"""
Spacy-powered NLP extractor for productivity commands.
Uses NER, POS tagging, dependency parsing + advanced NLP features.
Multi-language support: French & English
"""

import re
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
import dateparser
from dateparser.search import search_dates
from language_detector import (
    detect_language, 
    get_priority_keywords, 
    get_intent_keywords,
    get_priority_label,
    extract_verb_by_language
)

# Load both French and English Spacy models
nlp_fr = None
nlp_en = None

try:
    import spacy
    try:
        nlp_fr = spacy.load("fr_core_news_md")
        print("✓ French Spacy model loaded")
    except Exception as e:
        print(f"⚠️  Warning: Could not load French Spacy model: {e}")
    
    try:
        nlp_en = spacy.load("en_core_web_sm")
        print("✓ English Spacy model loaded")
    except Exception as e:
        print(f"⚠️  Warning: Could not load English Spacy model: {e}")
except Exception as e:
    print(f"⚠️  Warning: Spacy not available: {e}")


def get_nlp_model(lang: str = "fr"):
    """Get the appropriate Spacy model for the detected language."""
    if lang == "en":
        return nlp_en
    return nlp_fr


# =============== NORMALIZATION ===============
def normalize(text: str) -> str:
    """Normalize text for processing"""
    return text.lower().strip()


# =============== SPACY-POWERED EXTRACTION ===============
def extract_entities_ner(text: str, lang: str = "fr") -> Dict[str, list]:
    """
    Extract named entities using Spacy NER.
    Uses language-specific model.
    """
    nlp = get_nlp_model(lang)
    if not nlp:
        return {"people": [], "organizations": [], "locations": [], "projects": []}

    doc = nlp(text)
    entities = {
        "people": [],
        "organizations": [],
        "locations": [],
        "projects": [],
    }

    for ent in doc.ents:
        if ent.label_ == "PER":
            entities["people"].append(ent.text)
        elif ent.label_ == "ORG":
            entities["organizations"].append(ent.text)
        elif ent.label_ == "LOC":
            entities["locations"].append(ent.text)

    # Extract project patterns (CamelCase or "Projet*", "Client*")
    project_patterns = [
        r"\b([A-Z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]*)+)\b",  # CamelCase
        r"(?:Projet|Project|Client|Sprint)[\w]+",  # Project keywords
    ]
    for pattern in project_patterns:
        matches = re.findall(pattern, text)
        entities["projects"].extend(matches)

    return entities


def extract_main_verb(text: str, lang: str = "fr") -> Optional[str]:
    """
    Extract the main action verb using POS tagging or language-specific keywords.
    """
    # Try language-specific keyword extraction first
    verb = extract_verb_by_language(text, lang)
    if verb:
        return verb
    
    # Fall back to Spacy if available
    nlp = get_nlp_model(lang)
    if not nlp:
        return None

    doc = nlp(text)
    for token in doc:
        if token.pos_ == "VERB" and token.dep_ not in ("xcomp", "acl"):
            return token.text.lower()

    return None


def extract_direct_object(text: str, lang: str = "fr") -> Optional[str]:
    """
    Extract the direct object of the main verb using dependency parsing.
    """
    nlp = get_nlp_model(lang)
    if not nlp:
        return None

    doc = nlp(text)
    for token in doc:
        if token.pos_ == "VERB":
            for child in token.children:
                if child.dep_ in ("obj", "dobj"):
                    return child.text
    return None


def extract_priority_level(text: str, lang: str = "fr") -> Tuple[int, str]:
    """
    Extract priority (1-5) and urgency keyword based on language.
    """
    priority_keywords = get_priority_keywords(lang)
    
    for priority, keywords in priority_keywords.items():
        for keyword in keywords:
            if re.search(rf'\b{re.escape(keyword)}\b', text, re.IGNORECASE):
                return priority, get_priority_label(priority, lang)
    
    return 3, get_priority_label(3, lang)  # Default to NORMAL


def extract_participants(text: str, lang: str = "fr") -> list:
    """
    Extract people involved (assignees, participants).
    Uses language-specific patterns.
    """
    nlp = get_nlp_model(lang)
    participants = []
    
    if nlp:
        doc = nlp(text)
        for ent in doc.ents:
            if ent.label_ == "PER":
                participants.append(ent.text)

    # Language-specific patterns
    if lang == "en":
        patterns = [
            r"(?:with|to|assign to|for)\s+([A-Za-z]+)",
            r"(?:call|contact|meet)\s+([A-Za-z]+)",
        ]
    else:  # French
        patterns = [
            r"(?:avec|à|assigne|attribue)\s+(?:à|pour)?\s*([A-Za-zÀ-ÿ]+)",
            r"(?:appelle|appeler)\s+([A-Za-zÀ-ÿ]+)",
        ]
    
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        participants.extend(matches)

    return list(set(participants))  # Remove duplicates


# =============== DATE & TIME ===============
def extract_datetime(text: str) -> Tuple[Optional[datetime], Optional[datetime]]:
    """Extract start and end datetime from text."""
    settings = {
        "PREFER_DATES_FROM": "future",
        "RELATIVE_BASE": datetime.now(),
    }

    try:
        result = search_dates(text, languages=["fr", "en"], settings=settings)
        if result:
            phrase, dt = max(result, key=lambda x: len(x[0]))
            return dt, dt + timedelta(hours=1)
    except:
        pass

    return None, None


# =============== ID EXTRACTION ===============
def extract_id(text: str) -> Optional[int]:
    """Extract ID from patterns like #3, task 5, event 2"""
    patterns = [
        r"#\s*(\d+)",
        r"(?:task|tache|tâche|event|événement)\s+(?:#)?(\d+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return int(match.group(1))
    return None


# =============== TITLE CLEANING ===============
def extract_title(text: str, date_phrase: Optional[str] = None) -> str:
    """
    Clean and extract title from command.
    Removes action verbs, time expressions, stop words.
    """
    t = text
    if date_phrase:
        t = t.replace(date_phrase, " ")

    # Remove action verbs
    t = re.sub(
        r"\b(crée|créer|ajoute|ajouter|supprime|supprimer|appelle|appeler|"
        r"planifie|planifier|note|créé|ajouté|add|create|schedule)\b",
        " ",
        t,
        flags=re.IGNORECASE,
    )

    # Remove timestamps
    t = re.sub(r"\b\d{1,2}\s*[h:]\s*\d{0,2}\b", " ", t)

    # Remove common stop words
    stopwords_pattern = (
        r"\b(le|la|les|de|du|à|un|une|des|pour|par|avec|sans|sur|dans|demain|"
        r"aujourd'hui|urgent|asap|immédiat|prioritaire|important)\b"
    )
    t = re.sub(stopwords_pattern, " ", t, flags=re.IGNORECASE)

    # Clean up multiple spaces
    t = re.sub(r"\s+", " ", t).strip()

    return t if t else "Untitled"


# =============== MAIN PARSING ===============
def parse_command_advanced(text: str, context: str = "tasks") -> Dict:
    """
    Advanced command parsing with language detection + Spacy + NLP features.
    Supports both French and English.
    """
    # Auto-detect language
    lang = detect_language(text)
    
    normalized = normalize(text)
    dt_start, dt_end = extract_datetime(text)
    priority_score, priority_label = extract_priority_level(text, lang)

    return {
        "language": lang,
        "intent": detect_intent(normalized, lang),
        "title": extract_title(text),
        "verb": extract_main_verb(text, lang),
        "object": extract_direct_object(text, lang),
        "start_at": dt_start.isoformat() if dt_start else None,
        "end_at": dt_end.isoformat() if dt_end else None,
        "priority": priority_score,
        "priority_label": priority_label,
        "entities": extract_entities_ner(text, lang),
        "participants": extract_participants(text, lang),
        "id": extract_id(text),
    }


def detect_intent(text: str, lang: str = "fr") -> str:
    """Detect intent from normalized text based on language."""
    t = normalize(text)
    
    # Get language-specific intent keywords
    intent_keywords = get_intent_keywords(lang)
    
    # Check each intent
    for intent, keywords in intent_keywords.items():
        for keyword in keywords:
            if keyword in t:
                return intent
    
    return "create_task"  # Default to create_task


# Legacy function for backwards compatibility
def parse_command(text: str, context="tasks"):
    """Wrapper for backwards compatibility."""
    advanced = parse_command_advanced(text, context)

    if advanced["intent"] == "create_task":
        return {
            "intent": "create_task",
            "params": {
                "title": advanced["title"],
                "priority": advanced["priority"],
                "assignee": advanced["participants"][0] if advanced["participants"] else None,
            },
        }

    if advanced["intent"] == "create_event":
        return {
            "intent": "create_event",
            "params": {
                "title": advanced["title"],
                "start_at": advanced["start_at"],
                "end_at": advanced["end_at"],
                "participants": advanced["participants"],
                "priority": advanced["priority"],
            },
        }

    if advanced["intent"] == "start_focus":
        return {
            "intent": "start_focus",
            "params": {
                "minutes": 25,
            },
        }

    return {
        "intent": advanced["intent"],
        "params": advanced,
    }