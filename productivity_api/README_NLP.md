# 🧠 Advanced NLP System for Tradrly Bot

## Overview

Ce système NLP avancé analyse les commandes utilisateur en langage naturel pour en extraire les intentions, entités et priorités professionnelles, **sans utiliser d'LLM**.

## Architecture

### Components

```
┌─────────────────────────────────────────────────┐
│  CommandBar (React Frontend)                    │
└────────────────┬────────────────────────────────┘
                 │ POST /api/parse-intent (Express)
┌────────────────▼────────────────────────────────┐
│  Express Server (Node.js)                       │
│  - /api/parse-intent → routes to FastAPI        │
└────────────────┬────────────────────────────────┘
                 │ Calls /productivity/analyze
┌────────────────▼────────────────────────────────┐
│  FastAPI Backend (Python)                       │
│  - Uses spacy_extractor.parse_command_advanced()│
│  - Returns full metadata with NLP features      │
└─────────────────────────────────────────────────┘
```

### NLP Modules

#### 1. **spacy_extractor.py** (Main Engine)
Uses Spacy for sophisticated text analysis:

- **NER (Named Entity Recognition)**: Extracts people, organizations, locations
- **POS Tagging**: Identifies verbs, nouns, adjectives
- **Dependency Parsing**: Understands sentence structure
- **Priority Detection**: Detects urgency keywords (URGENT, ASAP, etc.)
- **Participant Extraction**: Finds who's involved in the task

**Key Functions:**
```python
parse_command_advanced(text, context="tasks")
# Returns:
{
  "intent": "create_task",        # detected action
  "title": "Review proposal",      # cleaned title
  "priority": 5,                   # 1-5 scale
  "priority_label": "critical",    # descriptive label
  "verb": "review",                # main verb
  "entities": {
    "people": ["Alice"],           # extracted names
    "organizations": ["Acme"],
    "projects": ["ProjetX"]
  },
  "participants": ["Alice"],       # involved people
  "start_at": "2026-06-18T14:00",  # datetime
  "id": 5                          # entity ID
}
```

#### 2. **nlp_advanced.py** (Advanced Features)
TextBlob + NLTK integration for deeper analysis:

- **Sentiment Analysis**: Detect positive/negative tone
- **Emotion Detection**: Determines emotional context
- **Verb-Object Pairs**: Extracts action-target relationships
- **Assignee Detection**: Finds who does what

**Key Functions:**
```python
extract_metadata(text)
# Returns all analyses in one call:
{
  "entities": {...},               # NER results
  "priority": (5, "urgent"),       # score + keyword
  "sentiment": {
    "polarity": 0.8,               # -1 to 1
    "subjectivity": 0.6,           # 0 to 1
    "emotion": "positive"
  },
  "verb_objects": [("review", "proposal")],
  "assignment": {
    "assignee": "Alice",
    "deadline": "2026-06-18T14:00",
    "for_myself": False
  }
}
```

## Features by Priority

### ✅ Level 1: Basic Intent Detection
```
"crée une tâche" → intent: tasks.create
"supprime l'événement #3" → intent: calendar.delete
"focus 25 minutes" → intent: focus.start
```

### ✅ Level 2: Entity Extraction (Spacy NER)
```
"Réunion avec Alice et Bob sur ProjetX"
→ people: [Alice, Bob]
→ projects: [ProjetX]
```

### ✅ Level 3: Priority & Urgency
```
"C'est URGENT" → priority: 5 (critical)
"Bientôt, pas pressé" → priority: 1 (low)
```

### ✅ Level 4: Sentiment & Emotion
```
"Je veux ABSOLUMENT finir ce truc" 
→ polarity: 0.7 (positive determination)
→ emotion: "positive"
```

### ✅ Level 5: Assignment & Dates
```
"Ajoute pour Paul avant vendredi"
→ assignee: "Paul"
→ deadline: "2026-06-20T17:00"
```

## Installation

### 1. Install Dependencies

```bash
cd productivity_api
pip install -r requirements.txt
python setup_nlp.py
```

This downloads:
- ✅ Spacy French model (`fr_core_news_md`)
- ✅ NLTK data (tokenizers, stopwords)
- ✅ TextBlob + sentiment corpus

### 2. Start the Services

**Terminal 1: FastAPI**
```bash
cd productivity_api
uvicorn main:app --reload --port 8000
```

**Terminal 2: Express**
```bash
npm run server
```

**Terminal 3: React + Electron**
```bash
npm run electron:dev
```

## Testing

### Run NLP Tests

```bash
cd productivity_api
python test_nlp.py
```

**Expected Output:**
```
✅ SPACY EXTRACTOR TESTS
Input: Crée une réunion avec Alice demain 14h, URGENT !
  ✓ Intent: create_event
  ✓ Title: réunion
  ✓ Priority: 5 (critical)
  ✓ Entities: {'people': ['Alice'], ...}
  ✓ Participants: ['Alice']
```

### Test with CommandBar UI

Type in the CommandBar on home screen:
- "ajoute tâche appeler Jean demain 10h, urgent"
- "crée réunion avec Bob sur ProjetX mardi 14h"
- "supprime tâche #3"
- "focus 45 minutes"

## Performance Notes

### Latency (per command)
- **Spacy NER**: ~100-150ms (first load: ~500ms)
- **Sentiment Analysis**: ~50ms
- **Total E2E**: ~200-250ms (acceptable for desk assistant)

### Memory
- Spacy model: ~150MB RAM
- NLTK data: ~50MB RAM
- **Total**: ~200MB (one-time load)

### Optimization Tips
1. Model loads once on FastAPI startup
2. Use `parse_command_advanced()` directly (no network round-trip)
3. Cache entity extraction for frequent names

## Roadmap

### Phase 2 (Optional Enhancements)
- [ ] Custom named entity recognizer trained on project names
- [ ] Sentiment-based task prioritization
- [ ] Dialogue context tracking (multi-turn)
- [ ] Voice input integration (speech-to-text)

### Phase 3 (Future)
- [ ] Multi-language support (French + English NER fusion)
- [ ] Task auto-categorization using TF-IDF
- [ ] Automatic priority learning from user behavior

## Troubleshooting

### "Spacy model not found"
```bash
python -m spacy download fr_core_news_md
```

### "NLTK data missing"
```python
import nltk
nltk.download('punkt')
nltk.download('stopwords')
```

### Slow first request
Normal - Spacy model loads on first request. Subsequent requests: ~200ms.

## Language Support

Currently optimized for **French + English**. Spacy model used:
- `fr_core_news_md`: French NER, POS tagging, dependencies

For other languages, install alternative models:
```bash
# English
python -m spacy download en_core_web_md

# Spanish
python -m spacy download es_core_news_md
```

## Integration with Existing Code

The new NLP is **fully backward compatible**. It enhances `parse_command()` which is used by:

```python
# Old code still works:
from spacy_extractor import parse_command
result = parse_command("crée une tâche")

# New advanced features:
from spacy_extractor import parse_command_advanced
advanced = parse_command_advanced("crée une tâche")
print(advanced["priority"])  # ← New!
print(advanced["entities"])  # ← New!
```

## References

- **Spacy**: https://spacy.io/
- **NLTK**: https://www.nltk.org/
- **TextBlob**: https://textblob.readthedocs.io/
- **Dependency Parsing**: https://spacy.io/usage/linguistic-features#dependency-parse

---

**Stage Goal**: NLP-based productivity assistant without LLMs ✅
