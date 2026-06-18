import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import GeminiBar from "./GeminiBar"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"

const API = "http://localhost:8000"
// Alertes 5 minutes avant l'événement
const ALERT_BEFORE_MS = 5 * 60 * 1000

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
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>("default")
  // Set d'IDs déjà alertés pour éviter les doublons
  const notifiedIds = useRef<Set<number>>(new Set())
  // Ref pour l'intervalle de vérification
  const alarmInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  async function loadEvents() {
    try {
      const res = await fetch(`${API}/events`)
      const data = await res.json()
      setEvents(Array.isArray(data) ? data : data.events ?? [])
    } catch {
      console.error("Cannot reach API (is port 8000 running?)")
    }
  }

  function handleGeminiAction(_action: string, _data: unknown, executed: boolean) {
    if (!executed) return
    // Rafraîchir les événements après une action exécutée
    setTimeout(() => {
      loadEvents()
    }, 100)
  }

  // Demander la permission de notification au montage
  useEffect(() => {
    if ("Notification" in window) {
      setNotifPerm(Notification.permission)
      if (Notification.permission === "default") {
        Notification.requestPermission().then(setNotifPerm)
      }
    }
    loadEvents()
  }, [])

  // Vérifier toutes les minutes si un événement approche (dans 5 min ou maintenant)
  useEffect(() => {
    alarmInterval.current = setInterval(() => {
      const now = Date.now()
      setEvents(current => {
        for (const ev of current) {
          if (notifiedIds.current.has(ev.id)) continue
          const evTime = new Date(ev.start_at).getTime()
          const diff = evTime - now
          // Alerte si l'événement est dans <= 5 min et pas encore passé de > 1 min
          if (diff <= ALERT_BEFORE_MS && diff > -60_000) {
            notifiedIds.current.add(ev.id)
            const minsLeft = Math.max(0, Math.round(diff / 60_000))
            const msg = minsLeft === 0
              ? `🔔 « ${ev.title} » commence maintenant !`
              : `⏰ « ${ev.title} » dans ${minsLeft} minute${minsLeft > 1 ? "s" : ""}`

            // 🎤 Jouer le son d'alarme + voix girly
            playAlarmSound()
            setTimeout(() => speakEventName(ev.title), 500)

            // Notification navigateur
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("📅 TRADRLY — Rappel événement", {
                body: msg,
                icon: "/favicon.ico",
                tag: `event-${ev.id}`,
              })
            }
            // Toast visuel en fallback
            showToast(msg)
          }
        }
        return current
      })
    }, 30_000) // vérification toutes les 30 secondes

    return () => { if (alarmInterval.current) clearInterval(alarmInterval.current) }
  }, [])

  const [toast, setToast] = useState<string | null>(null)
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 8000)
  }

  // 🎤 Faire parler l'événement avec voix féminine girly EN FRANÇAIS + ANGLAIS
  function speakEventName(title: string) {
    if (!("speechSynthesis" in window)) return
    
    // Arrêter toute voix précédente
    speechSynthesis.cancel()
    
    // Fonction pour créer une utterance dans une langue donnée
    const createUtterance = (text: string, lang: string) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.85 // plus lent pour meilleure prononciation
      utterance.pitch = 1.4 // voix girly plus aigüe
      utterance.volume = 1.0
      utterance.lang = lang
      
      // Chercher voix féminine
      const voices = speechSynthesis.getVoices()
      const femaleVoice = voices.find(v => {
        const name = v.name.toLowerCase()
        return v.lang.startsWith(lang.split('-')[0]) && !name.includes("male")
      })
      
      if (femaleVoice) {
        utterance.voice = femaleVoice
      }
      
      return utterance
    }
    
    // 🇫🇷 Version FRANÇAISE
    const frenchUtterance = createUtterance(`Attention, ${title}`, "fr-FR")
    
    // 🇬🇧 Version ANGLAISE
    const englishUtterance = createUtterance(`Attention, ${title}`, "en-US")
    
    // Parler français d'abord
    speechSynthesis.speak(frenchUtterance)
    
    // Puis anglais après 2.5 secondes
    setTimeout(() => {
      speechSynthesis.speak(englishUtterance)
    }, 2500)
  }

  // 🔔 Jouer un son d'alarme avec Web Audio API
  function playAlarmSound() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const now = audioCtx.currentTime
      
      // Triple beep d'alerte
      for (let i = 0; i < 3; i++) {
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.connect(gain)
        gain.connect(audioCtx.destination)
        
        osc.frequency.value = 800 + i * 100 // fréquence montante
        osc.type = "sine"
        
        gain.gain.setValueAtTime(0.3, now + i * 0.3)
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.3 + 0.2)
        
        osc.start(now + i * 0.3)
        osc.stop(now + i * 0.3 + 0.2)
      }
    } catch (e) {
      console.log("Audio contexte non supporté")
    }
  }

  async function requestNotifPermission() {
    if ("Notification" in window) {
      const perm = await Notification.requestPermission()
      setNotifPerm(perm)
    }
  }

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
    return dt.toLocaleString("en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div style={styles.page}>
      <style>{fcTheme}</style>
      <div style={styles.shell}>

        {/* Toast alarme */}
        {toast && (
          <div style={styles.toast}>{toast}</div>
        )}

        <header style={styles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button style={styles.backBtn} onClick={back}>← Back</button>
            <div>
              <h2 style={styles.title}>📅 Calendar</h2>
              <p style={styles.subtitle}>{events.length} événement{events.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={styles.badge}>{events.length} Events</span>
            {notifPerm !== "granted" && (
              <button style={styles.notifBtn} onClick={requestNotifPermission}>
                {notifPerm === "denied" ? "🔕 Bloquées" : "🔔 Activer alertes"}
              </button>
            )}
            {notifPerm === "granted" && (
              <span style={styles.notifActive}>🔔 Alertes actives</span>
            )}
          </div>
        </header>

        {/* Gemini LLM Understanding */}
        <GeminiBar context="events" placeholder="Réunion client demain 14h / Plan a call friday morning / Supprime tous les événements" onAction={handleGeminiAction} onRefresh={loadEvents} />

        {/* Text command removed — using GeminiBar */}

        {/* Calendar */}
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

        {/* Event list */}
        <section style={styles.card}>
          <h3 style={styles.cardTitle}>📋 Event List ({events.length})</h3>
          <div style={styles.list}>
            {events.length === 0 ? (
              <p style={styles.empty}>No events yet.</p>
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

// ---- Thème sombre pour FullCalendar ----
const fcTheme = `
.fc-dark {
  --fc-border-color: #e2e8f4;
  --fc-page-bg-color: transparent;
  --fc-neutral-bg-color: #f8faff;
  --fc-today-bg-color: #eff4ff;
  color: #1e293b;
}
.fc-dark .fc {
  font-family: Inter, system-ui, sans-serif;
}
.fc-dark .fc-toolbar-title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}
.fc-dark .fc-col-header-cell-cushion,
.fc-dark .fc-daygrid-day-number {
  color: #64748b;
  text-decoration: none;
}
.fc-dark .fc-button {
  background: #ffffff;
  border: 1px solid #c7d9fc;
  color: #2563eb;
  text-transform: capitalize;
  font-weight: 600;
  box-shadow: none;
}
.fc-dark .fc-button:hover {
  background: #eff4ff;
}
.fc-dark .fc-button-primary:not(:disabled).fc-button-active,
.fc-dark .fc-button-primary:not(:disabled):active {
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
  border-color: transparent;
  color: #fff;
}
.fc-dark .fc-event {
  background: linear-gradient(135deg, #2563eb, #0ea5e9);
  border: none;
  color: #fff;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 5px;
}
.fc-dark .fc-daygrid-day.fc-day-today {
  background: #eff4ff;
}
.fc-dark a {
  color: inherit;
}
`

// ---- Styles statiques ----
const styles: Record<string, CSSProperties> = {
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
    maxWidth: 820,
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
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
  badge: {
    border: "1px solid #c7d9fc",
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 12,
    color: "#2563eb",
    fontWeight: 700,
    background: "#eff4ff",
  },
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
  inputRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  input: {
    flex: 1,
    minWidth: 180,
    background: "#f8faff",
    border: "1px solid #c7d9fc",
    borderRadius: 10,
    padding: "10px 14px",
    color: "#1e293b",
    fontSize: 14,
    outline: "none",
  },
  primaryBtn: {
    background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "10px 22px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  empty: { color: "#94a3b8", margin: 0, fontSize: 14, textAlign: "center", padding: "20px 0" },
  row: {
    display: "grid",
    gridTemplateColumns: "48px 1fr auto",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    background: "#ffffff",
    borderRadius: 10,
    border: "1px solid #e2e8f4",
    fontSize: 14,
    boxShadow: "0 1px 4px rgba(37,99,235,0.05)",
  },
  rowId: { color: "#94a3b8", fontWeight: 700, fontSize: 12 },
  rowTitle: { color: "#1e293b", fontWeight: 500 },
  rowDate: { color: "#64748b", fontSize: 12 },
  toast: {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    background: "linear-gradient(135deg, #eff4ff, #fff)",
    border: "1px solid #2563eb",
    borderRadius: 12,
    padding: "14px 22px",
    color: "#1e293b",
    fontWeight: 600,
    fontSize: 15,
    zIndex: 9999,
    boxShadow: "0 8px 32px rgba(37,99,235,0.18)",
    backdropFilter: "blur(12px)",
    maxWidth: 420,
    textAlign: "center",
  } as CSSProperties,
  notifBtn: {
    background: "#fffbeb",
    border: "1px solid #fbbf24",
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 11,
    color: "#d97706",
    cursor: "pointer",
    fontWeight: 600,
  } as CSSProperties,
  notifActive: {
    background: "#f0fdf4",
    border: "1px solid #86efac",
    borderRadius: 999,
    padding: "4px 12px",
    fontSize: 11,
    color: "#16a34a",
    fontWeight: 600,
  } as CSSProperties,
}