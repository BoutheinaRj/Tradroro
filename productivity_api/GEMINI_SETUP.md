# 🚀 Phase Gemini LLM Understanding

## Configuration

### 1. Clé API Gemini

Obtenez votre clé API gratuitement :
1. Allez sur [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Cliquez sur "Créer une clé API"
3. Définissez la variable d'environnement :

**Windows (PowerShell):**
```powershell
$env:GEMINI_API_KEY = "votre-clé-ici"
```

**Windows (CMD):**
```cmd
set GEMINI_API_KEY=votre-clé-ici
```

**Linux/Mac:**
```bash
export GEMINI_API_KEY="votre-clé-ici"
```

Ou créez un fichier `.env` à la racine du projet :
```
GEMINI_API_KEY=sk-...
```

### 2. Installer les dépendances

```bash
pip install -r requirements.txt
```

## API Endpoints

### Compréhension Gemini

**`POST /api/understand`** - Comprendre une commande avec Gemini

```json
{
  "text": "crée une tâche pour faire les courses demain à 14h",
  "context": "tasks"
}
```

**Réponse:**
```json
{
  "input": "crée une tâche pour faire les courses demain à 14h",
  "context": "tasks",
  "understanding": {
    "intent": "create_task",
    "context": "tasks",
    "confidence": 0.95,
    "parameters": {
      "title": "faire les courses",
      "start_time": "2026-06-18T14:00:00"
    },
    "natural_response": "Je comprends que tu veux créer une tâche 'faire les courses' pour demain à 14h."
  },
  "phase": "comprehension_only"
}
```

### Status Gemini

**`GET /gemini/status`** - Vérifier la configuration

```json
{
  "configured": true,
  "model": "gemini-pro",
  "api_key_set": true,
  "available": true
}
```

### Compréhension en Lot

**`POST /api/understand-batch`** - Plusieurs commandes

```json
{
  "texts": ["crée tâche 1", "affiche les tâches", "focus 30 min"],
  "context": "tasks"
}
```

## Contextes Disponibles

1. **tasks** - Gestion des tâches
   - create_task, list_tasks, update_task, delete_task, search_tasks

2. **events** - Gestion du calendrier
   - schedule_event, list_events, cancel_event, reschedule_event

3. **focus** - Sessions de concentration
   - start_focus, stop_focus, set_duration

## Intentions Détectées

Gemini retourne des intentions structurées avec :
- **intent** : L'action à effectuer
- **context** : Le domaine (tasks, events, focus)
- **confidence** : Niveau de confiance (0.0 - 1.0)
- **parameters** : Paramètres extraits (titre, date, durée, etc.)
- **natural_response** : Confirmation en langage naturel

## Phase Actuelle

✅ **PHASE 1 : COMPRÉHENSION UNIQUEMENT**

- Gemini analyse les commandes naturelles
- Retourne les intentions et paramètres extraits
- **AUCUNE exécution d'action pour le moment**
- Prépare les données pour la phase d'exécution

## Utilisation depuis le Frontend

```typescript
// Appel à l'API de compréhension
const response = await fetch('/api/understand', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: "crée une tâche urgente",
    context: "tasks"
  })
});

const data = await response.json();
console.log(data.understanding.intent); // "create_task"
console.log(data.understanding.parameters); // { title: "tâche urgente" }
```

## Débogage

Pour voir les logs détaillés, lancez le serveur en mode debug :

```bash
uvicorn main:app --reload --log-level debug
```
