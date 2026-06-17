import { useEffect, useMemo, useRef, useState } from "react"

const API = "http://localhost:8000"

type Task = {
  id: number
  title: string
  status: string
  created_at?: string
}

export default function TasksView({ back }: { back: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState("")
  const [cmd, setCmd] = useState("")
  const [log, setLog] = useState<string[]>([])
  const [toast, setToast] = useState("")
  const logRef = useRef<HTMLDivElement>(null)

  const stats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((t) => t.status === "done").length
    const todo = tasks.filter((t) => t.status === "todo").length
    return { total, done, todo }
  }, [tasks])

  async function refresh() {
    const r = await fetch(`${API}/tasks`)
    const data = await r.json()
    setTasks(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [log])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(""), 2200)
    return () => clearTimeout(t)
  }, [toast])

  async function addTask() {
    if (!title.trim()) return
    await fetch(`${API}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), status: "todo" }),
    })
    setTitle("")
    setToast("✅ Tâche ajoutée")
    refresh()
  }

  async function delTask(id: number) {
    await fetch(`${API}/tasks/${id}`, { method: "DELETE" })
    setToast(`🗑️ Tâche #${id} supprimée`)
    refresh()
  }

  async function executeText() {
    if (!cmd.trim()) return
    const userText = cmd.trim()
    const r = await fetch(`${API}/productivity/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: userText, context: "tasks" }),
    })
    const data = await r.json()
    setLog((l) => [...l, `> ${userText}`, data?.message || "(no message)"])
    setCmd("")
    setToast(data?.message || "Done")
    refresh()
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <button style={styles.backBtn} onClick={back}>
            ← Retour
          </button>
          <div style={styles.statRow}>
            <span style={chipStyle("#94a3b8")}>Total : {stats.total}</span>
            <span style={chipStyle("#22d3ee")}>Todo : {stats.todo}</span>
            <span style={chipStyle("#34d399")}>Done : {stats.done}</span>
          </div>
        </header>

        <h2 style={styles.title}>Tasks</h2>

        {/* Ajouter une tâche */}
        <section style={styles.card}>
          <h3 style={styles.cardTitle}>Ajouter une tâche</h3>
          <div style={styles.inputRow}>
            <input
              style={styles.input}
              placeholder="Titre de la nouvelle tâche"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTask()
              }}
            />
            <button style={styles.primaryBtn} onClick={addTask}>
              Ajouter
            </button>
          </div>
        </section>

        {/* Commande texte */}
        <section style={styles.card}>
          <h3 style={styles.cardTitle}>Commande (texte)</h3>
          <div style={styles.inputRow}>
            <input
              style={styles.input}
              placeholder='Ex : "Add a task: finish dashboard"'
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") executeText()
              }}
            />
            <button style={styles.secondaryBtn} onClick={executeText}>
              Envoyer
            </button>
          </div>
          <div style={styles.logLabel}>Log</div>
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

        {/* Liste des tâches */}
        <section style={styles.card}>
          <h3 style={styles.cardTitle}>Vos tâches</h3>
          <div style={styles.list}>
            {tasks.length === 0 && (
              <p style={styles.empty}>Aucune tâche pour l'instant. Ajoutez-en une ci-dessus.</p>
            )}
            {tasks.map((t) => (
              <div key={t.id} style={styles.row}>
                <span style={styles.rowId}>#{t.id}</span>
                <span style={styles.rowTitle}>{t.title}</span>
                <span style={statusPillStyle(t.status)}>{t.status}</span>
                <button
                  style={styles.deleteBtn}
                  title="Supprimer"
                  onClick={() => delTask(t.id)}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Toast */}
      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  )
}

// ---- Styles dynamiques ----
function chipStyle(color: string): React.CSSProperties {
  return {
    color,
    background: `${color}1a`,
    border: `1px solid ${color}55`,
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 600,
  }
}

function statusPillStyle(status: string): React.CSSProperties {
  const s = status?.toLowerCase()
  const map: Record<string, string> = {
    todo: "#22d3ee",
    in_progress: "#fbbf24",
    doing: "#fbbf24",
    done: "#34d399",
    completed: "#34d399",
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
    gap: 18,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
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
  statRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  title: { margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: 0.5 },
  card: {
    background: "rgba(30,41,59,0.45)",
    border: "1px solid #1e293b",
    borderRadius: 16,
    padding: 18,
  },
  cardTitle: {
    margin: "0 0 12px",
    fontSize: 15,
    fontWeight: 700,
    color: "#e2e8f0",
  },
  inputRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  input: {
    flex: 1,
    minWidth: 180,
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
  },
  primaryBtn: {
    background: "linear-gradient(135deg, #22d3ee, #6366f1)",
    color: "#0b1120",
    border: "none",
    borderRadius: 10,
    padding: "10px 22px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },
  secondaryBtn: {
    background: "linear-gradient(135deg, #a78bfa, #6366f1)",
    color: "#0b1120",
    border: "none",
    borderRadius: 10,
    padding: "10px 22px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },
  logLabel: {
    margin: "16px 0 8px",
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: 600,
  },
  console: {
    background: "#0b1120",
    border: "1px solid #1e293b",
    borderRadius: 10,
    padding: 14,
    height: 120,
    overflowY: "auto",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 13,
    lineHeight: 1.6,
  },
  consoleEmpty: { color: "#475569" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  empty: { color: "#475569", margin: 0, fontSize: 14 },
  row: {
    display: "grid",
    gridTemplateColumns: "48px 1fr auto auto",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    background: "#0f172a",
    borderRadius: 10,
    border: "1px solid #1e293b",
    fontSize: 14,
  },
  rowId: { color: "#64748b", fontWeight: 600 },
  rowTitle: { color: "#e2e8f0", fontWeight: 500 },
  deleteBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    opacity: 0.7,
  },
  toast: {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid #334155",
    borderRadius: 10,
    padding: "10px 18px",
    fontSize: 14,
    boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
    zIndex: 1000,
  },
}