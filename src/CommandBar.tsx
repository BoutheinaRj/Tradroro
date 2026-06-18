import { useState, useRef } from "react"

const API = "http://localhost:3001"
const GEMINI_API = "http://localhost:8000"

type IntentResult = {
  intent: string
  params?: Record<string, unknown>
  message?: string
}

type GeminiUnderstanding = {
  intent?: string
  context?: string
  confidence?: number
  parameters?: Record<string, unknown>
  natural_response?: string
  notes?: string
  error?: string
}

export default function CommandBar({
  onIntentDetected,
  onNavigate,
}: {
  onIntentDetected?: (intent: IntentResult) => void
  onNavigate?: (intent: IntentResult) => void
}) {
  const [input, setInput] = useState("")
  const [intent, setIntent] = useState<IntentResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [gemini, setGemini] = useState<GeminiUnderstanding | null>(null)
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [showGemini, setShowGemini] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function analyzeText(text: string) {
    if (!text.trim()) {
      setIntent(null)
      return
    }
    setIsAnalyzing(true)
    try {
      const r = await fetch(`${API}/api/parse-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      const data = (await r.json()) as IntentResult
      setIntent(data)
      // onIntentDetected uniquement sur Enter, pas au keystroke
    } catch {
      // silently fail
    } finally {
      setIsAnalyzing(false)
    }
  }

  function detectContext(text: string): string {
    const t = text.toLowerCase()
    if (t.includes("focus") || t.includes("pomodoro") || t.includes("concentr")) return "focus"
    if (t.includes("réunion") || t.includes("rendez") || t.includes("meet") || t.includes("event") || t.includes("calendrier") || t.includes("agenda") || t.includes("planifi")) return "events"
    return "tasks"
  }

  async function analyzeWithGemini(text: string) {
    if (!text.trim()) { setGemini(null); return }
    setGeminiLoading(true)
    setShowGemini(true)
    const ctx = detectContext(text)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000)
      const r = await fetch(`${GEMINI_API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, context: ctx, session_id: "productivity_home" }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = await r.json()
      const u = data.understanding ?? data
      setGemini(u)
      // Naviguer vers le bon module après exécution
      if (data.action?.executed && onNavigate) {
        onNavigate({ intent: u.intent ?? "unknown", params: u.parameters })
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") {
        setGemini({ error: "⏱️ Timeout — quota Gemini dépassé. Attendez 30s et réessayez." })
      } else {
        setGemini({ error: "Serveur API non disponible (port 8000)" })
      }
    } finally {
      setGeminiLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInput(val)
    if (val.trim().length > 3) analyzeText(val)
    else { setIntent(null); setGemini(null) }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && input.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      analyzeWithGemini(input)
      if (intent) onIntentDetected?.(intent)
      setInput("")
      setIntent(null)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.inputWrapper}>
        <span style={styles.icon}>🎤</span>
        <input
          type="text"
          placeholder="Tapez une commande et appuyez sur Entrée pour analyser avec Gemini..."
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          style={styles.input}
        />
        {(isAnalyzing || geminiLoading) && <span style={styles.spinner}>⏳</span>}
        {input.trim().length > 3 && (
          <button
            onClick={() => analyzeWithGemini(input)}
            style={styles.geminiBtn}
            title="Analyser avec Gemini"
          >
            ✨ Gemini
          </button>
        )}
      </div>

      {intent && (
        <div style={intentStyle(intent.intent)}>
          <span style={styles.intentLabel}>NLP:</span>
          <span style={styles.intentValue}>{intent.intent.replace(".", ": ")}</span>
          {intent.params && (
            <span style={styles.intentParams}>
              {JSON.stringify(intent.params).substring(0, 60).replace(/[{}]/g, "")}
            </span>
          )}
        </div>
      )}

      {showGemini && (
        <div style={styles.geminiPanel}>
          <div style={styles.geminiHeader}>
            <span style={styles.geminiTitle}>✨ Gemini LLM Understanding</span>
            <button onClick={() => setShowGemini(false)} style={styles.closeBtn}>✕</button>
          </div>

          {geminiLoading ? (
            <div style={styles.geminiLoading}>
              <span style={styles.loadingDot} />
              <span style={styles.loadingDot} />
              <span style={styles.loadingDot} />
              <span style={{ color: "#94a3b8", marginLeft: 8 }}>Gemini analyse...</span>
            </div>
          ) : gemini?.error ? (
            <div style={styles.geminiError}>⚠️ {gemini.error}</div>
          ) : gemini ? (
            <div style={styles.geminiBody}>
              <div style={styles.geminiRow}>
                <span style={styles.geminiKey}>Intention</span>
                <span style={{ ...styles.geminiVal, color: "#22d3ee", fontWeight: 700 }}>
                  {gemini.intent ?? "—"}
                </span>
              </div>
              <div style={styles.geminiRow}>
                <span style={styles.geminiKey}>Contexte</span>
                <span style={styles.geminiVal}>{gemini.context ?? "—"}</span>
              </div>
              <div style={styles.geminiRow}>
                <span style={styles.geminiKey}>Confiance</span>
                <span style={styles.geminiVal}>
                  <ConfidenceBar value={gemini.confidence} />
                </span>
              </div>
              {gemini.parameters && Object.keys(gemini.parameters).some(k => gemini.parameters![k]) && (
                <div style={styles.geminiRow}>
                  <span style={styles.geminiKey}>Paramètres</span>
                  <div style={styles.paramGrid}>
                    {Object.entries(gemini.parameters)
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k} style={styles.paramTag}>
                          <span style={styles.paramKey}>{k}</span>
                          <span style={styles.paramVal}>{String(v)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {gemini.natural_response && (
                <div style={styles.naturalResponse}>
                  💬 {gemini.natural_response}
                </div>
              )}
              {gemini.notes && (
                <div style={styles.geminiNotes}>ℹ️ {gemini.notes}</div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function ConfidenceBar({ value }: { value?: number }) {
  const pct = Math.round((value ?? 0) * 100)
  const color = pct >= 80 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#ef4444"
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 80, height: 6, background: "#1e2a4a", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ color, fontWeight: 600, fontSize: 12 }}>{pct}%</span>
    </div>
  )
}

function intentStyle(intent: string): React.CSSProperties {
  const colorMap: Record<string, string> = {
    "tasks.create": "#22d3ee", "tasks.list": "#22d3ee",
    "calendar.create": "#a78bfa", "calendar.list": "#a78bfa",
    "focus.start": "#34d399", unknown: "#ef4444",
  }
  const color = colorMap[intent] || "#94a3b8"
  return {
    padding: "8px 12px", borderRadius: 8, background: `${color}15`,
    border: `1px solid ${color}50`, display: "flex", gap: 8,
    alignItems: "center", fontSize: 12, color: "#e2e8f0",
    marginTop: 4, animation: "slideIn 0.2s ease",
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: 8 },
  inputWrapper: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 14px", borderRadius: 12,
    background: "rgba(30, 41, 59, 0.6)",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    transition: "all 0.2s ease",
  },
  input: {
    flex: 1, background: "transparent", border: "none", outline: "none",
    color: "#e2e8f0", fontSize: 14, fontFamily: "inherit", caretColor: "#22d3ee",
  },
  icon: { fontSize: 16 },
  spinner: { fontSize: 14 },
  geminiBtn: {
    background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
    border: "none", borderRadius: 8, color: "#fff",
    fontSize: 12, fontWeight: 600, cursor: "pointer",
    padding: "5px 10px", whiteSpace: "nowrap",
    transition: "opacity 0.2s",
  },
  intentLabel: { color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" },
  intentValue: { fontWeight: 600, color: "#e2e8f0" },
  intentParams: { color: "#94a3b8", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis" },
  geminiPanel: {
    borderRadius: 12, border: "1px solid rgba(99, 102, 241, 0.4)",
    background: "rgba(15, 23, 42, 0.85)", overflow: "hidden",
    animation: "slideIn 0.2s ease",
  },
  geminiHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 14px", borderBottom: "1px solid rgba(99, 102, 241, 0.2)",
    background: "rgba(99, 102, 241, 0.08)",
  },
  geminiTitle: { color: "#a5b4fc", fontWeight: 700, fontSize: 13, letterSpacing: "0.02em" },
  closeBtn: {
    background: "none", border: "none", color: "#64748b",
    cursor: "pointer", fontSize: 13, padding: "2px 4px",
  },
  geminiBody: { display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px" },
  geminiRow: { display: "flex", alignItems: "flex-start", gap: 12 },
  geminiKey: { color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", minWidth: 80, paddingTop: 2 },
  geminiVal: { color: "#e2e8f0", fontSize: 13 },
  paramGrid: { display: "flex", flexWrap: "wrap", gap: 6 },
  paramTag: {
    display: "flex", gap: 4, alignItems: "center",
    background: "rgba(34, 211, 238, 0.08)", border: "1px solid rgba(34, 211, 238, 0.2)",
    borderRadius: 6, padding: "2px 8px", fontSize: 12,
  },
  paramKey: { color: "#64748b" },
  paramVal: { color: "#22d3ee" },
  naturalResponse: {
    marginTop: 4, padding: "8px 10px", borderRadius: 8,
    background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.2)",
    color: "#c7d2fe", fontSize: 13, lineHeight: 1.5,
  },
  geminiNotes: { color: "#94a3b8", fontSize: 12, fontStyle: "italic", marginTop: 2 },
  geminiError: { color: "#f87171", padding: "10px 14px", fontSize: 13 },
  geminiLoading: {
    display: "flex", alignItems: "center", padding: "14px",
    gap: 4,
  },
  loadingDot: {
    width: 6, height: 6, borderRadius: "50%", background: "#6366f1",
    animation: "pulse 1.2s ease-in-out infinite",
  },
}
