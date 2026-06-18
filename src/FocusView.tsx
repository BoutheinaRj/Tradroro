import { useEffect, useMemo, useState } from "react"
import GeminiBar from "./GeminiBar"

const API_PYTHON = "http://localhost:8000"

type FocusSession = {
  id: number
  minutes: number
  status: string
  started_at: string
  ended_at?: string | null
}

export default function FocusView({ back }: { back: () => void }) {
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

  function handleGeminiAction(action: string, data: unknown, executed: boolean) {
    if (!executed) return
    // Rafraîchir les sessions après une action exécutée
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
    const active = sessions.filter(
      (s) => ["running", "active", "in_progress", "started"].includes(s.status?.toLowerCase())
    ).length
    const paused = sessions.filter((s) => s.status?.toLowerCase() === "paused").length
    const completed = sessions.filter((s) => ["completed", "stopped"].includes(s.status?.toLowerCase())).length
    const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0)

    return { total, active, paused, completed, totalMinutes }
  }, [sessions])

  const active = useMemo(
    () =>
      sessions.find((s) =>
        ["running", "active", "in_progress", "started"].includes(
          s.status?.toLowerCase(),
        ),
      ),
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

  const R = 120
  const C = 2 * Math.PI * R
  const dash = C * timer.progress

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        {/* Header card */}
        <header style={styles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button style={styles.backBtn} onClick={back}>← Back</button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={dotStyle(active ? "#2563eb" : "#cbd5e1")} />
                <h2 style={styles.title}>🎯 Focus Mode</h2>
              </div>
              <p style={styles.subtitle}>{stats.total} session{stats.total !== 1 ? "s" : ""} · {stats.totalMinutes}m total</p>
            </div>
          </div>
          <span style={{
            background: active ? "#eff4ff" : "#f8fafc",
            border: `1px solid ${active ? "#c7d9fc" : "#e2e8f4"}`,
            borderRadius: 999, padding: "4px 12px", fontSize: 12,
            color: active ? "#2563eb" : "#94a3b8", fontWeight: 700,
          }}>{active ? "● Active" : "○ Idle"}</span>
        </header>

        {/* Stats Row */}
        <div style={styles.statRow}>
          <span style={chipStyle("#64748b")}>Total: {stats.total}</span>
          <span style={chipStyle("#2563eb")}>Active: {stats.active}</span>
          <span style={chipStyle("#d97706")}>Paused: {stats.paused}</span>
          <span style={chipStyle("#16a34a")}>Done: {stats.completed}</span>
          <span style={chipStyle("#0ea5e9")}>{stats.totalMinutes}m tracked</span>
        </div>

        {/* Timer Circle */}
        <section style={styles.timerCard}>
          <div style={styles.timerWrap}>
            <svg width="280" height="280" style={styles.svg}>
              <circle
                cx="140"
                cy="140"
                r={R}
                stroke="#e2e8f4"
                strokeWidth="16"
                fill="none"
              />
              <circle
                cx="140"
                cy="140"
                r={R}
                stroke="url(#grad)"
                strokeWidth="16"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C - dash}
                style={styles.progressCircle}
              />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
            </svg>
            <div style={styles.timerCenter}>
              <div style={styles.timeText}>{active ? `${mm}:${ss}` : "00:00"}</div>
              <div style={styles.timerLabel}>
                {active ? `${active.status.toUpperCase()} - ${active.minutes}m` : "No active session"}
              </div>
            </div>
          </div>
        </section>

        {/* Gemini LLM Understanding */}
        <GeminiBar context="focus" placeholder="Démarre 45 minutes / Stop ma session / Pause le focus / Continue / I need to concentrate for 1 hour" onAction={handleGeminiAction} onRefresh={refresh} />

        {/* Session History */}
        <section style={styles.card}>
          <h3 style={styles.cardTitle}>📋 Session History</h3>
          <div style={styles.list}>
            {sessions.length === 0 && (
              <p style={styles.empty}>No sessions yet. Start your first focus session!</p>
            )}
            {sessions.map((session) => (
              <div key={session.id} style={sessionRowStyle(session.status)}>
                <span style={styles.rowId}>#{session.id}</span>
                <span style={styles.rowMin}>{session.minutes}m</span>
                <span style={statusPillStyle(session.status)}>
                  {session.status.toUpperCase()}
                </span>
                <span style={styles.rowDate}>{formatDate(session.started_at)}</span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}

// ---- Utility Functions ----
function formatDate(value?: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
}

function dotStyle(color: string): React.CSSProperties {
  return {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: color,
    boxShadow: `0 0 8px ${color}66`,
  }
}

function statusPillStyle(status: string): React.CSSProperties {
  const s = status?.toLowerCase()
  const map: Record<string, [string, string]> = {
    running:     ["#2563eb", "#eff4ff"],
    active:      ["#2563eb", "#eff4ff"],
    started:     ["#2563eb", "#eff4ff"],
    in_progress: ["#2563eb", "#eff4ff"],
    paused:      ["#d97706", "#fffbeb"],
    done:        ["#16a34a", "#f0fdf4"],
    completed:   ["#16a34a", "#f0fdf4"],
    stopped:     ["#dc2626", "#fef2f2"],
  }
  const [c, bg] = map[s] ?? ["#64748b", "#f8fafc"]
  return {
    color: c,
    background: bg,
    border: `1px solid ${c}33`,
    borderRadius: 999,
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 700,
  }
}

function sessionRowStyle(status: string): React.CSSProperties {
  const s = status?.toLowerCase()
  const isDone = s === "done" || s === "completed" || s === "stopped"
  const isRunning = s === "running" || s === "active"
  return {
    display: "grid",
    gridTemplateColumns: "60px 50px 100px 1fr",
    gap: 12,
    alignItems: "center",
    padding: "12px 14px",
    background: isDone ? "#f0fdf4" : isRunning ? "#eff4ff" : "#ffffff",
    border: `1px solid ${isDone ? "#bbf7d0" : isRunning ? "#c7d9fc" : "#e2e8f4"}`,
    borderRadius: 10,
    fontSize: 13,
    boxShadow: "0 1px 4px rgba(37,99,235,0.05)",
  }
}

function chipStyle(color: string): React.CSSProperties {
  return {
    display: "inline-block",
    background: `${color}15`,
    border: `1px solid ${color}44`,
    color,
    padding: "4px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
  }
}

// ---- Static Styles ----
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
    maxWidth: 800,
    display: "flex",
    flexDirection: "column",
    gap: 20,
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
  titleWrap: { display: "flex", alignItems: "center", gap: 8 },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: "#1e293b" },
  subtitle: { margin: "2px 0 0", fontSize: 12, color: "#94a3b8", fontWeight: 500 },
  badge: {
    background: "#eff4ff",
    border: "1px solid #c7d9fc",
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 12,
    color: "#2563eb",
    fontWeight: 700,
  },
  statRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  timerCard: {
    display: "flex",
    justifyContent: "center",
    padding: "32px 28px",
    background: "#ffffff",
    border: "1px solid #e2e8f4",
    borderRadius: 24,
    boxShadow: "0 4px 24px rgba(37,99,235,0.10)",
  },
  timerWrap: {
    position: "relative",
    width: 280,
    height: 280,
  },
  svg: {
    transform: "rotate(-90deg)",
  },
  progressCircle: {
    transition: "stroke-dashoffset 1s linear",
  },
  timerCenter: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    fontSize: 56,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    color: "#1e293b",
  },
  timerLabel: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: 600,
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f4",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 2px 12px rgba(37,99,235,0.06)",
  },
  cardTitle: {
    margin: "0 0 16px",
    fontSize: 14,
    fontWeight: 700,
    color: "#1e293b",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  empty: {
    fontSize: 13,
    color: "#94a3b8",
    fontStyle: "italic",
    margin: 0,
    padding: 12,
    textAlign: "center",
  },
  rowId: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },
  rowMin: {
    fontWeight: 700,
    color: "#2563eb",
  },
  rowDate: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "right",
  },
}