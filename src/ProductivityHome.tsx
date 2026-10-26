import { useEffect, useMemo, useState } from "react"
import TaskAltRounded from "@mui/icons-material/TaskAltRounded"
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded"
import CheckRounded from "@mui/icons-material/CheckRounded"
import TimerRounded from "@mui/icons-material/TimerRounded"
import EventRounded from "@mui/icons-material/EventRounded"
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded"
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded"
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded"
import FlagRounded from "@mui/icons-material/FlagRounded"
import PersonRounded from "@mui/icons-material/PersonRounded"
import GeminiBar from "./GeminiBar"
import { Empty, FocusRing, StatCard } from "./ui"
import { Sticker } from "./stickers"
import { priorityTone, type EventItem, type FocusSession, type Task } from "./models"
import type { Page } from "./App"

const API = "http://localhost:8000"
const DAILY_FOCUS_GOAL = 120

export default function ProductivityHome({ go }: { go: (p: Page) => void }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [sessions, setSessions] = useState<FocusSession[]>([])

  async function refresh(): Promise<boolean> {
    let ok = true
    const get = (path: string) =>
      fetch(`${API}${path}`)
        .then((r) => r.json())
        .catch(() => {
          ok = false
          return []
        })
    const [t, e, f] = await Promise.all([get("/tasks"), get("/events"), get("/focus")])
    setTasks(Array.isArray(t) ? t : [])
    setEvents(Array.isArray(e) ? e : e?.events ?? [])
    setSessions(Array.isArray(f) ? f : [])
    return ok
  }

  useEffect(() => {
    // Au lancement, l'API peut démarrer en même temps que l'app : on réessaie quelques fois
    let tries = 0
    let timer: ReturnType<typeof setTimeout>
    const load = async () => {
      // l'API met ~25 s à charger ses modèles NLP : on réessaie toutes les 3 s pendant 2 min
      if (!(await refresh()) && ++tries < 40) timer = setTimeout(load, 3000)
    }
    load()
    return () => clearTimeout(timer)
  }, [])

  const data = useMemo(() => {
    const todo = tasks.filter((t) => t.status !== "done")
    const done = tasks.length - todo.length
    const today = new Date().toDateString()
    const focusToday = sessions
      .filter((s) => new Date(s.started_at).toDateString() === today)
      .reduce((sum, s) => sum + s.minutes, 0)
    const upcoming = events
      .filter((ev) => new Date(ev.start_at).getTime() >= Date.now() - 60 * 60 * 1000)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    const priority = [...todo].sort((a, b) => b.priority - a.priority).slice(0, 5)
    return { todo, done, focusToday, upcoming, priority }
  }, [tasks, events, sessions])

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir"
  const next = data.upcoming[0]
  const donePct = tasks.length ? Math.round((data.done / tasks.length) * 100) : 0

  return (
    <div className="page">
      <section className="hero-card">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="hero-date">
            {now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <h2>{greeting} 👋</h2>
          <p>
            {data.todo.length === 0
              ? "Aucune tâche en attente. Profite-en pour planifier la suite !"
              : `Tu as ${data.todo.length} tâche${data.todo.length > 1 ? "s" : ""} en cours${
                  next ? ` et « ${next.title} » arrive bientôt` : ""
                }. Un pas à la fois.`}
          </p>
        </div>
        <Sticker name="tomato" size={110} rotate={8} className="float" style={{ position: "relative", zIndex: 1, marginLeft: "auto" }} />
        <Sticker name="star" size={34} rotate={-14} className="sticker-abs" style={{ top: 14, right: "34%" }} />
        <Sticker name="sparkle" size={30} rotate={10} className="sticker-abs" style={{ bottom: 12, left: "46%" }} />
        <div className="hero-actions">
          <button className="btn-white" onClick={() => go("focus")}>
            <PlayArrowRounded /> Mode focus
          </button>
          <button className="btn-white glass" onClick={() => go("tasks")}>
            Voir mes tâches
          </button>
        </div>
      </section>

      <div className="stats">
        <StatCard icon={<TaskAltRounded />} value={data.todo.length} label="Tâches à faire" />
        <StatCard icon={<CheckCircleRounded />} value={`${donePct}%`} label={`${data.done} terminée${data.done > 1 ? "s" : ""}`} tone="leaf" />
        <StatCard icon={<TimerRounded />} value={`${data.focusToday} min`} label="Focus aujourd'hui" tone="amber" />
        <StatCard icon={<EventRounded />} value={data.upcoming.length} label="Événements à venir" tone="violet" />
      </div>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">
            <AutoAwesomeRounded /> Assistant universel
          </h3>
          <span className="pill">FR · EN · AR</span>
        </div>
        <GeminiBar
          context="general"
          placeholder='Ex : "Ajoute la tâche acheter du lait", "Réunion avec Sara demain 15h", "Lance un focus de 45 min"…'
          onAction={(_a, _d, executed) => executed && setTimeout(refresh, 100)}
          onRefresh={refresh}
        />
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h3 className="card-title">
              <FlagRounded /> Tâches prioritaires
            </h3>
            <button className="link-btn" onClick={() => go("tasks")}>
              Tout voir →
            </button>
          </div>
          {data.priority.length === 0 ? (
            <Empty sticker="check" text="Rien d'urgent pour l'instant." hint='Essaie : "Crée une tâche finir le rapport"' />
          ) : (
            <div className="timeline">
              {data.priority.map((t) => (
                <div key={t.id} className="tl-item">
                  <span className={"tl-dot" + (t.status === "done" ? " done" : "")}>
                    {t.status === "done" && <CheckRounded />}
                  </span>
                  <div className="tl-body">
                    <div className="tl-main">
                      <div className="tl-title">{t.title}</div>
                      <div className="tl-meta">
                        {t.deadline && (
                          <span>
                            <CalendarMonthRounded /> {new Date(t.deadline).toLocaleDateString("fr-FR")}
                          </span>
                        )}
                        {t.assignee && (
                          <span>
                            <PersonRounded /> {t.assignee}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={"pill " + priorityTone(t.priority)}>{t.priority_label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="col">
          <section className="card has-stickers" style={{ textAlign: "center" }}>
            <Sticker name="coffee" size={46} rotate={-12} className="sticker-abs" style={{ left: 22, bottom: 18 }} />
            <div className="card-head">
              <h3 className="card-title">
                <TimerRounded /> Objectif focus
              </h3>
              <button className="link-btn" onClick={() => go("focus")}>
                Ouvrir →
              </button>
            </div>
            <FocusRing
              size={190}
              progress={data.focusToday / DAILY_FOCUS_GOAL}
              time={`${data.focusToday}`}
              label={`sur ${DAILY_FOCUS_GOAL} min`}
            />
          </section>

          <section className="card">
            <div className="card-head">
              <h3 className="card-title">
                <EventRounded /> À venir
              </h3>
              <button className="link-btn" onClick={() => go("calendar")}>
                Calendrier →
              </button>
            </div>
            {data.upcoming.length === 0 ? (
              <Empty sticker="calendar" text="Aucun événement prévu." />
            ) : (
              <div className="ev-list">
                {data.upcoming.slice(0, 4).map((ev) => (
                  <EventRow key={ev.id} ev={ev} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export function EventRow({ ev }: { ev: EventItem }) {
  const dt = new Date(ev.start_at)
  const isToday = dt.toDateString() === new Date().toDateString()
  const isPast = dt < new Date()
  const time = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  return (
    <div className={"ev-row" + (isPast ? " past" : "")}>
      <div className={"ev-date" + (isToday && !isPast ? " today" : "")}>
        <div className="ev-day">{String(dt.getDate()).padStart(2, "0")}</div>
        <div className="ev-month">{dt.toLocaleString("fr-FR", { month: "short" }).replace(".", "")}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ev-title">{ev.title}</div>
        <div className="ev-time">
          {dt.toLocaleDateString("fr-FR", { weekday: "long" })} · {time(dt)}
          {ev.end_at && ` → ${time(new Date(ev.end_at))}`}
        </div>
      </div>
      {isToday && !isPast && <span className="pill">Aujourd'hui</span>}
      {isPast && <span className="pill muted">Passé</span>}
    </div>
  )
}
