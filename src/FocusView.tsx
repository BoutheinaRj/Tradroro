import { useEffect, useMemo, useState } from "react"
import TimerRounded from "@mui/icons-material/TimerRounded"
import BoltRounded from "@mui/icons-material/BoltRounded"
import PauseCircleRounded from "@mui/icons-material/PauseCircleRounded"
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded"
import HistoryRounded from "@mui/icons-material/HistoryRounded"
import GeminiBar from "./GeminiBar"
import { Empty, FocusRing, PageHeader, StatCard } from "./ui"
import { Sticker } from "./stickers"
import type { FocusSession } from "./models"

const API_PYTHON = "http://localhost:8000"

const RUNNING = ["running", "active", "in_progress", "started"]

const STATUS: Record<string, [string, string]> = {
  running: ["En cours", ""],
  active: ["En cours", ""],
  started: ["En cours", ""],
  in_progress: ["En cours", ""],
  paused: ["En pause", "amber"],
  done: ["Terminée", "leaf"],
  completed: ["Terminée", "leaf"],
  stopped: ["Arrêtée", "muted"],
}

export default function FocusView() {
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const [now, setNow] = useState(() => Date.now())

  async function refresh() {
    try {
      const response = await fetch(`${API_PYTHON}/focus`)
      setSessions(await response.json())
    } catch (e) {
      console.error("Failed to fetch sessions", e)
    }
  }

  function handleGeminiAction(_action: string, _data: unknown, executed: boolean) {
    if (!executed) return
    setTimeout(() => {
      refresh()
    }, 100)
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const stats = useMemo(() => {
    const total = sessions.length
    const paused = sessions.filter((s) => s.status?.toLowerCase() === "paused").length
    const completed = sessions.filter((s) => ["completed", "stopped"].includes(s.status?.toLowerCase())).length
    const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0)
    return { total, paused, completed, totalMinutes }
  }, [sessions])

  const active = useMemo(
    () => sessions.find((s) => RUNNING.includes(s.status?.toLowerCase())),
    [sessions],
  )

  const timer = useMemo(() => {
    if (!active) return { remaining: 0, total: 0, progress: 0 }
    const total = active.minutes * 60
    const start = new Date(active.started_at).getTime()

    // Date invalide → on affiche la durée complète (ex : 25:00) sans planter
    if (!Number.isFinite(start)) {
      return { remaining: total, total, progress: 0 }
    }

    const elapsed = Math.floor((now - start) / 1000)
    const remaining = Math.max(0, total - elapsed)
    return { remaining, total, progress: total ? 1 - remaining / total : 0 }
  }, [active, now])

  // Garde-fou : jamais de NaN → au pire "00:00"
  const safeRemaining = Number.isFinite(timer.remaining) ? timer.remaining : 0
  const mm = String(Math.floor(safeRemaining / 60)).padStart(2, "0")
  const ss = String(safeRemaining % 60).padStart(2, "0")

  return (
    <div className="page">
      <PageHeader
        kicker="Espace de travail"
        title="Mode focus"
        sticker="clock"
        sub={`${stats.total} session${stats.total !== 1 ? "s" : ""} · ${stats.totalMinutes} min au total`}
        right={<span className={"pill" + (active ? "" : " muted")}>{active ? "● Session active" : "○ Au repos"}</span>}
      />

      <div className="grid-2">
        <section className="card focus-hero has-stickers">
          <Sticker name={active ? "tomato" : "tomatoSleep"} size={84} rotate={-10} className="sticker-abs float" style={{ top: 18, left: 18 }} />
          <Sticker name="star" size={36} rotate={14} className="sticker-abs" style={{ top: 26, right: 26 }} />
          <Sticker name="leaf" size={40} rotate={-20} className="sticker-abs" style={{ bottom: 22, right: 30 }} />
          <FocusRing
            size={300}
            progress={timer.progress}
            time={active ? `${mm}:${ss}` : "00:00"}
            label={active ? `Pomodoro · ${active.minutes} min` : "Aucune session active"}
          />
          <div className="focus-status">
            {active ? (
              <span className="pill">Reste concentré·e, tu y es presque 🍅</span>
            ) : (
              <span className="pill muted">Dis « Démarre 25 minutes » pour commencer</span>
            )}
          </div>
        </section>

        <div className="col">
          <div className="stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <StatCard icon={<TimerRounded />} value={`${stats.totalMinutes}`} label="Minutes suivies" />
            <StatCard icon={<BoltRounded />} value={stats.total} label="Sessions" tone="violet" />
            <StatCard icon={<PauseCircleRounded />} value={stats.paused} label="En pause" tone="amber" />
            <StatCard icon={<CheckCircleRounded />} value={stats.completed} label="Terminées" tone="leaf" />
          </div>

          <section className="card">
            <div className="card-head">
              <h3 className="card-title">
                <BoltRounded /> Contrôler avec Gemini
              </h3>
            </div>
            <GeminiBar
              context="focus"
              placeholder="Démarre 45 minutes / Stop ma session / Pause le focus / I need to concentrate for 1 hour"
              onAction={handleGeminiAction}
              onRefresh={refresh}
            />
          </section>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">
            <HistoryRounded /> Historique des sessions
          </h3>
        </div>
        {sessions.length === 0 ? (
          <Empty sticker="tomatoSleep" text="Aucune session pour l'instant." hint="Lance ta première session focus !" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sessions.map((session) => {
              const [label, tone] = STATUS[session.status?.toLowerCase()] ?? [session.status, "muted"]
              return (
                <div key={session.id} className="session-row">
                  <span className="session-icon">{session.minutes}′</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Session #{session.id}</div>
                    <div className="session-date">{formatDate(session.started_at)}</div>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{session.minutes} min</span>
                  <span className={"pill " + tone}>{label}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function formatDate(value?: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
}
