import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"

const API = "http://localhost:8000"

type EventItem = {
  id: number
  title: string
  start_at: string
  end_at?: string | null
}

const headerToolbar = {
  left: "prev,next today",
  center: "title",
  right: "dayGridMonth,timeGridWeek,timeGridDay",
}

export default function CalendarView({ back }: { back: () => void }) {
  const [events, setEvents] = useState<EventItem[]>([])
  const [text, setText] = useState("")
  const [reply, setReply] = useState("")
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function loadEvents() {
    try {
      const res = await fetch(`${API}/events`)
      const data = await res.json()
      setEvents(Array.isArray(data) ? data : data.events ?? [])
    } catch {
      setReply("❌ Impossible de joindre l'API (port 8000 lancé ?)")
    }
  }

  useEffect(() => {
    loadEvents()
  }, [])

  async function send() {
    if (!text.trim()) return
    try {
      const res = await fetch(`${API}/productivity/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, context: "calendar" }),
      })
      const data = await res.json()
      setReply(data.message ?? JSON.stringify(data))
      setText("")
      loadEvents()
    } catch {
      setReply("❌ Erreur réseau")
    }
  }

  // Efface le message après quelques secondes
  useEffect(() => {
    if (!reply) return
    if (replyTimer.current) clearTimeout(replyTimer.current)
    replyTimer.current = setTimeout(() => setReply(""), 4000)
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current)
    }
  }, [reply])

  const calendarEvents = events.map((ev) => ({
    id: String(ev.id),
    title: ev.title,
    start: ev.start_at,
    end: ev.end_at ?? undefined,
  }))

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—"
    const dt = new Date(dateStr)
    if (Number.isNaN(dt.getTime())) return "—"
    return dt.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const isError = reply.startsWith("❌")

  return (
    <div style={styles.page}>
      <style>{fcTheme}</style>
      <div style={styles.shell}>
        <header style={styles.header}>
          <button style={styles.backBtn} onClick={back}>
            ← Retour
          </button>
          <span style={styles.badge}>{events.length} événements</span>
        </header>

        <h2 style={styles.title}>Calendrier</h2>

        {/* Commande texte */}
        <section style={styles.card}>
          <h3 style={styles.cardTitle}>Commande (texte)</h3>
          <div style={styles.inputRow}>
            <input
              style={styles.input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder='Ex : "Ajoute un meeting demain 10h"'
            />
            <button style={styles.primaryBtn} onClick={send}>
              Envoyer
            </button>
          </div>
          {reply && <div style={replyStyle(isError)}>{reply}</div>}
        </section>

        {/* Calendrier */}
        <section style={styles.card}>
          <div className="fc-dark">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={headerToolbar}
              height="auto"
              events={calendarEvents}
            />
          </div>
        </section>

        {/* Liste des événements */}
        <section style={styles.card}>
          <h3 style={styles.cardTitle}>📋 Liste des événements ({events.length})</h3>
          <div style={styles.list}>
            {events.length === 0 ? (
              <p style={styles.empty}>Aucun événement pour le moment.</p>
            ) : (
              events.map((ev) => (
                <div key={ev.id} style={styles.row}>
                  <span style={styles.rowId}>#{ev.id}</span>
                  <span style={styles.rowTitle}>{ev.title}</span>
                  <span style={styles.rowDate}>{formatDate(ev.start_at)}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

// ---- Style dynamique ----
function replyStyle(isError: boolean): CSSProperties {
  const c = isError ? "#f87171" : "#34d399"
  return {
    marginTop: 12,
    background: `${c}1a`,
    color: c,
    border: `1px solid ${c}55`,
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
  }
}

// ---- Thème sombre pour FullCalendar ----
const fcTheme = `
.fc-dark {
  --fc-border-color: #1e293b;
  --fc-page-bg-color: transparent;
  --fc-neutral-bg-color: #0f172a;
  --fc-today-bg-color: rgba(34,211,238,0.10);
  color: #e2e8f0;
}
.fc-dark .fc {
  font-family: Inter, system-ui, sans-serif;
}
.fc-dark .fc-toolbar-title {
  font-size: 18px;
  font-weight: 700;
  color: #e2e8f0;
}
.fc-dark .fc-col-header-cell-cushion,
.fc-dark .fc-daygrid-day-number {
  color: #94a3b8;
  text-decoration: none;
}
.fc-dark .fc-button {
  background: #1e293b;
  border: 1px solid #334155;
  color: #e2e8f0;
  text-transform: capitalize;
  font-weight: 600;
  box-shadow: none;
}
.fc-dark .fc-button:hover {
  background: #334155;
}
.fc-dark .fc-button-primary:not(:disabled).fc-button-active,
.fc-dark .fc-button-primary:not(:disabled):active {
  background: linear-gradient(135deg, #22d3ee, #6366f1);
  border-color: transparent;
  color: #0b1120;
}
.fc-dark .fc-event {
  background: linear-gradient(135deg, #22d3ee, #6366f1);
  border: none;
  color: #0b1120;
  font-weight: 600;
  padding: 1px 4px;
}
.fc-dark .fc-daygrid-day.fc-day-today {
  background: rgba(34,211,238,0.10);
}
.fc-dark a {
  color: inherit;
}
`

// ---- Styles statiques ----
const styles: Record<string, CSSProperties> = {
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
    maxWidth: 820,
    display: "flex",
    flexDirection: "column",
    gap: 18,
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
  badge: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 12,
    color: "#94a3b8",
  },
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
  list: { display: "flex", flexDirection: "column", gap: 8 },
  empty: { color: "#475569", margin: 0, fontSize: 14 },
  row: {
    display: "grid",
    gridTemplateColumns: "48px 1fr auto",
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
  rowDate: { color: "#64748b", fontSize: 12 },
}