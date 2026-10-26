import { useEffect, useRef, useState } from "react"
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded"
import EventRounded from "@mui/icons-material/EventRounded"
import NotificationsActiveRounded from "@mui/icons-material/NotificationsActiveRounded"
import NotificationsOffRounded from "@mui/icons-material/NotificationsOffRounded"
import GeminiBar from "./GeminiBar"
import { Empty, PageHeader } from "./ui"
import { EventRow } from "./ProductivityHome"
import type { EventItem } from "./models"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin from "@fullcalendar/interaction"
import frLocale from "@fullcalendar/core/locales/fr"

const API = "http://localhost:8000"
// Alertes 5 minutes avant l'événement
const ALERT_BEFORE_MS = 5 * 60 * 1000

const headerToolbar = {
  left: "prev,next today",
  center: "title",
  right: "dayGridMonth,timeGridWeek,timeGridDay",
}

export default function CalendarView() {
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
              new Notification("📅 Tradroro — Rappel événement", {
                body: msg,
                icon: "/favicon.svg",
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

  const EVENT_COLORS = [
    { bg: "#fff0ed", border: "#f2645a", text: "#b8372e" },
    { bg: "#efeaff", border: "#8a6ff0", text: "#5a3fc0" },
    { bg: "#e3f6ec", border: "#2fa36b", text: "#1d6f48" },
    { bg: "#fff4dc", border: "#f0a020", text: "#9a6207" },
    { bg: "#e6efff", border: "#4f86e8", text: "#2a5bb5" },
  ]

  const calendarEvents = events.map((ev, i) => ({
    id: String(ev.id),
    title: ev.title,
    start: ev.start_at,
    end: ev.end_at ?? undefined,
    extendedProps: { colorIdx: i % EVENT_COLORS.length },
  }))

  function renderEventContent(info: any) {
    const idx  = info.event.extendedProps.colorIdx as number
    const col  = EVENT_COLORS[idx]
    const isTimeGrid = info.view.type.startsWith("timeGrid")
    return (
      <div style={{
        background: col.bg,
        borderLeft: `4px solid ${col.border}`,
        borderRadius: "0 10px 10px 0",
        padding: isTimeGrid ? "4px 8px" : "2px 6px",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 1,
        boxSizing: "border-box",
      }}>
        {info.timeText && (
          <span style={{ fontSize: 10, fontWeight: 700, color: col.border, letterSpacing: "0.03em" }}>
            {info.timeText}
          </span>
        )}
        <span style={{
          fontSize: isTimeGrid ? 12 : 11,
          fontWeight: 700,
          color: col.text,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: isTimeGrid ? "normal" : "nowrap",
          lineHeight: 1.3,
        }}>
          {info.event.title}
        </span>
      </div>
    )
  }

  const upcoming = [...events].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

  return (
    <div className="page">
      <style>{fcTheme}</style>

      {/* Toast alarme */}
      {toast && <div className="toast">{toast}</div>}

      <PageHeader
        kicker="Espace de travail"
        title="Calendrier"
        sticker="calendar"
        sub={`${events.length} événement${events.length !== 1 ? "s" : ""} planifié${events.length !== 1 ? "s" : ""}`}
        right={
          notifPerm === "granted" ? (
            <span className="pill leaf">
              <NotificationsActiveRounded style={{ fontSize: 16 }} /> Alertes actives
            </span>
          ) : (
            <button className="pill amber btn-like" onClick={requestNotifPermission}>
              <NotificationsOffRounded style={{ fontSize: 16 }} />
              {notifPerm === "denied" ? "Alertes bloquées" : "Activer les alertes"}
            </button>
          )
        }
      />

      <section className="card">
        <div className="card-head">
          <h3 className="card-title">
            <AutoAwesomeRounded /> Planifier avec Gemini
          </h3>
        </div>
        <GeminiBar context="events" placeholder="Réunion client demain 14h / Plan a call friday morning / Supprime tous les événements" onAction={handleGeminiAction} onRefresh={loadEvents} />
      </section>

      <section className="card">
          <div className="fc-coral">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridWeek"
              headerToolbar={headerToolbar}
              height={620}
              locale={frLocale}
              firstDay={1}
              buttonText={{ today: "Aujourd'hui", month: "Mois", week: "Semaine", day: "Jour" }}
              events={calendarEvents}
              eventContent={renderEventContent}
              eventMinHeight={40}
              dayMaxEvents={4}
              slotMinTime="07:00:00"
              slotMaxTime="22:00:00"
              allDayText="Journée"
              nowIndicator={true}
              moreLinkContent={(args) => `+${args.num} autres`}
            />
          </div>
      </section>

        <section className="card">
          <div className="card-head">
            <h3 className="card-title">
              <EventRounded /> Prochains événements
            </h3>
          </div>
          {upcoming.length === 0 ? (
            <Empty sticker="calendar" text="Aucun événement." hint='Essaie : "Réunion demain 10h"' />
          ) : (
            <div className="ev-list">
              {upcoming.map((ev) => (
                <EventRow key={ev.id} ev={ev} />
              ))}
            </div>
          )}
        </section>
    </div>
  )
}

// ---- Thème FullCalendar (coral) ----
const fcTheme = `
.fc-coral {
  --fc-border-color: #f6e2de;
  --fc-page-bg-color: transparent;
  --fc-neutral-bg-color: #fff5f3;
  --fc-today-bg-color: #fff0ed;
  --fc-now-indicator-color: #f2645a;
  color: #2a2630;
}
.fc-coral .fc { font-family: inherit; }
.fc-coral .fc-toolbar-title { font-size: 18px; font-weight: 800; color: #2a2630; text-transform: capitalize; }
.fc-coral .fc-col-header-cell { background: #fff; padding: 10px 0; border-bottom: 1px solid #f6e2de; }
.fc-coral .fc-col-header-cell-cushion {
  color: #8b8395; font-size: 12px; font-weight: 700; text-decoration: none;
  text-transform: uppercase; letter-spacing: 0.05em;
}
.fc-coral .fc-day-today .fc-col-header-cell-cushion { color: #f2645a; }
.fc-coral .fc-daygrid-day-number,
.fc-coral .fc-timegrid-slot-label-cushion { color: #8b8395; font-size: 12px; text-decoration: none; }
.fc-coral .fc-button {
  background: #fff5f3; border: none; color: #e04c42;
  text-transform: capitalize; font-weight: 700; font-size: 13px;
  box-shadow: none !important; border-radius: 999px !important; padding: 7px 14px; margin: 0 2px !important;
}
.fc-coral .fc-button:hover { background: #ffe2de; color: #e04c42; }
.fc-coral .fc-button-primary:disabled { background: #fff5f3; color: #e04c42; opacity: 0.5; }
.fc-coral .fc-button-primary:not(:disabled).fc-button-active,
.fc-coral .fc-button-primary:not(:disabled):active { background: #f2645a; color: #fff; }
.fc-coral .fc-event { border: none !important; background: transparent !important; box-shadow: none; cursor: pointer; }
.fc-coral .fc-event:hover > div { filter: brightness(0.97); box-shadow: 0 4px 12px rgba(242,100,90,0.18); }
.fc-coral .fc-daygrid-event { margin: 2px 2px; }
.fc-coral .fc-event-main { padding: 0 !important; }
.fc-coral .fc-more-link { font-size: 11px; font-weight: 700; color: #e04c42; padding: 2px 6px; border-radius: 6px; background: #fff0ed; }
.fc-coral .fc-timegrid-now-indicator-line { border-width: 2px; }
.fc-coral a { color: inherit; }
.fc-coral .fc-scrollgrid { border-radius: 16px; overflow: hidden; }
.fc-coral .fc-timegrid-axis-cushion { font-size: 11px; color: #8b8395; }
.fc-coral .fc-toolbar.fc-header-toolbar { margin-bottom: 18px; }
`
