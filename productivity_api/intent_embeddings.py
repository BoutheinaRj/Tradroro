from sentence_transformers import SentenceTransformer, util

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
_model = None
_cache = None

INTENTS = {
    # ----- TASKS -----
    "tasks.create": [
        "add a task", "create a task", "note this task", "remind me to",
        "ajoute une tâche", "crée une tâche", "note ça comme tâche", "je dois",
        "il faut que je", "j'ai besoin de",
        "je dois faire", "il faut préparer", "nouvelle tâche",
        "ajouter une tâche", "créer une tâche"
    ],
    "tasks.list": [
        "list tasks", "show my tasks", "what are my tasks",
        "liste mes tâches", "montre mes tâches", "affiche mes tâches",
        "voir mes tâches", "qu'est-ce que j'ai à faire",
        "tâches en cours", "mes todos"
    ],
    "tasks.delete": [
        "delete a task", "remove a task",
        "supprime une tâche", "enlève une tâche", "efface une tâche",
        "retire la tâche", "annule la tâche"
    ],
    "tasks.get": [
        "show task 1", "get task 1",
        "montre tâche 1", "donne tâche 1", "affiche tâche 1",
        "détails de la tâche 2", "voir tâche numéro 3"
    ],
    "tasks.update": [
        "rename task 1 to new title", "change task 2 to done",
        "update task 3 status", "mark task 4 as completed",
        "renomme tâche 1 en nouveau titre", "modifie tâche 2 en fait",
        "changer le nom de tâche 3", "mettre tâche 4 en done",
        "passer tâche 5 à faire", "marque tâche 6 comme terminée"
    ],

    # ----- CALENDAR -----
    "calendar.create": [
        "add an event", "schedule a meeting", "create an appointment",
        "ajoute un événement", "planifie une réunion", "crée un rendez-vous",
        "ajouter un meeting", "programmer un appel", "book a call",
        "puts a meet tomorrow at 2h", "set up a meeting"
    ],
    "calendar.list": [
        "list events", "show my calendar", "today meetings",
        "liste mes événements", "montre mon calendrier", "mes rendez-vous",
        "voir l'agenda", "qu'est-ce que j'ai de prévu"
    ],
    "calendar.delete": [
        "delete an event", "remove an event",
        "supprime l'événement", "enlève l'événement",
        "annule la réunion", "efface le rendez-vous"
    ],

    # ----- FOCUS -----
    "focus.start": [
        "start focus", "start a pomodoro", "focus for 25 minutes",
        "démarre focus", "lance un pomodoro", "focus 25 minutes",
        "concentration 45 min", "deep work 30 min"
    ],
    "focus.stop": [
        "stop focus", "end focus",
        "arrête focus", "stop le focus", "termine le focus",
        "pause focus"
    ],
    "focus.list": [
        "focus history", "list focus sessions",
        "historique focus", "liste des focus",
        "mes sessions de concentration"
    ],
}

def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model

def _precompute():
    global _cache
    if _cache is not None:
        return
    model = get_model()
    _cache = {k: model.encode(v, convert_to_tensor=True) for k, v in INTENTS.items()}

def predict_intent(text: str):
    _precompute()
    model = get_model()
    text = (text or "").strip()
    if not text:
        return ("unknown", 0.0)

    q = model.encode(text, convert_to_tensor=True)

    best_i, best_s = "unknown", -1.0
    for intent, emb in _cache.items():
        score = float(util.cos_sim(q, emb)[0].max())
        if score > best_s:
            best_s = score
            best_i = intent

    return best_i, best_s