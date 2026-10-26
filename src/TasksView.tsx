import { useEffect, useMemo, useState } from "react"
import TaskAltRounded from "@mui/icons-material/TaskAltRounded"
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded"
import CheckRounded from "@mui/icons-material/CheckRounded"
import PendingActionsRounded from "@mui/icons-material/PendingActionsRounded"
import PriorityHighRounded from "@mui/icons-material/PriorityHighRounded"
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded"
import PersonRounded from "@mui/icons-material/PersonRounded"
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded"
import GeminiBar from "./GeminiBar"
import { Empty, PageHeader, StatCard } from "./ui"
import { priorityTone, type Task } from "./models"

const API_PYTHON = "http://localhost:8000"

type Filter = "all" | "todo" | "done"

const STATUS_LABEL: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminée",
}

export default function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<Filter>("all")

  const stats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((t) => t.status === "done").length
    const todo = tasks.filter((t) => t.status === "todo").length
    const urgent = tasks.filter((t) => t.priority === 5 && t.status !== "done").length
    return { total, done, todo, urgent }
  }, [tasks])

  const visible = useMemo(() => {
    if (filter === "todo") return tasks.filter((t) => t.status !== "done")
    if (filter === "done") return tasks.filter((t) => t.status === "done")
    return tasks
  }, [tasks, filter])

  async function refresh() {
    try {
      const r = await fetch(`${API_PYTHON}/tasks`)
      const data = await r.json()
      setTasks(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error("fetch tasks error", e)
    }
  }

  function handleGeminiAction(_action: string, _data: unknown, executed: boolean) {
    if (!executed) return
    // On délai un peu pour laisser le temps au backend de finir
    setTimeout(() => {
      refresh()
    }, 100)
  }

  useEffect(() => {
    refresh()
  }, [])

  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0

  return (
    <div className="page">
      <PageHeader
        kicker="Espace de travail"
        title="Mes tâches"
        sticker="check"
        sub={`${stats.total} tâche${stats.total !== 1 ? "s" : ""} · ${stats.done} terminée${stats.done !== 1 ? "s" : ""}`}
      />

      <div className="stats">
        <StatCard icon={<TaskAltRounded />} value={stats.total} label="Total" />
        <StatCard icon={<PendingActionsRounded />} value={stats.todo} label="À faire" tone="sky" />
        <StatCard icon={<CheckCircleRounded />} value={stats.done} label="Terminées" tone="leaf" />
        <StatCard icon={<PriorityHighRounded />} value={stats.urgent} label="Urgentes" tone="amber" />
      </div>

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">
            <AutoAwesomeRounded /> Ajouter ou modifier avec Gemini
          </h3>
        </div>
        <GeminiBar
          context="tasks"
          placeholder="J'ai besoin de finir le rapport demain… / Show my urgent tasks / Marque la tâche 2 done"
          onAction={handleGeminiAction}
          onRefresh={() => refresh()}
        />
      </section>

      <section className="card">
        <div className="card-head" style={{ flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 className="card-title">Progression · {pct}%</h3>
            <div className="progress" style={{ marginTop: 10, maxWidth: 320 }}>
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="tabs">
            {(
              [
                ["all", "Toutes"],
                ["todo", "À faire"],
                ["done", "Terminées"],
              ] as [Filter, string][]
            ).map(([k, label]) => (
              <button key={k} className={"tab" + (filter === k ? " active" : "")} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <Empty
            sticker={tasks.length === 0 ? "leaf" : "sparkle"}
            text={tasks.length === 0 ? "Aucune tâche pour le moment." : "Rien dans ce filtre."}
            hint={tasks.length === 0 ? 'Dis à Gemini : "Crée une tâche…"' : undefined}
          />
        ) : (
          <div className="timeline">
            {visible.map((t) => {
              const done = t.status === "done"
              return (
                <div key={t.id} className="tl-item">
                  <span className={"tl-dot" + (done ? " done" : "")}>{done && <CheckRounded />}</span>
                  <div className="tl-body">
                    <span className="tl-id">#{t.id}</span>
                    <div className="tl-main">
                      <div className={"tl-title" + (done ? " done" : "")}>{t.title}</div>
                      {(t.deadline || t.assignee) && (
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
                      )}
                    </div>
                    <span className={"pill " + priorityTone(t.priority)}>{t.priority_label}</span>
                    <span className={"pill " + (done ? "leaf" : t.status === "in_progress" ? "amber" : "sky")}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
