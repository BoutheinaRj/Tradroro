import { useEffect, useMemo, useState } from "react"
import GeminiBar from "./GeminiBar"

const API_PYTHON = "http://localhost:8000"

type Task = {
  id: number
  title: string
  status: string
  priority: number
  priority_label: string
  assignee?: string
  deadline?: string
  description?: string
  created_at?: string
}

export default function TasksView({ back }: { back: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([])

  const stats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((t) => t.status === "done").length
    const todo = tasks.filter((t) => t.status === "todo").length
    const byPriority = {
      urgent: tasks.filter((t) => t.priority === 5).length,
      important: tasks.filter((t) => t.priority === 4).length,
      normal: tasks.filter((t) => t.priority === 3).length,
    }
    return { total, done, todo, byPriority }
  }, [tasks])

  async function refresh() {
    try {
      const r = await fetch(`${API_PYTHON}/tasks`)
      const data = await r.json()
      setTasks(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error("fetch tasks error", e)
    }
  }

  function handleGeminiAction(action: string, data: unknown, executed: boolean) {
    if (!executed) return
    // Si l'action a été exécutée, rafraîchir les tâches
    // On délai un peu pour laisser le temps au backend de finir
    setTimeout(() => {
      refresh()
    }, 100)
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        {/* Header */}
        <header style={styles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button style={styles.backBtn} onClick={back}>← Back</button>
            <div>
              <h2 style={styles.title}>🗂️ Smart Tasks</h2>
              <p style={styles.subtitle}>{stats.total} task{stats.total !== 1 ? "s" : ""} · {stats.done} completed</p>
            </div>
          </div>
          <div style={styles.statRow}>
            <StatChip label="Total" value={stats.total} color="#2563eb" />
            <StatChip label="Todo" value={stats.todo} color="#0ea5e9" />
            <StatChip label="Done" value={stats.done} color="#16a34a" />
            <StatChip label="Urgent" value={stats.byPriority.urgent} color="#dc2626" />
          </div>
        </header>

        {/* Gemini Bar */}
        <GeminiBar 
          context="tasks" 
          placeholder="J'ai besoin de finir le rapport demain... / Show my urgent tasks / Marque la tâche 2 done" 
          onAction={handleGeminiAction}
          onRefresh={() => refresh()}
        />

        {/* Task List */}
        <section style={styles.card}>
          <h3 style={styles.cardTitle}>📋 Your Tasks</h3>
          <div style={styles.list}>
            {tasks.length === 0 && (
              <div style={styles.emptyBox}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📝</div>
                <p style={styles.empty}>Aucune tâche pour le moment.</p>
                <p style={styles.emptyHint}>Dites à Gemini: "Crée une tâche…"</p>
              </div>
            )}
            {tasks.map((t) => (
              <div key={t.id} style={taskRowStyle(t.status)}>
                <span style={styles.rowNum}>#{t.id}</span>
                <div style={styles.taskContent}>
                  <div style={taskTitleStyle(t.status)}>{t.title}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {t.deadline && (
                      <span style={styles.taskMeta}>📅 {new Date(t.deadline).toLocaleDateString("fr-FR")}</span>
                    )}
                    {t.assignee && (
                      <span style={styles.taskMeta}>👤 {t.assignee}</span>
                    )}
                  </div>
                </div>
                <span style={priorityPillStyle(t.priority)}>{t.priority_label}</span>
                <span style={statusBadge(t.status)}>{t.status.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      background: "#ffffff", border: `1px solid ${color}22`,
      borderRadius: 10, padding: "6px 14px", minWidth: 52,
      boxShadow: `0 1px 4px ${color}12`,
    }}>
      <span style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
    </div>
  )
}

// ---- Styles dynamiques ----
function priorityPillStyle(priority: number): React.CSSProperties {
  const map: Record<number, string> = {
    5: "#dc2626",
    4: "#ea580c",
    3: "#ca8a04",
    2: "#0284c7",
    1: "#6b7280",
  }
  const color = map[priority] || "#94a3b8"
  return {
    color,
    background: `${color}12`,
    border: `1px solid ${color}44`,
    borderRadius: 999,
    padding: "3px 10px",
    fontSize: 11,
    fontWeight: 600,
  }
}

function taskRowStyle(status: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    background: status === "done" ? "#f0fdf4" : "#ffffff",
    border: `1px solid ${status === "done" ? "#bbf7d0" : "#e2e8f4"}`,
    borderRadius: 10,
    opacity: status === "done" ? 0.75 : 1,
    boxShadow: "0 1px 4px rgba(37,99,235,0.05)",
  }
}

function taskTitleStyle(status: string): React.CSSProperties {
  return {
    fontSize: 14,
    fontWeight: 600,
    color: status === "done" ? "#6b7280" : "#1e293b",
    textDecoration: status === "done" ? "line-through" : "none",
  }
}

// ---- Styles statiques ----
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f0f4ff",
    padding: 24,
    fontFamily: "Inter, system-ui, sans-serif",
    color: "#1e293b",
    display: "flex",
    justifyContent: "center",
  },
  shell: {
    width: "100%",
    maxWidth: 720,
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    background: "#ffffff",
    borderRadius: 16,
    padding: "16px 20px",
    border: "1px solid #e2e8f4",
    boxShadow: "0 2px 12px rgba(37,99,235,0.07)",
  },
  backBtn: {
    background: "#f1f5fe",
    color: "#2563eb",
    border: "1px solid #c7d9fc",
    borderRadius: 8,
    padding: "7px 12px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    flexShrink: 0,
  },
  statRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: "#1e293b", letterSpacing: 0.2 },
  subtitle: { margin: "2px 0 0", fontSize: 12, color: "#94a3b8", fontWeight: 500 },
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f4",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 2px 12px rgba(37,99,235,0.07)",
  },
  cardTitle: {
    margin: "0 0 12px",
    fontSize: 15,
    fontWeight: 700,
    color: "#1e293b",
  },
  list: { display: "flex", flexDirection: "column", gap: 6 },
  emptyBox: { display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0" },
  empty: { color: "#64748b", margin: 0, fontSize: 14, fontWeight: 500 },
  emptyHint: { color: "#94a3b8", margin: "4px 0 0", fontSize: 12 },
  taskContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  taskMeta: {
    fontSize: 11,
    color: "#94a3b8",
  },
  rowNum: {
    color: "#94a3b8",
    fontWeight: 700,
    fontSize: 12,
    minWidth: 30,
  },
}

function statusBadge(status: string): React.CSSProperties {
  const map: Record<string, [string, string]> = {
    todo:        ["#2563eb", "#eff4ff"],
    done:        ["#16a34a", "#f0fdf4"],
    in_progress: ["#d97706", "#fffbeb"],
  }
  const [color, bg] = map[status] ?? ["#64748b", "#f8fafc"]
  return {
    display: "inline-block",
    background: bg,
    border: `1px solid ${color}44`,
    color,
    padding: "3px 9px",
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  }
}