# TasksView - Stack Technique Détaillée

## 🎯 Architecture Générale

```
Utilisateur (UI React)
       ↓
    Saisie texte
       ↓
  analyzeText()
       ↓
  Express API (port 3001)
       ↓
  FastAPI (port 8000)
       ↓
  Spacy NLP Engine
       ↓
  Résultat JSON + metadata
       ↓
  Affichage intelligent
```

---

## 💻 Technologie Frontend (React + TypeScript)

### 1. **React Hooks utilisés**

```typescript
// État pour les tâches
const [tasks, setTasks] = useState<Task[]>([])

// État pour l'input utilisateur
const [input, setInput] = useState("")

// État pour l'analyse NLP en temps réel
const [nlpAnalysis, setNlpAnalysis] = useState<NLPIntent | null>(null)

// État pour l'historique
const [log, setLog] = useState<string[]>([])

// État pour les notifications toast
const [toast, setToast] = useState("")

// Référence pour scroll auto
const logRef = useRef<HTMLDivElement>(null)
```

### 2. **Calcul des statistiques (useMemo)**

```typescript
const stats = useMemo(() => {
  const total = tasks.length
  const done = tasks.filter(t => t.status === "done").length
  const todo = tasks.filter(t => t.status === "todo").length
  const byPriority = {
    urgent: tasks.filter(t => t.priority === 5).length,
    important: tasks.filter(t => t.priority === 4).length,
    normal: tasks.filter(t => t.priority === 3).length,
  }
  return { total, done, todo, byPriority }
}, [tasks])
```

**Avantage** : Recalcule que si `tasks` change (optimisation performance)

### 3. **Types TypeScript définissant la structure**

```typescript
type NLPIntent = {
  intent: string              // "create_task", "create_event", etc.
  title: string              // Titre auto-extrait
  verb: string               // "créer", "ajouter", etc.
  object: string             // "tâche", "réunion", etc.
  priority: number           // 1-5 score
  priority_label: string     // "URGENT", "NORMAL", etc.
  entities: {
    people?: string[]        // ["Alice", "Bob"]
    dates?: string[]         // ["demain", "vendredi"]
    times?: string[]         // ["14h", "10h30"]
  }
  start_at?: string         // ISO date string
}

type Task = {
  id: number
  title: string
  status: string             // "todo" ou "done"
  priority: number           // 1-5
  priority_label: string
  assignee?: string          // Personne assignée
  deadline?: string          // Date limite
  description?: string       // Texte original
  created_at?: string
}
```

---

## 🔗 API Routes Utilisées

### Route 1 : `/api/parse-intent` (Express Node)
```javascript
// Appel côté React
const r = await fetch(`http://localhost:3001/api/parse-intent`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text: userInput })
})
```

**Rôle** : Route Express qui forward vers FastAPI

### Route 2 : `/productivity/analyze` (FastAPI Python)
```python
# Backend FastAPI
@app.post("/productivity/analyze")
async def analyze_text(request: dict):
    text = request.get("text", "")
    
    # Appelle le moteur NLP Spacy
    result = parse_command_advanced(text, context={})
    
    return {
        "intent": result.get("intent"),
        "title": result.get("title"),
        "priority": result.get("priority"),
        "priority_label": result.get("priority_label"),
        "entities": result.get("entities"),
        "start_at": result.get("start_at"),
        ...
    }
```

---

## 🧠 NLP Engine (Spacy + TextBlob)

### Fichier : `productivity_api/spacy_extractor.py`

**Fonction principale** : `parse_command_advanced(text, context)`

```python
def parse_command_advanced(text, context):
    # 1. NER (Named Entity Recognition) - Extraction d'entités
    entities = extract_entities_ner(text)
    # → ["Alice", "vendredi", "14h"]
    
    # 2. POS Tagging - Identification des verbes
    verb = extract_main_verb(text)
    # → "créer", "ajouter", "appeler"
    
    # 3. Dépendances syntaxiques - Objet direct
    obj = extract_direct_object(text)
    # → "réunion", "tâche", "appel"
    
    # 4. Priority Detection - Scoring urgence
    priority, label = extract_priority_level(text)
    # → (5, "URGENT") ou (3, "NORMAL")
    
    # 5. Date Parsing - Extraction deadlines
    start_at = parse_date_advanced(text)
    # → "2026-06-18T14:00:00"
    
    # 6. Intent Detection - Intention utilisateur
    intent = detect_intent(text)
    # → "create_task" ou "create_event"
    
    # 7. Participants - Personnes impliquées
    participants = extract_participants(text)
    # → ["Alice", "Bob"]
    
    return {
        "intent": intent,
        "title": obj or "Tâche sans titre",
        "verb": verb,
        "object": obj,
        "priority": priority,
        "priority_label": label,
        "entities": {
            "people": participants,
            "dates": [...],
            "times": [...]
        },
        "start_at": start_at
    }
```

### 4.1 NER (Named Entity Recognition)

```python
import spacy
nlp = spacy.load("fr_core_news_md")

def extract_entities_ner(text):
    doc = nlp(text)
    entities = {
        "people": [],
        "orgs": [],
        "locations": [],
        "projects": []
    }
    
    for ent in doc.ents:
        if ent.label_ == "PER":
            entities["people"].append(ent.text)
        elif ent.label_ == "ORG":
            entities["orgs"].append(ent.text)
        elif ent.label_ == "LOC":
            entities["locations"].append(ent.text)
    
    return entities
```

**Exemple** :
```
"Réunion avec Alice et Bob demain à 14h"
    ↓
people: ["Alice", "Bob"]
dates: ["demain"]
times: ["14h"]
```

### 4.2 POS Tagging (Part-of-Speech)

```python
def extract_main_verb(text):
    doc = nlp(text)
    for token in doc:
        if token.pos_ == "VERB":
            return token.lemma_
    return "faire"  # défaut

# Exemple : "Crée réunion" → "créer"
```

### 4.3 Priority Detection

```python
def extract_priority_level(text):
    text_lower = text.lower()
    
    urgency_keywords = {
        5: ["urgent", "asap", "immédiat", "prioritaire"],
        4: ["important", "crucial", "critical"],
        3: ["normal", "standard"],
        2: ["faible", "low", "optionnel"],
        1: ["très faible", "backlog"]
    }
    
    for level, keywords in urgency_keywords.items():
        if any(kw in text_lower for kw in keywords):
            return level, ["TRÈS FAIBLE", "FAIBLE", "NORMAL", "IMPORTANT", "URGENT"][level-1]
    
    return 3, "NORMAL"  # Default
```

**Exemple** :
```
"Appeler Alice demain 14h URGENT"
    ↓
priority: 5
priority_label: "URGENT"
```

### 4.4 Intent Detection

```python
def detect_intent(text):
    text_lower = text.lower()
    
    patterns = {
        "create_task": ["créer", "ajouter", "tâche", "faire"],
        "create_event": ["réunion", "événement", "rendez-vous"],
        "start_focus": ["focus", "concentration", "timer"],
        "delete_task": ["supprimer", "effacer", "delete"],
    }
    
    for intent, keywords in patterns.items():
        if any(kw in text_lower for kw in keywords):
            return intent
    
    return "create_task"  # Default
```

### 4.5 Date Parsing

```python
from dateparser import parse as parse_date

def parse_date_advanced(text):
    # Utilise dateparser pour parser "demain", "vendredi", etc.
    parsed = parse_date(text, settings={
        'PREFER_DATES_FROM': 'future',
        'LANGUAGE': 'fr'
    })
    
    if parsed:
        return parsed.isoformat()
    return None

# Exemple : "demain 14h" → "2026-06-18T14:00:00"
```

---

## 🎨 Rendu Frontend - Composants Intelligents

### 1. Affichage de l'analyse NLP en temps réel

```typescript
{nlpAnalysis && (
  <div style={styles.nlpBox}>
    {/* Intention */}
    <div style={styles.nlpRow}>
      <span style={styles.label}>Intent:</span>
      <span style={intentBadgeStyle(nlpAnalysis.intent)}>
        {nlpAnalysis.intent}
      </span>
    </div>
    
    {/* Priorité avec couleur */}
    <div style={styles.nlpRow}>
      <span style={styles.label}>Priorité:</span>
      <span style={priorityBadgeStyle(nlpAnalysis.priority)}>
        {nlpAnalysis.priority_label}
      </span>
    </div>
    
    {/* Participants */}
    {nlpAnalysis.entities.people?.length > 0 && (
      <div style={styles.nlpRow}>
        <span style={styles.label}>Avec:</span>
        <span>{nlpAnalysis.entities.people.join(", ")}</span>
      </div>
    )}
    
    {/* Deadline */}
    {nlpAnalysis.start_at && (
      <div style={styles.nlpRow}>
        <span style={styles.label}>Deadline:</span>
        <span>{new Date(nlpAnalysis.start_at).toLocaleDateString("fr-FR")}</span>
      </div>
    )}
  </div>
)}
```

### 2. Styling Dynamique par Priorité

```typescript
function priorityBadgeStyle(priority: number): React.CSSProperties {
  const colors: Record<number, string> = {
    5: "#ef4444",  // 🔴 URGENT - Rouge
    4: "#f97316",  // 🟠 IMPORTANT - Orange
    3: "#eab308",  // 🟡 NORMAL - Jaune
    2: "#06b6d4",  // 🔵 FAIBLE - Bleu
    1: "#6b7280",  // ⚪ TRÈS FAIBLE - Gris
  }
  
  const color = colors[priority] || "#94a3b8"
  
  return {
    display: "inline-block",
    background: `${color}1a`,        // Fond transparent
    border: `1px solid ${color}`,
    color: color,
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 600,
  }
}
```

### 3. Création de Tâche avec Métadonnées

```typescript
async function addTask() {
  if (!input.trim()) return

  // Si pas d'analyse encore, l'effectuer d'abord
  let analysis = nlpAnalysis
  if (!analysis) {
    await analyzeText(input.trim())
    return
  }

  // Créer tâche avec TOUTES les métadonnées extraites
  const newTask: Task = {
    id: Date.now(),
    title: analysis.title || input.trim(),
    status: "todo",
    priority: analysis.priority || 3,
    priority_label: analysis.priority_label || "NORMAL",
    assignee: analysis.entities.people?.[0],  // 👤 Assigné
    deadline: analysis.start_at,               // 📅 Deadline
    description: input.trim(),
  }

  // Ajouter à la liste
  setTasks([...tasks, newTask])
  setInput("")
  setNlpAnalysis(null)
  
  // Log pour l'historique
  setLog((l) => [
    ...l,
    `✅ Tâche créée: "${newTask.title}" [${newTask.priority_label}]`,
  ])
}
```

---

## 📊 Flux Complet d'une Commande

```
User input: "Appeler Alice demain 14h URGENT"
    ↓
onChange() → analyzeText()
    ↓
POST http://localhost:3001/api/parse-intent
    ↓
Express route:
  ├─ GET request
  ├─ Forward to FastAPI
  └─ POST http://localhost:8000/productivity/analyze
    ↓
FastAPI Backend:
  ├─ receive: { text: "Appeler Alice demain 14h URGENT" }
  ├─ call: parse_command_advanced()
  └─ Spacy processing:
    ├─ NER: Extract "Alice" (person), "demain" (date), "14h" (time)
    ├─ POS: Extract verb "appeler"
    ├─ Priority: Find "URGENT" → priority=5
    ├─ Intent: Detect "create_task"
    └─ Date: Parse "demain 14h" → 2026-06-18T14:00:00
    ↓
Response JSON:
{
  "intent": "create_task",
  "title": "Appeler Alice",
  "verb": "appeler",
  "object": "Alice",
  "priority": 5,
  "priority_label": "URGENT",
  "entities": {
    "people": ["Alice"],
    "dates": ["demain"],
    "times": ["14h"]
  },
  "start_at": "2026-06-18T14:00:00"
}
    ↓
React Frontend:
  ├─ setNlpAnalysis(data)
  ├─ Affiche preview avec couleurs
  └─ Await for user click "Ajouter"
    ↓
On click "Ajouter":
  ├─ Create Task with metadata
  ├─ Add to tasks list
  ├─ Add to log history
  ├─ Show toast notification
  └─ Clear input
    ↓
UI Update:
  ├─ Affiche tâche dans la liste
  ├─ Couleur priorité: 🔴 URGENT
  ├─ Meta: "👤 Alice" + "📅 18 juin 2026"
  └─ Stats: "Urgent: 1" (updated)
```

---

## 🔄 Analyse en Temps Réel

```typescript
onChange={(e) => {
  setInput(e.target.value)
  analyzeText(e.target.value)  // 🔥 Analyse immédiate
}}
```

**Avantage** : Utilisateur voit l'intention, priorité, participants EN TEMPS RÉEL avant de soumettre

---

## 📈 Performance Optimisations

| Optimisation | Implémentation |
|---|---|
| **Memoization** | `useMemo` pour stats (recalc seulement si tasks change) |
| **Refs** | `useRef` pour scroll auto du log |
| **Async** | Fetch asynchrone (ne bloque pas UI) |
| **Try-catch** | Gestion erreurs API silencieuse |
| **Local state** | Tasks en état React (pas de requête BE constant) |

---

## 📝 Résumé des Technologies

| Couche | Technologie | Rôle |
|---|---|---|
| **UI Input** | React + TypeScript | Capture et affichage temps réel |
| **API Frontend** | Fetch API | Appel `/api/parse-intent` |
| **Router** | Express.js | Forward vers FastAPI |
| **NLP Processing** | Spacy (Python) | NER, POS, dépendances, intent |
| **Priority** | Pattern matching | Keywords urgence (URGENT, IMPORTANT) |
| **Dates** | dateparser | Parse "demain", "vendredi", etc. |
| **Participants** | Spacy NER | Extraction noms propres |
| **Styling** | React inline styles | Code couleur dynamique par priorité |
| **State** | React Hooks | useState, useMemo, useRef |

---

## 🚀 Exemple d'Utilisation

```bash
# Utilisateur tape:
"Finir dashboard IMPORTANT avec Sarah vendredi"

# Analyse extraite:
Intent: create_task
Title: "Finir dashboard"
Priority: 4 (IMPORTANT) → Couleur Orange 🟠
Assignee: Sarah
Deadline: Vendredi 21 juin 2026

# Tâche créée avec toutes les métadonnées
Task {
  id: 1718641234567
  title: "Finir dashboard"
  status: "todo"
  priority: 4
  priority_label: "IMPORTANT"
  assignee: "Sarah"
  deadline: "2026-06-20T..."
  description: "Finir dashboard IMPORTANT avec Sarah vendredi"
}
```

---

## 💡 Points Clés

✅ **Tout en temps réel** - Analyse immédiate, pas d'attente
✅ **Métadonnées riches** - Priorité, participants, dates extraites auto
✅ **Interface intelligente** - Couleurs, emojis, preview avant création
✅ **Architecture modulaire** - Frontend (React) + Backend (FastAPI/Spacy)
✅ **Zéro requête répétitive** - Une seule analyse par entrée
