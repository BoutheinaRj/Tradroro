import re
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# ----- Base de données -----
DB_URL = "sqlite:///./productivity.db"
engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    status = Column(String, default="todo")
    created_at = Column(DateTime, default=datetime.now)

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    start_at = Column(DateTime, nullable=False)
    end_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

class FocusSession(Base):
    __tablename__ = "focus_sessions"
    id = Column(Integer, primary_key=True, index=True)
    minutes = Column(Integer, default=25)
    status = Column(String, default="running")
    started_at = Column(DateTime, default=datetime.now)
    ended_at = Column(DateTime, nullable=True)

Base.metadata.create_all(bind=engine)

# ----- App -----
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExecuteIn(BaseModel):
    text: str
    context: str = "tasks"

from nlp import parse_command

# ----- Helpers de sérialisation -----
def serialize_task(t: Task):
    return {
        "id": t.id,
        "title": t.title,
        "status": t.status,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }

def serialize_event(e: Event):
    return {
        "id": e.id,
        "title": e.title,
        "start_at": e.start_at.isoformat() if e.start_at else None,
        "end_at": e.end_at.isoformat() if e.end_at else None,
    }

def serialize_focus(s: FocusSession):
    return {
        "id": s.id,
        "minutes": s.minutes,
        "status": s.status,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "ended_at": s.ended_at.isoformat() if s.ended_at else None,
    }

# ----- Handlers -----
def handle_tasks(intent: str, params: dict, db):
    if intent == "list_tasks":
        tasks = db.query(Task).order_by(Task.id).all()
        if not tasks:
            return {"message": "Aucune tâche pour le moment."}
        lines = [f"#{t.id} {t.title} ({t.status})" for t in tasks]
        return {"message": "Tes tâches :\n" + "\n".join(lines), "data": [serialize_task(t) for t in tasks]}

    if intent == "get_task":
        task_id = params.get("id")
        if not task_id:
            return {"message": "ID de tâche manquant."}
        t = db.get(Task, task_id)
        if not t:
            return {"message": f"Tâche #{task_id} introuvable."}
        return {"message": f"#{t.id} {t.title} ({t.status})", "data": serialize_task(t)}

    if intent == "create_task":
        title = params.get("title", "").strip()
        if not title:
            return {"message": "Quel est le titre de la tâche ?"}
        t = Task(title=title)
        db.add(t)
        db.commit()
        db.refresh(t)
        return {"message": f"Tâche « {t.title} » ajoutée (#{t.id}).", "data": serialize_task(t)}

    if intent == "delete_task":
        task_id = params.get("id")
        if not task_id:
            return {"message": "Donne l'ID de la tâche à supprimer."}
        t = db.get(Task, task_id)
        if not t:
            return {"message": f"Tâche #{task_id} introuvable."}
        db.delete(t)
        db.commit()
        return {"message": f"Tâche #{task_id} supprimée."}

    if intent == "update_task":
        task_id = params.get("id")
        if not task_id:
            return {"message": "ID de tâche manquant."}
        t = db.get(Task, task_id)
        if not t:
            return {"message": f"Tâche #{task_id} introuvable."}
        status = params.get("status")
        if status:
            if status not in ["todo", "doing", "done"]:
                return {"message": "Statut invalide (todo, doing, done)."}
            t.status = status
            db.commit()
            return {"message": f"Statut de la tâche #{task_id} mis à jour : {status}.", "data": serialize_task(t)}
        title = params.get("title")
        if title:
            t.title = title.strip()
            db.commit()
            return {"message": f"Tâche #{task_id} renommée en « {title} ».", "data": serialize_task(t)}
        return {"message": "Que veux-tu modifier ? (titre ou statut)"}

    if intent == "need_task_id":
        return {"message": "Quel numéro de tâche ? (ex: supprime tâche 1)"}
    if intent == "need_task_title":
        return {"message": "Quel est le titre de la tâche à ajouter ?"}

    return {"message": "Je n'ai pas compris pour les tâches."}

def handle_events(intent: str, params: dict, db):
    if intent == "list_events":
        events = db.query(Event).order_by(Event.start_at).all()
        if not events:
            return {"message": "Aucun événement pour le moment."}
        lines = [f"#{e.id} {e.title} — {e.start_at.strftime('%d/%m %Hh%M')}" for e in events]
        return {"message": "Tes événements :\n" + "\n".join(lines), "data": [serialize_event(e) for e in events]}

    if intent == "create_event":
        title = params.get("title", "").strip()
        start_at_str = params.get("start_at")
        if not title:
            return {"message": "Quel est le titre de l'événement ?"}
        if not start_at_str:
            return {"message": "À quelle date/heure ? (ex: demain 10h)"}
        try:
            start = datetime.fromisoformat(start_at_str)
        except:
            return {"message": "Format de date invalide."}
        end_at_str = params.get("end_at")
        end = datetime.fromisoformat(end_at_str) if end_at_str else start + timedelta(hours=1)
        e = Event(title=title, start_at=start, end_at=end)
        db.add(e)
        db.commit()
        db.refresh(e)
        return {"message": f"« {e.title} » ajouté le {e.start_at.strftime('%d/%m/%Y à %Hh%M')}.", "data": serialize_event(e)}

    if intent == "delete_event":
        # 1) Priorité à l'ID si présent
        event_id = params.get("id")
        if event_id:
            e = db.get(Event, event_id)
            if not e:
                return {"message": f"Événement #{event_id} introuvable."}
            db.delete(e)
            db.commit()
            return {"message": f"Événement #{event_id} supprimé."}

        # 2) Sinon, essayer par date (start_at exact)
        start_at_str = params.get("start_at")
        if start_at_str:
            try:
                target_date = datetime.fromisoformat(start_at_str)
                # Rechercher un événement commençant à cette date (tolérance sur le jour)
                start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
                end_of_day = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                e = db.query(Event).filter(Event.start_at >= start_of_day, Event.start_at <= end_of_day).first()
                if not e:
                    return {"message": "Aucun événement trouvé à cette date."}
                db.delete(e)
                db.commit()
                return {"message": f"Événement « {e.title} » du {e.start_at.strftime('%d/%m/%Y %Hh%M')} supprimé."}
            except:
                return {"message": "Date invalide."}

        # 3) Sinon, essayer par titre (contient la chaîne)
        title = params.get("title")
        if title:
            e = db.query(Event).filter(Event.title.ilike(f"%{title}%")).first()
            if not e:
                return {"message": f"Aucun événement trouvé avec le titre « {title} »."}
            db.delete(e)
            db.commit()
            return {"message": f"Événement « {e.title} » supprimé."}

        # 4) Si rien n'a fonctionné, on demande un ID
        return {"message": "Quel numéro d'événement ? (ex: supprime événement 2) ou précisez le titre/date."}

    if intent == "need_event_id":
        return {"message": "Quel numéro d'événement ? (ex: supprime événement 2)"}
    if intent == "need_event_time":
        title = params.get("title", "Événement")
        return {"message": f"À quelle date/heure pour « {title} » ?"}

    return {"message": "Je n'ai pas compris pour le calendrier."}

def handle_focus(intent: str, params: dict, db):
    if intent == "start_focus":
        minutes = params.get("minutes", 25)
        try:
            minutes = int(minutes)
        except:
            minutes = 25
        if minutes <= 0 or minutes > 240:
            return {"message": "Durée invalide (1–240 minutes)."}
        s = FocusSession(minutes=minutes, status="running", started_at=datetime.now())
        db.add(s)
        db.commit()
        db.refresh(s)
        return {"message": f"Focus démarré pour {minutes} minutes.", "data": serialize_focus(s)}

    if intent == "stop_focus":
        s = db.query(FocusSession).filter(FocusSession.status == "running").first()
        if not s:
            return {"message": "Aucun focus en cours."}
        s.status = "stopped"
        s.ended_at = datetime.now()
        db.commit()
        db.refresh(s)
        return {"message": "Focus arrêté.", "data": serialize_focus(s)}

    if intent == "list_focus":
        sessions = db.query(FocusSession).order_by(FocusSession.id.desc()).all()
        if not sessions:
            return {"message": "Aucune session de focus."}
        lines = [f"#{s.id} {s.minutes} min ({s.status})" for s in sessions]
        return {"message": "Sessions :\n" + "\n".join(lines), "data": [serialize_focus(s) for s in sessions]}

    return {"message": "Je n'ai pas compris pour le focus."}

# ----- Point d'entrée -----
@app.post("/productivity/execute")
def execute(body: ExecuteIn):
    parsed = parse_command(body.text, body.context)
    intent = parsed.get("intent")
    params = parsed.get("params") or {}

    db = SessionLocal()
    try:
        ctx = body.context
        if ctx == "calendar" or intent in ["create_event", "list_events", "delete_event", "need_event_id", "need_event_time"]:
            return handle_events(intent, params, db)
        elif ctx == "focus" or intent in ["start_focus", "stop_focus", "list_focus"]:
            return handle_focus(intent, params, db)
        else:
            return handle_tasks(intent, params, db)
    finally:
        db.close()

@app.post("/api/execute")
def api_execute(body: ExecuteIn):
    return execute(body)

# ----- Routes GET -----
@app.get("/events")
def list_events():
    db = SessionLocal()
    try:
        return [serialize_event(e) for e in db.query(Event).order_by(Event.start_at).all()]
    finally:
        db.close()

@app.get("/tasks")
def list_tasks():
    db = SessionLocal()
    try:
        return [serialize_task(t) for t in db.query(Task).order_by(Task.id).all()]
    finally:
        db.close()

@app.get("/focus")
def list_focus():
    db = SessionLocal()
    try:
        return [serialize_focus(s) for s in db.query(FocusSession).order_by(FocusSession.id.desc()).all()]
    finally:
        db.close()

@app.get("/health")
def health():
    return {"status": "ok"}