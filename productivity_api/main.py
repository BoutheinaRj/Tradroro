import re
import json
from datetime import datetime, timedelta
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
    status = Column(String, default="todo")   # todo | in_progress | done
    priority = Column(Integer, default=3)     # 1=low 2=minor 3=normal 4=important 5=urgent
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
class UTF8Response(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(content, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")

app = FastAPI(default_response_class=UTF8Response)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExecuteIn(BaseModel):
    text: str
    context: str = "tasks"
    session_id: str = ""

from nlp import parse_command
from gemini_understanding import understand_command, get_gemini_status, clear_session
from nova_companion import chat_with_nova
from desktop_control import execute_desktop_command

# ----- Helpers de sérialisation -----
_PRIORITY_LABELS = {1: "low", 2: "minor", 3: "normal", 4: "important", 5: "urgent"}

def serialize_task(t: Task):
    p = t.priority if t.priority is not None else 3
    return {
        "id": t.id,
        "title": t.title,
        "status": t.status,
        "priority": p,
        "priority_label": _PRIORITY_LABELS.get(p, "normal"),
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

@app.post("/productivity/analyze")
def analyze_text(body: ExecuteIn):
    """Analyze text and return detected intent with advanced NLP features"""
    from spacy_extractor import parse_command_advanced
    
    parsed = parse_command_advanced(body.text, body.context)
    intent_name = parsed.get("intent")
    
    # Map to UI-friendly intent names
    category_map = {
        "list_tasks": "tasks.list",
        "create_task": "tasks.create",
        "delete_task": "tasks.delete",
        "get_task": "tasks.get",
        "update_task": "tasks.update",
        "list_events": "calendar.list",
        "create_event": "calendar.create",
        "delete_event": "calendar.delete",
        "start_focus": "focus.start",
        "stop_focus": "focus.stop",
        "list_focus": "focus.list",
        "unknown": "unknown",
    }
    
    intent_friendly = category_map.get(intent_name, "unknown")
    
    return {
        "intent": intent_friendly,
        "params": {
            "title": parsed.get("title"),
            "priority": parsed.get("priority"),
            "priority_label": parsed.get("priority_label"),
            "start_at": parsed.get("start_at"),
            "end_at": parsed.get("end_at"),
            "participants": parsed.get("participants", []),
            "entities": parsed.get("entities", {}),
        },
        "confidence": 0.85 if intent_name != "unknown" else 0.0,
        "context": body.context,
        "metadata": {
            "verb": parsed.get("verb"),
            "object": parsed.get("object"),
        }
    }

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

# ----- Endpoints Gemini LLM Understanding -----
@app.post("/api/understand")
def understand(body: ExecuteIn):
    sid = body.session_id or None
    result = understand_command(body.text, body.context, session_id=sid)
    return {
        "input": body.text,
        "context": body.context,
        "understanding": result,
        "session_id": result.get("_session_id", ""),
        "phase": "comprehension_only"
    }

@app.post("/api/clear-session")
def clear_session_endpoint(body: ExecuteIn):
    ok = clear_session(body.session_id)
    return {"cleared": ok}


# ── /api/chat : Comprendre + Exécuter automatiquement ──────────────────────
def _execute_from_gemini(intent: str, params: dict, db) -> dict:
    """Exécute l'action correspondant à l'intent Gemini."""

    # ── TÂCHES ──
    if intent == "create_task":
        title = (params.get("title") or "").strip()
        if not title:
            return {"executed": False, "message": "What is the task title?"}
        priority_raw = params.get("priority") or "normal"
        _priority_map = {"urgent": 5, "critical": 5, "high": 5, "important": 4, "normal": 3, "medium": 3, "minor": 2, "low": 1}
        if isinstance(priority_raw, str):
            priority_int = _priority_map.get(priority_raw.lower().strip(), 3)
        else:
            try: priority_int = max(1, min(5, int(priority_raw)))
            except Exception: priority_int = 3
        t = Task(title=title, status="todo", priority=priority_int)
        db.add(t); db.commit(); db.refresh(t)
        return {"executed": True, "action": "create_task",
                "message": f"✅ Task « {t.title} » created (#{t.id})", "data": serialize_task(t)}

    if intent == "list_tasks":
        query = db.query(Task)
        filter_status   = params.get("filter_status")
        filter_priority = params.get("filter_priority")
        _pmap = {"urgent": 5, "important": 4, "normal": 3, "minor": 2, "low": 1}
        if filter_status:
            query = query.filter(Task.status == filter_status)
        if filter_priority:
            pval = _pmap.get(filter_priority.lower(), None)
            if pval:
                query = query.filter(Task.priority == pval)
        tasks = query.order_by(Task.id).all()
        if not tasks:
            label = f" ({filter_status or filter_priority})" if (filter_status or filter_priority) else ""
            return {"executed": True, "action": "list_tasks", "message": f"No tasks{label}.", "data": []}
        return {"executed": True, "action": "list_tasks",
                "message": f"{len(tasks)} task(s) found", "data": [serialize_task(t) for t in tasks]}

    if intent == "update_task":
        task_id = params.get("id") or params.get("task_id")
        title = params.get("title")
        new_title = params.get("new_title")
        status = params.get("status")
        priority = params.get("priority")
        all_flag = params.get("all") in (True, "true", 1, "1", "oui", "yes")
        
        # Mettre à jour TOUTES les tâches
        if all_flag:
            tasks = db.query(Task).all()
            if not tasks:
                return {"executed": False, "message": "No task to update."}
            for t in tasks:
                if status: t.status = status
            db.commit()
            count = len(tasks)
            return {"executed": True, "action": "update_task",
                    "message": f"✏️ {count} task(s) updated.", "data": [serialize_task(t) for t in tasks]}
        
        # Chercher la tâche par ID d'abord, sinon par titre
        t = None
        if task_id:
            try:
                t = db.get(Task, int(task_id))
            except Exception:
                pass
        if not t and title:
            # Chercher par titre (ancien nom)
            t = db.query(Task).filter(Task.title.ilike(f"%{title}%")).first()
        
        if not t:
            return {"executed": False, "message": "No matching task found to update."}
        
        # Appliquer les mises à jour
        changed = False
        if new_title:
            t.title = new_title.strip(); changed = True
        if status:
            t.status = status; changed = True
        if priority is not None:
            # Convert string label to int: "urgent"->5, "important"->4, "normal"->3, "minor"->2, "low"->1
            _priority_map = {
                "urgent": 5, "critical": 5, "high": 5,
                "important": 4,
                "normal": 3, "medium": 3,
                "minor": 2, "low": 1,
            }
            if isinstance(priority, str):
                priority = _priority_map.get(priority.lower().strip(), 3)
            try:
                priority = int(priority)
                if priority < 1 or priority > 5:
                    priority = 3
            except Exception:
                priority = 3
            t.priority = priority; changed = True
        
        if not changed:
            return {"executed": False, "message": "Nothing to change. Specify a new title or status."}
        
        db.commit(); db.refresh(t)
        return {"executed": True, "action": "update_task",
                "message": f"✏️ Task « {t.title} » updated.", "data": serialize_task(t)}

    if intent == "delete_task":
        task_id = params.get("id") or params.get("task_id")
        ids_list = params.get("ids")  # Support pour plusieurs IDs [5, 7]
        title = params.get("title")
        
        # Support pour suppression MULTIPLE (ids = [5, 7])
        if ids_list:
            if isinstance(ids_list, (list, tuple)):
                deleted_ids = []
                not_found = []
                for tid in ids_list:
                    try:
                        task_id_int = int(tid)
                        t = db.get(Task, task_id_int)
                        if t:
                            db.delete(t)
                            deleted_ids.append(task_id_int)
                        else:
                            not_found.append(task_id_int)
                    except Exception:
                        not_found.append(tid)
                db.commit()
                msg = f"🗑️ {len(deleted_ids)} task(s) deleted"
                if not_found:
                    msg += f" ({len(not_found)} not found: #{', #'.join(map(str, not_found))})"
                return {"executed": bool(deleted_ids), "action": "delete_task", "message": msg}
        
        # Suppression SIMPLE (un seul ID)
        if task_id:
            try:
                t = db.get(Task, int(task_id))
                if t:
                    db.delete(t); db.commit()
                    return {"executed": True, "action": "delete_task", "message": f"🗑️ Task #{task_id} deleted."}
                else:
                    return {"executed": False, "message": f"Task #{task_id} not found."}
            except Exception:
                return {"executed": False, "message": f"Invalid task id: {task_id}"}
        
        # Chercher par titre si fourni
        if title:
            t = db.query(Task).filter(Task.title.ilike(f"%{title}%")).first()
            if t:
                db.delete(t); db.commit()
                return {"executed": True, "action": "delete_task", "message": f"🗑️ Task « {t.title} » deleted."}
            else:
                return {"executed": False, "message": f"No task found with title « {title} »."}
        
        return {"executed": False, "message": "Which task number or title to delete?"}

    # ── ÉVÉNEMENTS ──
    if intent == "schedule_event":
        title      = (params.get("title") or "").strip()
        start_str  = params.get("start_time") or params.get("start_at")
        due_str    = params.get("due_date")
        
        if not title:
            return {"executed": False, "message": "What is the event title?"}
        
        # Strategy: start_time takes priority (specific time), then due_date (deadline = end-of-day default)
        if not start_str and not due_str:
            return {"executed": False, "message": f"What date/time for « {title} »? (e.g., 'tomorrow 3pm' or 'due friday')"}
        
        # Parse start_time or due_date
        if start_str:
            try:
                start = datetime.fromisoformat(start_str)
            except Exception:
                return {"executed": False, "message": "Invalid date/time format."}
            msg_time = f"at {start.strftime('%Hh%M')}"
        elif due_str:
            # "due tomorrow" = deadline set for end-of-day (17:00) unless specified otherwise
            try:
                due_date = datetime.fromisoformat(due_str)
                # Default to 17:00 (5 PM) for "due" events, can be overridden by user later
                start = due_date.replace(hour=17, minute=0, second=0, microsecond=0)
            except Exception:
                return {"executed": False, "message": "Invalid date format for due_date."}
            msg_time = f"due {due_date.strftime('%d/%m')} (17:00)"
        
        # Parse end_time
        end_str = params.get("end_time") or params.get("end_at")
        end = datetime.fromisoformat(end_str) if end_str else start + timedelta(hours=1)
        
        # Create event
        e = Event(title=title, start_at=start, end_at=end)
        db.add(e); db.commit(); db.refresh(e)
        return {"executed": True, "action": "schedule_event",
                "message": f"📅 « {e.title} » scheduled on {e.start_at.strftime('%d/%m')} {msg_time}",
                "data": serialize_event(e)}

    if intent == "list_events":
        query = db.query(Event)
        filter_range = params.get("filter_range")
        filter_date  = params.get("filter_date")
        now = datetime.now()
        if filter_range == "today":
            day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end   = day_start + timedelta(days=1)
            query = query.filter(Event.start_at >= day_start, Event.start_at < day_end)
        elif filter_range == "week":
            week_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            week_end   = week_start + timedelta(days=7)
            query = query.filter(Event.start_at >= week_start, Event.start_at < week_end)
        elif filter_range == "month":
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if now.month == 12:
                month_end = month_start.replace(year=now.year+1, month=1)
            else:
                month_end = month_start.replace(month=now.month+1)
            query = query.filter(Event.start_at >= month_start, Event.start_at < month_end)
        elif filter_date:
            try:
                fdt = datetime.fromisoformat(filter_date)
                day_start = fdt.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end   = day_start + timedelta(days=1)
                query = query.filter(Event.start_at >= day_start, Event.start_at < day_end)
            except Exception:
                pass
        events = query.order_by(Event.start_at).all()
        if not events:
            return {"executed": True, "action": "list_events", "message": "No events.", "data": []}
        return {"executed": True, "action": "list_events",
                "message": f"{len(events)} event(s)", "data": [serialize_event(e) for e in events]}

    # ── SUPPRESSION / MISE À JOUR ÉVÉNEMENT ──
    if intent == "delete_event":
        all_flag   = params.get("all") in (True, "true", 1, "1", "oui", "yes")
        filter_str = params.get("filter_date")
        event_id   = params.get("event_id") or params.get("id")
        title      = (params.get("title") or "").strip()

        # 1) Supprimer TOUT explicitement
        if all_flag:
            count = db.query(Event).count()
            db.query(Event).delete()
            db.commit()
            return {"executed": True, "action": "delete_event",
                    "message": f"🗑️ {count} event(s) deleted."}

        # 2) Supprimer un événement SPÉCIFIQUE par son titre/nom (ex: "delete meeting with Manel")
        if title:
            query = db.query(Event).filter(Event.title.ilike(f"%{title}%"))
            # Si une date est aussi fournie, restreindre à ce jour-là
            if filter_str:
                try:
                    fdt = datetime.fromisoformat(filter_str)
                    day_start = fdt.replace(hour=0, minute=0, second=0, microsecond=0)
                    day_end = day_start + timedelta(days=1)
                    query = query.filter(Event.start_at >= day_start, Event.start_at < day_end)
                except Exception:
                    pass
            matches = query.all()
            if not matches:
                return {"executed": False, "message": f"No event matching « {title} » found."}
            names = [ev.title for ev in matches]
            for ev in matches:
                db.delete(ev)
            db.commit()
            if len(matches) == 1:
                return {"executed": True, "action": "delete_event",
                        "message": f"🗑️ Event « {names[0]} » deleted."}
            return {"executed": True, "action": "delete_event",
                    "message": f"🗑️ {len(matches)} event(s) deleted: {', '.join(names)}."}

        # 3) Supprimer par ID
        if event_id:
            try:
                eid = int(event_id)
            except Exception:
                return {"executed": False, "message": "Invalid event id."}
            ev = db.get(Event, eid)
            if not ev:
                return {"executed": False, "message": f"Event #{eid} not found."}
            db.delete(ev); db.commit()
            return {"executed": True, "action": "delete_event",
                    "message": f"🗑️ Event « {ev.title} » deleted."}

        # 4) Supprimer tous les événements d'une date (uniquement si AUCUN titre/ID, juste une date)
        if filter_str:
            try:
                filter_dt = datetime.fromisoformat(filter_str)
                day_start = filter_dt.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_start + timedelta(days=1)
            except Exception:
                return {"executed": False, "message": "Invalid filter date format."}
            events = db.query(Event).filter(Event.start_at >= day_start, Event.start_at < day_end).all()
            count = len(events)
            for ev in events:
                db.delete(ev)
            db.commit()
            return {"executed": True, "action": "delete_event",
                    "message": f"🗑️ {count} event(s) on {filter_dt.strftime('%d/%m')} deleted."}

        return {"executed": False, "message": "Which event do you want to delete? Give a name, id or date."}

    if intent == "update_event":
        event_id  = params.get("event_id") or params.get("id")
        title_key = (params.get("title") or "").strip()  # to find the event
        new_title = (params.get("new_title") or "").strip()
        new_start = params.get("new_start_time") or params.get("start_time")
        new_end   = params.get("end_time")

        # Find event: by id first, then by title match
        ev = None
        if event_id:
            try: ev = db.get(Event, int(event_id))
            except Exception: pass
        if not ev and title_key:
            ev = db.query(Event).filter(Event.title.ilike(f"%{title_key}%")).first()
        if not ev:
            return {"executed": False, "message": "Event not found. Specify an id or a name."}

        changed = False
        if new_title:
            ev.title = new_title; changed = True
        if new_start:
            try: ev.start_at = datetime.fromisoformat(new_start); changed = True
            except Exception: pass
        if new_end:
            try: ev.end_at = datetime.fromisoformat(new_end); changed = True
            except Exception: pass
        if not changed:
            return {"executed": False, "message": "Nothing to change. Specify a new title or time."}
        db.commit(); db.refresh(ev)
        return {"executed": True, "action": "update_event",
                "message": f"✏️ Event « {ev.title} » updated.", "data": serialize_event(ev)}

    # ── FOCUS ──
    if intent == "start_focus":
        duration = params.get("duration") or params.get("minutes") or 25
        try: duration = int(duration)
        except Exception: duration = 25
        s = FocusSession(minutes=duration, status="running", started_at=datetime.now())
        db.add(s); db.commit(); db.refresh(s)
        return {"executed": True, "action": "start_focus",
                "message": f"🎯 Focus started for {duration} minutes!", "data": serialize_focus(s)}

    if intent == "stop_focus":
        s = db.query(FocusSession).filter(FocusSession.status == "running").first()
        if not s:
            return {"executed": False, "message": "No focus session running."}
        s.status = "stopped"; s.ended_at = datetime.now()
        db.commit(); db.refresh(s)
        return {"executed": True, "action": "stop_focus",
                "message": "⏹️ Focus stopped.", "data": serialize_focus(s)}

    if intent == "pause_focus":
        s = db.query(FocusSession).filter(FocusSession.status == "running").first()
        if not s:
            return {"executed": False, "message": "No focus session running."}
        s.status = "paused"; s.ended_at = datetime.now()
        db.commit(); db.refresh(s)
        return {"executed": True, "action": "pause_focus",
                "message": "⏸️ Focus paused.", "data": serialize_focus(s)}

    if intent == "resume_focus":
        s = db.query(FocusSession).filter(FocusSession.status == "paused").first()
        if not s:
            return {"executed": False, "message": "No paused focus session."}
        s.status = "running"; s.ended_at = None
        db.commit(); db.refresh(s)
        return {"executed": True, "action": "resume_focus",
                "message": "▶️ Focus resumed.", "data": serialize_focus(s)}

    # ── SEARCH ──
    if intent == "search_task":
        q = (params.get("search_query") or params.get("title") or "").strip()
        if not q:
            return {"executed": False, "message": "What to search for in tasks?"}
        results = db.query(Task).filter(Task.title.ilike(f"%{q}%")).all()
        if not results:
            return {"executed": True, "action": "search_task",
                    "message": f"No task found matching « {q} ».", "data": []}
        return {"executed": True, "action": "search_task",
                "message": f"{len(results)} task(s) matching « {q} »", "data": [serialize_task(t) for t in results]}

    if intent == "search_event":
        q = (params.get("search_query") or params.get("title") or "").strip()
        if not q:
            return {"executed": False, "message": "What to search for in events?"}
        results = db.query(Event).filter(Event.title.ilike(f"%{q}%")).order_by(Event.start_at).all()
        if not results:
            return {"executed": True, "action": "search_event",
                    "message": f"No event found matching « {q} ».", "data": []}
        return {"executed": True, "action": "search_event",
                "message": f"{len(results)} event(s) matching « {q} »", "data": [serialize_event(e) for e in results]}

    # ── SMART INTENTS ──
    if intent == "clear_completed":
        done_tasks = db.query(Task).filter(Task.status == "done").all()
        count = len(done_tasks)
        if count == 0:
            return {"executed": False, "message": "No completed tasks to delete."}
        for t in done_tasks:
            db.delete(t)
        db.commit()
        return {"executed": True, "action": "clear_completed",
                "message": f"🗑️ {count} completed task(s) deleted."}

    if intent == "next_event":
        ev = db.query(Event).filter(Event.start_at >= datetime.now()).order_by(Event.start_at).first()
        if not ev:
            return {"executed": True, "action": "next_event",
                    "message": "📅 No upcoming events.", "data": None}
        return {"executed": True, "action": "next_event",
                "message": f"📅 Next: « {ev.title} » on {ev.start_at.strftime('%d/%m at %Hh%M')}",
                "data": serialize_event(ev)}

    if intent == "today_summary":
        now = datetime.now()
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end   = day_start + timedelta(days=1)
        tasks      = db.query(Task).all()
        today_evts = db.query(Event).filter(Event.start_at >= day_start, Event.start_at < day_end).order_by(Event.start_at).all()
        focus_sess = db.query(FocusSession).filter(FocusSession.status == "running").first()
        todo_count = sum(1 for t in tasks if t.status == "todo")
        done_count = sum(1 for t in tasks if t.status == "done")
        urgent_count = sum(1 for t in tasks if t.priority == 5)
        evt_lines = [f"• {e.title} at {e.start_at.strftime('%Hh%M')}" for e in today_evts]
        summary = (
            f"📊 Today — {now.strftime('%A %d/%m')}:\n"
            f"  Tasks: {todo_count} todo, {done_count} done, {urgent_count} urgent\n"
            f"  Events today ({len(today_evts)}): " + (", ".join([e.title for e in today_evts]) if today_evts else "none") + "\n"
            f"  Focus: {'🎯 session running' if focus_sess else 'no session'}"
        )
        return {"executed": True, "action": "today_summary",
                "message": summary,
                "data": {"tasks": [serialize_task(t) for t in tasks],
                         "events_today": [serialize_event(e) for e in today_evts]}}

    # ── CONVERSATIONNEL (pas d'action DB) ──
    return {"executed": False, "action": intent}


@app.post("/api/chat")
def chat(body: ExecuteIn):
    """Comprend + exécute automatiquement l'action détectée par Gemini."""
    sid = body.session_id or None

    # Build current state so Gemini knows exact ids/titles
    db = SessionLocal()
    try:
        state_tasks  = db.query(Task).order_by(Task.id).all()
        state_events = db.query(Event).order_by(Event.start_at).all()
        state_focus  = db.query(FocusSession).filter(FocusSession.status == "running").first()
        state = {
            "tasks":  [serialize_task(t) for t in state_tasks],
            "events": [serialize_event(e) for e in state_events],
            "focus":  serialize_focus(state_focus) if state_focus else None,
        }
    finally:
        db.close()

    understanding = understand_command(body.text, body.context, session_id=sid, state=state)

    intent = understanding.get("intent", "unknown")
    params = understanding.get("parameters") or {}

    # DEBUG
    import sys
    print(f"DEBUG /api/chat: intent={intent}, params={params}", file=sys.stderr)

    EXEC_INTENTS = {
        "create_task", "list_tasks", "update_task", "delete_task", "search_task", "clear_completed",
        "schedule_event", "list_events", "update_event", "delete_event", "search_event", "next_event", "today_summary",
        "start_focus", "stop_focus", "pause_focus", "resume_focus",
    }

    action_result = None
    if intent in EXEC_INTENTS:
        db = SessionLocal()
        try:
            action_result = _execute_from_gemini(intent, params, db)
            print(f"DEBUG action_result: {action_result}", file=sys.stderr)
        finally:
            db.close()

    return {
        "input":          body.text,
        "context":        body.context,
        "session_id":     understanding.get("_session_id", ""),
        "understanding":  understanding,
        "action":         action_result,
    }


@app.post("/api/chat/companion")
def chat_companion(body: ExecuteIn):
    """Free conversation mode (Nova): no action parsing, plain text reply."""
    result = chat_with_nova(body.text, session_id=(body.session_id or None))
    return {
        "input": body.text,
        "context": "companion",
        "session_id": result.get("session_id", ""),
        "reply": result.get("reply", ""),
        "emotion": result.get("emotion", "neutre"),
        "lang": result.get("lang", "en"),
        "source": result.get("source", "unknown"),
    }


@app.post("/api/desktop/control")
def desktop_control(body: ExecuteIn):
    """Desktop control mode (Gemini): understand any desktop command."""
    result = execute_desktop_command(body.text)
    return {
        "input": body.text,
        "context": "desktop",
        "message": result.get("message", ""),
        "understood": result.get("understood", False),
        "command_type": result.get("command_type", "unknown"),
        "success": result.get("success", False),
        "details": result.get("details", ""),
        "source": result.get("source", "unknown"),
    }


@app.get("/gemini/status")
def gemini_status():
    """Retourne le statut de la configuration Gemini."""
    return get_gemini_status()

@app.post("/api/understand-batch")
def understand_batch(texts: list = None, context: str = "tasks"):
    """
    Comprend plusieurs commandes en lot avec Gemini.
    """
    if not texts or not isinstance(texts, list):
        return {"error": "Veuillez fournir une liste 'texts'"}
    
    from gemini_understanding import batch_understand_commands
    results = batch_understand_commands(texts, context)
    return {
        "count": len(results),
        "context": context,
        "results": results
    }


@app.post("/api/tts")
async def text_to_speech(text: str = None, lang: str = "fr"):
    """
    🎤 Génère de l'audio TTS avec gTTS (Google Text-to-Speech).
    - text: texte à prononcer
    - lang: langue (fr, en, etc.)
    
    Retourne: audio MP3 en base64
    """
    if not text:
        return {"error": "Veuillez fournir 'text'"}
    
    try:
        from gtts import gTTS
        import base64
        import io
        
        # Générer audio
        tts = gTTS(text=text, lang=lang, slow=False)
        audio_buffer = io.BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        
        # Convertir en base64
        audio_base64 = base64.b64encode(audio_buffer.getvalue()).decode('utf-8')
        
        return {
            "success": True,
            "text": text,
            "lang": lang,
            "audio_base64": audio_base64
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"TTS failed: {str(e)}",
            "hint": "Install with: pip install gTTS"
        }


@app.post("/api/stt")
async def speech_to_text(audio: UploadFile = File(...), lang: str = "en-US"):
    """
    Transcribe un fichier WAV depuis le frontend via SpeechRecognition + Google Web Speech.
    """
    if not audio.filename:
        return {"success": False, "error": "Audio file is required."}

    content_type = (audio.content_type or "").lower()
    if content_type and content_type not in {"audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave", "application/octet-stream"}:
        return {
            "success": False,
            "error": f"Unsupported audio type: {content_type}",
            "hint": "Send a WAV audio blob from the frontend."
        }

    try:
        import io
        import speech_recognition as sr

        payload = await audio.read()
        if not payload:
            return {"success": False, "error": "Empty audio payload."}

        recognizer = sr.Recognizer()
        with sr.AudioFile(io.BytesIO(payload)) as source:
            audio_data = recognizer.record(source)

        transcript = recognizer.recognize_google(audio_data, language=lang).strip()
        return {
            "success": True,
            "text": transcript,
            "lang": lang,
        }
    except sr.UnknownValueError:
        return {
            "success": False,
            "error": "No speech could be understood from the recording.",
            "code": "NO_SPEECH",
        }
    except sr.RequestError as exc:
        return {
            "success": False,
            "error": f"Speech transcription service failed: {exc}",
            "code": "SERVICE_UNAVAILABLE",
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Speech transcription failed: {exc}",
            "code": "STT_ERROR",
        }