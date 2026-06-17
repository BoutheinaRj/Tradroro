import { useEffect, useMemo, useRef, useState } from "react"

const API = "http://localhost:8000"

type FocusSession = {
  id: number
  minutes: number
  status: string
  started_at: string
  ended_at?: string | null
}

export default function FocusView({ back }: { back: () => void }) {
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const [cmd, setCmd] = useState("")
  const [log, setLog] = useState<string[]>([])
  const [now, setNow] = useState(() => Date.now())
  const logRef = useRef<HTMLDivElement>(null)

  async function refresh() {
    const response = await fetch(`${API}/focus`)
    setSessions(await response.json())
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [log])

  async function executeText() {
    if (!cmd.trim()) return
    const response = await fetch(`${API}/productivity/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cmd, context: "focus" }),
    })
    const data = await response.json()
    setLog((items) => [...items, `> ${cmd}`, data.message])
    setCmd("")
    refresh()
  }

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
        <header style={styles.header}>
          <button style={styles.backBtn} onClick={back}>
            ← Retour
          </button>
          <div style={styles.titleWrap}>
            <span style={dotStyle(active ? "#22d3ee" : "#475569")} />
            <h2 style={styles.title}>Focus Mode</h2>
          </div>
          <span style={styles.badge}>{sessions.length} sessions</span>
        </header>

        <section style={styles.timerCard}>
          <div style={styles.timerWrap}>
            <svg width="280" height="280" style={styles.svg}>
              <circle
                cx="140"
                cy="140"
                r={R}
                stroke="#1e293b"
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
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
            <div style={styles.timerCenter}>
              <div style={styles.timeText}>{active ? `${mm}:${ss}` : "00:00"}</div>
              <div style={styles.timerLabel}>
                {active ? active.status.toUpperCase() : "Aucune session active"}
              </div>
            </div>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.h3}>Historique</h3>
          <div style={styles.list}>
            {sessions.length === 0 && (
              <p style={styles.empty}>Aucune session pour l'instant.</p>
            )}
            {sessions.map((session) => (
              <div key={session.id} style={styles.row}>
                <span style={styles.rowId}>#{session.id}</span>
                <span style={styles.rowMin}>{session.minutes} min</span>
                <span style={statusPillStyle(session.status)}>
                  {session.status}
                </span>
                <span style={styles.rowDate}>{formatDate(session.started_at)}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.h3}>Commande</h3>
          <div style={styles.inputRow}>
            <input
              style={styles.input}
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={(e) => (e.key === "Enter" ? executeText() : null)}
              placeholder='Ex : "Start focus 25" ou "Stop focus"'
            />
            <button style={styles.sendBtn} onClick={executeText}>
              Envoyer
            </button>
          </div>
          <div ref={logRef} style={styles.console}>
            {log.length === 0 ? (
              <span style={styles.consoleEmpty}>
                Les résultats des commandes s'affichent ici…
              </span>
            ) : (
              log.map((line, i) => (
                <div key={i} style={logLineStyle(line)}>
                  {line}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

// ---- Fonctions utilitaires ----
function formatDate(value?: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString()
}

function dotStyle(color: string): React.CSSProperties {
  return {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: color,
    boxShadow: `0 0 12px ${color}`,
  }
}

function statusPillStyle(status: string): React.CSSProperties {
  const s = status?.toLowerCase()
  const map: Record<string, string> = {
    running: "#22d3ee",
    active: "#22d3ee",
    started: "#22d3ee",
    in_progress: "#22d3ee",
    done: "#86efac",
    completed: "#86efac",
    stopped: "#f87171",
  }
  const c = map[s] || "#94a3b8"
  return {
    justifySelf: "start",
    color: c,
    background: `${c}1a`,
    border: `1px solid ${c}55`,
    borderRadius: 999,
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "capitalize",
  }
}

function logLineStyle(line: string): React.CSSProperties {
  return { color: line.startsWith(">") ? "#22d3ee" : "#86efac" }
}

// ---- Styles statiques ----
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(1200px 600px at 50% -10%, #1e293b, #0b1120)",
    padding: 24,
    fontFamily: "Inter, system-ui, sans-serif",
    color: "#e2e8f0",
    display: "flex",
    justifyContent: "center",
  },
  shell: {
    width: "100%",
    maxWidth: 720,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    background: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: 10,
    padding: "8px 14px",
    cursor: "pointer",
    fontSize: 14,
  },
  titleWrap: { display: "flex", alignItems: "center", gap: 8 },
  title: { margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: 0.5 },
  badge: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 12,
    color: "#94a3b8",
  },
  timerCard: {
    display: "flex",
    justifyContent: "center",
    padding: "28px 0",
    background: "rgba(30,41,59,0.4)",
    border: "1px solid #1e293b",
    borderRadius: 24,
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
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: 2,
  },
  timerLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 6,
    letterSpacing: 1,
  },
  section: {
    background: "rgba(30,41,59,0.4)",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: 18,
  },
  h3: { margin: "0 0 12px", fontSize: 14, color: "#94a3b8", fontWeight: 600 },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  empty: { color: "#475569", margin: 0, fontSize: 14 },
  row: {
    display: "grid",
    gridTemplateColumns: "48px 70px 1fr auto",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    background: "#0f172a",
    borderRadius: 10,
    border: "1px solid #1e293b",
    fontSize: 13,
  },
  rowId: { color: "#64748b", fontWeight: 600 },
  rowMin: { color: "#e2e8f0", fontWeight: 600 },
  rowDate: { color: "#64748b", fontSize: 12 },
  inputRow: { display: "flex", gap: 8 },
  input: {
    flex: 1,
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
  },
  sendBtn: {
    background: "linear-gradient(135deg, #22d3ee, #6366f1)",
    color: "#0b1120",
    border: "none",
    borderRadius: 10,
    padding: "10px 20px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },
  console: {
    marginTop: 12,
    background: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: 10,
    padding: 14,
    height: 160,
    overflowY: "auto",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 13,
    lineHeight: 1.6,
  },
  consoleEmpty: {
    color: "#475569",
  },
}