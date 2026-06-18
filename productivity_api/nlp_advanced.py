"""
Advanced NLP module using Spacy + NLTK + TextBlob
Extracts:
  - Named entities (people, orgs, locations, projects)
  - Sentiment & priority (URGENT, ASAP, HIGH, etc.)
  - Action verbs & object dependencies
  - Task metadata (assignee, deadline, priority)
"""

import re
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional

import spacy
from textblob import TextBlob
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords

# Download NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)

# Load Spacy model
try:
    nlp = spacy.load("fr_core_news_md")
except OSError:
    print("⚠️  Spacy model not found. Install with: python -m spacy download fr_core_news_md")
    nlp = None

PRIORITY_KEYWORDS = {
    "urgent": 5,
    "asap": 5,
    "immédiat": 5,
    "prioritaire": 4,
    "important": 3,
    "normal": 2,
    "faible": 1,
}

URGENCY_PATTERNS = [
    (r"\b(urgent|asap|immédiat|tout de suite)\b", 5),
    (r"\b(prioritaire|important|critique)\b", 4),
    (r"\b(bientôt|vite|rapide)\b", 3),
    (r"\b(quand tu peux|pas pressé|tranquille)\b", 1),
]


def extract_entities(text: str) -> Dict[str, List[str]]:
    """
    Extract named entities using Spacy NER.
    Returns: {
        "people": ["Alice", "Bob"],
        "orgs": ["Acme Inc", "Google"],
        "projects": ["ProjetX", "ClientABC"],
        "locations": ["Paris", "Lyon"]
    }
    """
    if not nlp:
        return {}

    doc = nlp(text)
    entities = {
        "people": [],
        "orgs": [],
        "locations": [],
        "products": [],
        "events": [],
    }

    for ent in doc.ents:
        if ent.label_ == "PER":
            entities["people"].append(ent.text)
        elif ent.label_ == "ORG":
            entities["orgs"].append(ent.text)
        elif ent.label_ == "LOC":
            entities["locations"].append(ent.text)
        elif ent.label_ == "PRODUCT":
            entities["products"].append(ent.text)
        elif ent.label_ == "EVENT":
            entities["events"].append(ent.text)

    # Custom project pattern (CamelCase or with capitals)
    project_pattern = r"\b([A-Z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]*)+|Projet[A-Za-z0-9]+|Client[A-Za-z0-9]+)\b"
    projects = re.findall(project_pattern, text)
    entities["projects"].extend(projects)

    return entities


def extract_priority(text: str) -> Tuple[int, str]:
    """
    Extract priority level (1-5) and keywords.
    Returns: (priority_level, keyword_found)
    """
    text_lower = text.lower()

    # Check urgency patterns
    for pattern, score in URGENCY_PATTERNS:
        match = re.search(pattern, text_lower)
        if match:
            return score, match.group(1)

    # Default: medium priority
    return 2, "normal"


def extract_sentiment(text: str) -> Dict[str, float]:
    """
    Analyze sentiment using TextBlob.
    Returns: {
        "polarity": -1.0 to 1.0 (negative to positive),
        "subjectivity": 0.0 to 1.0 (objective to subjective),
        "emotion": "positive" | "negative" | "neutral"
    }
    """
    blob = TextBlob(text)
    polarity = blob.sentiment.polarity
    subjectivity = blob.sentiment.subjectivity

    if polarity > 0.1:
        emotion = "positive"
    elif polarity < -0.1:
        emotion = "negative"
    else:
        emotion = "neutral"

    return {
        "polarity": polarity,
        "subjectivity": subjectivity,
        "emotion": emotion,
    }


def extract_verb_object_pairs(text: str) -> List[Tuple[str, str]]:
    """
    Extract verb-object pairs using dependency parsing.
    Example: "Appelle Alice" → [("appelle", "Alice")]
    """
    if not nlp:
        return []

    doc = nlp(text)
    pairs = []

    for token in doc:
        if token.pos_ == "VERB":
            # Find direct object
            for child in token.children:
                if child.dep_ in ("obj", "dobj", "nsubj"):
                    pairs.append((token.text.lower(), child.text.lower()))

    return pairs


def extract_assignee_and_deadline(text: str) -> Dict:
    """
    Extract assignee (who does it) and deadline (when).
    Returns: {
        "assignee": "Alice",
        "deadline": datetime or None,
        "for_myself": bool
    }
    """
    from dateparser.search import search_dates

    # Simple patterns for assignee
    assignee_patterns = [
        r"à\s+([A-Za-z]+)",  # "à Alice"
        r"avec\s+([A-Za-z]+)",  # "avec Bob"
        r"(?:assigne|attribue)\s+(?:à|pour)\s+([A-Za-z]+)",  # "assigne à Alice"
    ]

    assignee = None
    for pattern in assignee_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            assignee = match.group(1)
            break

    # Check if it's for myself
    for_myself = any(
        w in text.lower() for w in ["je", "moi", "moi-même", "pour moi", "me"]
    )

    # Extract deadline using dateparser
    deadline = None
    try:
        found = search_dates(
            text,
            languages=["fr", "en"],
            settings={"PREFER_DATES_FROM": "future"},
        )
        if found:
            phrase, dt = max(found, key=lambda x: len(x[0]))
            deadline = dt
    except:
        pass

    return {
        "assignee": assignee,
        "deadline": deadline.isoformat() if deadline else None,
        "for_myself": for_myself,
    }


def extract_metadata(text: str) -> Dict:
    """
    Extract all metadata in one call.
    Returns comprehensive command metadata.
    """
    return {
        "entities": extract_entities(text),
        "priority": extract_priority(text),
        "sentiment": extract_sentiment(text),
        "verb_objects": extract_verb_object_pairs(text),
        "assignment": extract_assignee_and_deadline(text),
    }


# Test example
if __name__ == "__main__":
    test_commands = [
        "Créé une réunion avec Alice et Bob sur ProjetX demain 14h, c'est URGENT !",
        "Note: Appeler le client Acme à 10h demain pour discuter contrat",
        "Ajoute tâche: réviser rapport pour Paul avant vendredi, prioritaire",
    ]

    for cmd in test_commands:
        print(f"\n📝 Command: {cmd}")
        meta = extract_metadata(cmd)
        print(f"  Entities: {meta['entities']}")
        print(f"  Priority: {meta['priority']}")
        print(f"  Sentiment: {meta['sentiment']}")
        print(f"  Verb-Objects: {meta['verb_objects']}")
        print(f"  Assignment: {meta['assignment']}")
