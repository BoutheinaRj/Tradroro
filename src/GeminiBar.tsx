import { useState, useRef, useEffect } from "react"

const API = "http://localhost:8000"

function getSessionId(ctx: string): string {
  const key = `tradrly_session_${ctx}`
  let sid = localStorage.getItem(key)
  if (!sid) {
    sid = `${ctx}_${Date.now()}_${Math.random().toString(36).slice(2)}`
    localStorage.setItem(key, sid)
  }
  return sid
}

type Understanding = {
  intent?: string
  confidence?: number
  parameters?: Record<string, unknown>
  natural_response?: string
  notes?: string
  error?: string
}

type ActionResult = {
  executed?: boolean
  action?: string
  message?: string
  data?: unknown
}

type Props = {
  context: "tasks" | "events" | "focus" | "general"
  placeholder?: string
  onAction?: (action: string, data: unknown, executed: boolean) => void
  onRefresh?: () => void
}

const COLORS: Record<string, string> = {
  tasks:   "#2563eb",
  events:  "#7c3aed",
  focus:   "#0ea5e9",
  general: "#0d9488",
}

const EXEC_INTENTS = new Set([
  "create_task", "list_tasks", "update_task", "delete_task",
  "schedule_event", "list_events", "update_event", "delete_event",
  "start_focus", "stop_focus", "pause_focus", "resume_focus",
])

export default function GeminiBar({ context, placeholder, onAction, onRefresh }: Props) {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [understanding, setUnderstanding] = useState<Understanding | null>(null)
  const [action, setAction] = useState<ActionResult | null>(null)
  const [show, setShow] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error"; icon: string } | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState("")
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recognitionRef = useRef<any>(null)
  const voiceTranscriptRef = useRef("")  // Track current transcript
  const shouldSpeakResponseRef = useRef(false)  // Track if we should speak response
  const isRecordingIntentionallyRef = useRef(false)  // Track if user wants to keep recording
  const sessionId = useRef("")

  useEffect(() => { sessionId.current = getSessionId(context) }, [context])

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (SpeechRecognition) {
      const r = new SpeechRecognition()
      r.continuous = true
      r.interimResults = true
      r.onstart = () => {
        setIsRecording(true)
        isRecordingIntentionallyRef.current = true
      }
      r.onend = () => {
        setIsRecording(false)
        // Auto-restart if user still wants to record (mic stopped due to silence)
        if (isRecordingIntentionallyRef.current && recognitionRef.current) {
          setTimeout(() => {
            if (isRecordingIntentionallyRef.current) {
              recognitionRef.current!.start()
            }
          }, 100)
        }
      }
      r.onresult = (event: any) => {
        let transcript = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript
          transcript += t
        }
        setVoiceTranscript(transcript)
        voiceTranscriptRef.current = transcript
      }
      recognitionRef.current = r
    }
  }, [])

  function startRecording() {
    if (recognitionRef.current) {
      isRecordingIntentionallyRef.current = true  // Mark: user wants to record
      setVoiceTranscript("")
      recognitionRef.current.start()
    }
  }

  function stopRecording() {
    isRecordingIntentionallyRef.current = false  // Mark: stop recording
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      // Send the captured transcript when user releases button
      const transcript = voiceTranscriptRef.current.trim()
      if (transcript) {
        shouldSpeakResponseRef.current = true  // Mark: speak the response
        send(transcript)  // Fire & forget is ok here
        voiceTranscriptRef.current = ""  // Reset for next recording
        setVoiceTranscript("")
      }
    }
  }

  function speakResponse(text: string) {
    // Detect dominant language
    const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length
    const frenchCount = (text.match(/[àâäçèéêëîïôöùûüœæ]/gi) || []).length
    
    let detectedLang = "en-US"
    if (arabicCount > 2) {
      detectedLang = "ar-SA"
    } else if (frenchCount > 2 || text.match(/bonjour|salut|coucou|alors|très|merci|s'il|qu'est|c'est|ça|été/i)) {
      detectedLang = "fr-FR"
    }

    // For Arabic, skip Web Speech and go straight to gTTS (Windows rarely has Arabic voice)
    if (detectedLang === "ar-SA") {
      console.log("Detected Arabic - using gTTS for better support")
      useFallbackTTS(text, "ar")
      return
    }

    // Try Web Speech API for French & English
    const speechSupported = !!(
      (window as any).speechSynthesis ||
      (window as any).webkitSpeechSynthesis
    )

    if (speechSupported) {
      try {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = detectedLang
        
        // Tune pitch & rate per language
        if (detectedLang === "fr-FR") {
          utterance.pitch = 1.4
          utterance.rate = 0.85
        } else {
          utterance.pitch = 1.1
          utterance.rate = 0.9   // More natural for English
        }
        
        speechSynthesis.speak(utterance)
        console.log(`Speaking in ${detectedLang}`)
        return
      } catch (e) {
        console.warn("Web Speech API failed, trying gTTS fallback", e)
      }
    }

    // Fallback to gTTS
    const gttsLang = detectedLang === "fr-FR" ? "fr" : "en"
    useFallbackTTS(text, gttsLang)
  }

  function useFallbackTTS(text: string, lang: string) {
    try {
      fetch(`${API}/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
        .then(r => r.json())
        .then(data => {
          if (data.audio_base64) {
            const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`)
            audio.play().catch(e => console.error("gTTS playback failed", e))
            console.log(`gTTS playing: ${lang}`)
          }
        })
        .catch(e => console.warn("gTTS API unavailable", e))
    } catch (e) {
      console.warn("Speech output failed entirely", e)
    }
  }

  useEffect(() => {
    if (toast) {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => setToast(null), 4000)
    }
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [toast])

  const color = COLORS[context]

  async function send(text: string) {
    if (!text.trim()) return
    abortRef.current?.abort()
    if (timerRef.current) clearInterval(timerRef.current)

    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setShow(true)
    setUnderstanding(null)
    setAction(null)
    setCountdown(0)

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, context, session_id: sessionId.current }),
        signal: ctrl.signal,
      })
      const data = await res.json()
      const u: Understanding = data.understanding ?? {}
      const a: ActionResult | null = data.action ?? null

      const isQuota = u.notes?.includes("quota") || u.notes?.includes("429") ||
        u.natural_response?.includes("quota") || u.natural_response?.includes("429")

      if (isQuota) {
        setUnderstanding({ error: "rate_limit" })
        setCountdown(60)
        timerRef.current = setInterval(() => {
          setCountdown(p => {
            if (p <= 1) { clearInterval(timerRef.current!); return 0 }
            return p - 1
          })
        }, 1000)
      } else {
        setUnderstanding(u)
        setAction(a)
        // Speak response if voice mode was used
        if (u.natural_response && shouldSpeakResponseRef.current) {
          speakResponse(u.natural_response)
          shouldSpeakResponseRef.current = false  // Reset flag
        }
        if (a?.executed) {
          // Toast success notification
          setToast({
            message: a.message || "✅ Action executed",
            type: "success",
            icon: "✅",
          })
          // Callback to parent
          if (onAction) {
            onAction(a.action ?? "", a.data, true)
          }
          // Refresh data in parent (after a short delay)
          setTimeout(() => {
            if (onRefresh) onRefresh()
          }, 300)
        } else if (a && !a.executed) {
          // Toast error/info
          setToast({
            message: a.message || "ℹ️ Action not executed",
            type: "error",
            icon: "ℹ️",
          })
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return
      setUnderstanding({ error: "Server unavailable — make sure the backend is running on port 8000" })
    } finally {
      setLoading(false)
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { send(input); setInput("") }
  }

  const isExec = understanding?.intent && EXEC_INTENTS.has(understanding.intent)
  const pct = Math.round((understanding?.confidence ?? 0) * 100)
  const confColor = pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: "fixed",
          top: 16,
          right: 16,
          padding: "12px 16px",
          borderRadius: 8,
          background: toast.type === "success" ? "#10b981" : "#f59e0b",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: 8,
          animation: "slideIn 0.3s ease-out",
        }}>
          <span>{toast.icon}</span>
          {toast.message}
        </div>
      )}

      {/* Label Gemini */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase",
          color: color, background: `${color}12`, border: `1px solid ${color}33`,
          borderRadius: 4, padding: "2px 7px",
        }}>Gemini AI</span>
        <span style={{ fontSize: 11, color: "#64748b" }}>
          Speak freely — French, English or Arabic, no exact keywords needed
        </span>
      </div>

      {/* Barre de saisie */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", borderRadius: 10,
        background: "#ffffff",
        border: `1.5px solid ${color}55`,
        boxShadow: `0 2px 8px ${color}12`,
      }}>
        <span style={{ fontSize: 15 }}>✨</span>
        
        {/* Voix ou texte */}
        {isRecording ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600, animation: "pulse 1s infinite" }}>🎤 Recording...</span>
            <span style={{ color: "#64748b", fontSize: 13 }}>{voiceTranscript || "Listening..."}</span>
          </div>
        ) : (
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={placeholder ?? "Say anything in English, French or Arabic..."}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "#1e293b", fontSize: 14, fontFamily: "inherit", caretColor: color,
            }}
          />
        )}

        {/* Boutons d'action */}
        <div style={{ display: "flex", gap: 6 }}>
          {/* Bouton Voix */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            style={{
              border: "none", borderRadius: 7, padding: "5px 10px",
              background: isRecording ? "#ef4444" : `${color}22`,
              color: isRecording ? "#fff" : color,
              fontSize: 14,
              cursor: "pointer",
              fontWeight: 700,
              transition: "all 0.2s",
            }}
            title="Voice input"
          >
            {isRecording ? "⏹️" : "🎤"}
          </button>

          {/* Bouton Envoyer */}
          {(input.trim().length > 0 || (isRecording && voiceTranscript)) && (
            <button
              onClick={() => { send(input || voiceTranscript); setInput(""); setVoiceTranscript("") }}
              style={{
                border: "none", borderRadius: 7, padding: "5px 14px",
                background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                boxShadow: `0 2px 8px ${color}44`,
              }}
            >
              {loading ? "⏳" : "Send"}
            </button>
          )}
        </div>
      </div>

      {/* Panneau résultat */}
      {show && (
        <div style={{
          borderRadius: 12, border: `1px solid ${color}33`,
          background: "#ffffff",
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(37,99,235,0.10)",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "9px 14px", background: `${color}0d`,
            borderBottom: `1px solid ${color}22`,
          }}>
            <span style={{ color, fontWeight: 700, fontSize: 13 }}>✨ TRADRLY AI</span>
            <button onClick={() => { setShow(false); setUnderstanding(null); setAction(null) }}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
              ✕
            </button>
          </div>

          {/* Contenu */}
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 14px" }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  display: "inline-block", width: 7, height: 7, borderRadius: "50%",
                  background: color, animation: "pulse 1.2s ease-in-out infinite",
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
              <span style={{ color: "#64748b", fontSize: 13 }}>Gemini is thinking...</span>
            </div>
          ) : understanding?.error === "rate_limit" ? (
            <div style={{ padding: "12px 14px" }}>
              <div style={{ color: "#d97706", fontWeight: 600, fontSize: 13 }}>⏱️ Quota exceeded</div>
              {countdown > 0
                ? <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                    Retry in <strong style={{ color: "#d97706" }}>{countdown}s</strong>
                  </div>
                : <button onClick={() => send(input)} style={{
                    marginTop: 6, border: "none", borderRadius: 7, padding: "5px 12px",
                    background: color, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>🔄 Retry</button>
              }
            </div>
          ) : understanding?.error ? (
            <div style={{ color: "#dc2626", padding: "10px 14px", fontSize: 13 }}>⚠️ {understanding.error}</div>
          ) : understanding ? (
            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>

              {/* Réponse naturelle */}
              {understanding.natural_response && (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                }}>
                  <div style={{
                    flex: 1, padding: "10px 13px", borderRadius: 8,
                    border: `1px solid ${color}22`, background: `${color}08`,
                    color: "#1e293b", fontSize: 13, lineHeight: 1.55,
                  }}>
                    💬 {understanding.natural_response}
                  </div>
                  <button
                    onClick={() => speakResponse(understanding.natural_response!)}
                    style={{
                      border: "none", background: "none", cursor: "pointer",
                      fontSize: 16, padding: "2px 6px", color: color,
                    }}
                    title="Listen to response"
                  >
                    🔊
                  </button>
                </div>
              )}

              {/* Bannière action exécutée */}
              {action?.executed && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 13px", borderRadius: 8,
                  border: `1px solid ${color}44`, background: `${color}10`,
                }}>
                  <span style={{ fontSize: 16 }}>⚡</span>
                  <span style={{ color, fontWeight: 700, fontSize: 13 }}>{action.message}</span>
                </div>
              )}

              {/* Action non exécutée (message d'info) */}
              {!action?.executed && action?.message && (
                <div style={{ color: "#64748b", fontSize: 12, fontStyle: "italic" }}>ℹ️ {action.message}</div>
              )}

              {/* Intent + confiance */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{
                  padding: "3px 10px", borderRadius: 20,
                  border: `1px solid ${color}33`, color, fontWeight: 700, fontSize: 12,
                  background: `${color}0a`,
                }}>
                  {isExec ? "⚡" : "💬"} {understanding.intent ?? "—"}
                </span>
                {understanding.confidence != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 70, height: 5, background: "#e2e8f4", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: confColor, borderRadius: 4 }} />
                    </div>
                    <span style={{ color: confColor, fontWeight: 700, fontSize: 11 }}>{pct}%</span>
                  </div>
                )}
              </div>

              {/* Paramètres */}
              {understanding.parameters && Object.entries(understanding.parameters).some(([, v]) => v != null) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {Object.entries(understanding.parameters)
                    .filter(([, v]) => v != null)
                    .map(([k, v]) => (
                      <span key={k} style={{
                        padding: "2px 8px", borderRadius: 6, fontSize: 12,
                        border: `1px solid ${color}22`, background: `${color}08`,
                      }}>
                        <span style={{ color: "#94a3b8" }}>{k} </span>
                        <span style={{ color }}>{String(v)}</span>
                      </span>
                    ))}
                </div>
              )}

              {understanding.notes && (
                <div style={{ color: "#94a3b8", fontSize: 12, fontStyle: "italic" }}>ℹ️ {understanding.notes}</div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
