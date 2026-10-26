import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import HomeRounded from "@mui/icons-material/HomeRounded"
import TaskAltRounded from "@mui/icons-material/TaskAltRounded"
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded"
import TimerRounded from "@mui/icons-material/TimerRounded"
import FavoriteRounded from "@mui/icons-material/FavoriteRounded"
import DesktopWindowsRounded from "@mui/icons-material/DesktopWindowsRounded"
import CodeRounded from "@mui/icons-material/CodeRounded"
import ForumRounded from "@mui/icons-material/ForumRounded"
import AutoModeRounded from "@mui/icons-material/AutoModeRounded"
import MicRounded from "@mui/icons-material/MicRounded"
import StopRounded from "@mui/icons-material/StopRounded"
import { DATA, findReply } from "./data"
import type { CategoryKey, ChatMessage } from "./types"
import ProductivityHome from "./ProductivityHome"
import TasksView from "./TasksView"
import CalendarView from "./CalendarView"
import FocusView from "./FocusView"
import { Logo, PageHeader } from "./ui"
import { Sticker } from "./stickers"

export type Page = "home" | "tasks" | "calendar" | "focus" | "chat"

const WORKSPACE: { key: Page; label: string; icon: ReactNode }[] = [
  { key: "home", label: "Accueil", icon: <HomeRounded /> },
  { key: "tasks", label: "Tâches", icon: <TaskAltRounded /> },
  { key: "calendar", label: "Calendrier", icon: <CalendarMonthRounded /> },
  { key: "focus", label: "Focus", icon: <TimerRounded /> },
]

const ASSISTANTS: { key: CategoryKey; label: string; desc: string; icon: ReactNode }[] = [
  { key: "comp", label: "Nova", desc: "Ton compagnon personnel — parle librement, Nova t'écoute.", icon: <FavoriteRounded /> },
  { key: "desktop", label: "Contrôle du bureau", desc: "Ouvre des apps, règle le son, gère tes fichiers.", icon: <DesktopWindowsRounded /> },
  { key: "dev", label: "Assistant dev", desc: "Explique, corrige et génère du code.", icon: <CodeRounded /> },
  { key: "comm", label: "Communication", desc: "Emails, Slack et résumés de réunions.", icon: <ForumRounded /> },
  { key: "auto", label: "Automatisation", desc: "Planifie des tâches répétitives.", icon: <AutoModeRounded /> },
]

function initialRoute(): { page: Page; cat: CategoryKey } {
  const [p, c] = window.location.hash.slice(1).split("/")
  const page = (["home", "tasks", "calendar", "focus", "chat"] as Page[]).find((k) => k === p) ?? "home"
  const cat = ASSISTANTS.find((a) => a.key === c)?.key ?? "comp"
  return { page, cat }
}

function getCompanionSessionId(): string {
  const key = "tradrly_companion_session"
  let sid = localStorage.getItem(key)
  if (!sid) {
    sid = `companion_${Date.now()}_${Math.random().toString(36).slice(2)}`
    localStorage.setItem(key, sid)
  }
  return sid
}

function mapCompanionMood(value: unknown): NonNullable<ChatMessage["emotion"]> {
  const mood = String(value || "").toLowerCase()
  if (mood.includes("joy") || mood.includes("happy") || mood.includes("positive")) return "happy"
  if (mood.includes("stress") || mood.includes("stresse")) return "stressed"
  if (mood.includes("triste") || mood.includes("negative") || mood.includes("sad")) return "negative"
  if (mood.includes("calm")) return "calm"
  if (mood.includes("pos")) return "positive"
  return "neutral"
}

export default function App() {
  // La page courante est gardée dans le hash (#tasks, #chat/comp…) pour survivre aux rechargements
  const [page, setPage] = useState<Page>(() => initialRoute().page)
  const [cat, setCat] = useState<CategoryKey>(() => initialRoute().cat)
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [typing, setTyping] = useState(false)
  const [status, setStatus] = useState("Online")
  const [val, setVal] = useState("")
  const [companionMood, setCompanionMood] = useState<NonNullable<ChatMessage["emotion"]>>("neutral")
  const [isListening, setIsListening] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef("")
  const stopRequestedRef = useRef(false)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioFrameRef = useRef<number | null>(null)
  const recordedChunksRef = useRef<Float32Array[]>([])
  const recordedSampleRateRef = useRef(44100)

  function isElectronShell() {
    return navigator.userAgent.toLowerCase().includes("electron")
  }

  function getRecognitionLanguage() {
    return navigator.languages?.find(Boolean) || navigator.language || "en-US"
  }

  function clearAudioCapture() {
    if (audioFrameRef.current !== null) {
      cancelAnimationFrame(audioFrameRef.current)
      audioFrameRef.current = null
    }

    processorRef.current?.disconnect()
    processorRef.current = null
    analyserRef.current = null
    audioSourceRef.current?.disconnect()
    audioSourceRef.current = null

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined)
      audioContextRef.current = null
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
  }

  function mergeAudioChunks(chunks: Float32Array[]) {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const merged = new Float32Array(totalLength)
    let offset = 0

    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }

    return merged
  }

  function encodeWav(samples: Float32Array, sampleRate: number) {
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)

    const writeString = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index))
      }
    }

    writeString(0, "RIFF")
    view.setUint32(4, 36 + samples.length * 2, true)
    writeString(8, "WAVE")
    writeString(12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeString(36, "data")
    view.setUint32(40, samples.length * 2, true)

    let offset = 44
    for (let index = 0; index < samples.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, samples[index]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }

    return new Blob([buffer], { type: "audio/wav" })
  }

  async function ensureMicrophoneAccess() {
    if (mediaStreamRef.current && mediaStreamRef.current.active) {
      return mediaStreamRef.current
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaStreamRef.current = stream
    return stream
  }

  function startElectronAudioCapture(stream: MediaStream) {
    clearAudioCapture()

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextCtor) return

    const audioContext = new AudioContextCtor()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    const processor = audioContext.createScriptProcessor(4096, 1, 1)
    const buffer = new Uint8Array(analyser.fftSize)

    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.85
    recordedChunksRef.current = []
    recordedSampleRateRef.current = audioContext.sampleRate

    processor.onaudioprocess = (event) => {
      if (!isListening) return
      const channelData = event.inputBuffer.getChannelData(0)
      recordedChunksRef.current.push(new Float32Array(channelData))
    }

    source.connect(analyser)
    source.connect(processor)
    processor.connect(audioContext.destination)

    audioContextRef.current = audioContext
    audioSourceRef.current = source
    analyserRef.current = analyser
    processorRef.current = processor

    const tick = () => {
      if (!analyserRef.current) return

      analyserRef.current.getByteTimeDomainData(buffer)
      let sum = 0
      for (let index = 0; index < buffer.length; index += 1) {
        const normalized = (buffer[index] - 128) / 128
        sum += normalized * normalized
      }
      const rms = Math.sqrt(sum / buffer.length)
      setStatus(rms > 0.08 ? "🎙️ Voix détectée…" : "🎙️ À l'écoute…")
      audioFrameRef.current = requestAnimationFrame(tick)
    }

    audioFrameRef.current = requestAnimationFrame(tick)
  }

  async function transcribeElectronAudio() {
    const merged = mergeAudioChunks(recordedChunksRef.current)
    recordedChunksRef.current = []

    if (!merged.length) return ""

    const formData = new FormData()
    formData.append("audio", encodeWav(merged, recordedSampleRateRef.current), "companion.wav")

    const response = await fetch(`http://localhost:8000/api/stt?lang=${encodeURIComponent(getRecognitionLanguage())}`, {
      method: "POST",
      body: formData,
    })
    const payload = await response.json()

    if (!response.ok || !payload.success || !payload.text) {
      throw new Error(payload.error || "Speech transcription failed")
    }

    return String(payload.text).trim()
  }

  function speakCompanionReply(text: string, lang: string = "en") {
    if (!text.trim()) return

    // Arabic → gTTS (browser TTS has no Arabic voice on Windows)
    if (lang === "ar") {
      fetch(`http://localhost:8000/api/tts?text=${encodeURIComponent(text)}&lang=ar`, { method: "POST" })
        .then((r) => r.json())
        .then((data) => {
          if (data.audio_base64) {
            const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`)
            audio.play().catch(() => {})
          }
        })
        .catch(() => {})
      return
    }

    if (!("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    const voices = window.speechSynthesis.getVoices()

    const preferredVoice =
      lang.startsWith("fr")
        ? voices.find((voice) => voice.lang.startsWith("fr") && voice.localService)
          || voices.find((voice) => voice.lang.startsWith("fr"))
        : voices.find((voice) => voice.lang === "en-US" && voice.localService)
          || voices.find((voice) => voice.lang === "en-GB" && voice.localService)
          || voices.find((voice) => voice.lang.startsWith("en") && voice.localService)
          || voices.find((voice) => voice.lang.startsWith("en"))

    utterance.lang = preferredVoice?.lang || (lang.startsWith("fr") ? "fr-FR" : "en-US")
    if (preferredVoice) utterance.voice = preferredVoice
    utterance.pitch = 1.0
    utterance.rate = 0.95

    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    if (cat === "comp") {
      // Companion mode: start with an empty chat so user can type freely.
      setMsgs([])
      return
    }

    if (cat === "desktop") {
      // Desktop control: free command mode via Gemini
      setMsgs([
        {
          who: "bot",
          text: `Contrôle du bureau prêt. Demande-moi n'importe quoi : ouvrir une app, régler le volume, gérer des fichiers…`,
        },
      ])
      return
    }

    setMsgs([
      {
        who: "bot",
        text: `Salut 👋 Choisis une commande ci-dessous ou écris la tienne.`,
      },
    ])
  }, [cat])

  useEffect(() => {
    window.location.hash = page === "chat" ? `chat/${cat}` : page
  }, [page, cat])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [msgs, typing])

  useEffect(() => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.lang = "en-US"

    recognition.onstart = () => {
      setIsListening(true)
      stopRequestedRef.current = false
      transcriptRef.current = ""
      setStatus("🎙️ À l'écoute…")
    }

    recognition.onresult = (event: any) => {
      let transcript = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      transcript = transcript.trim()
      transcriptRef.current = transcript
      setVal(transcript)
    }

    recognition.onerror = (event: any) => {
      console.error("Microphone error:", event.error)
      setIsListening(false)
      setStatus("Online")
    }

    recognition.onend = () => {
      setIsListening(false)
      setStatus("Online")
      const transcript = transcriptRef.current.trim()
      if (!stopRequestedRef.current && transcript) {
        setVal(transcript)
      }
      if (stopRequestedRef.current && transcript) {
        send(transcript)
      }
    }

    recognitionRef.current = recognition

    return () => {
      try {
        recognition.stop()
      } catch {
        // ignore
      }
      clearAudioCapture()
    }
  }, [])

 function send(text: string) {
  if (!text.trim()) return;
  setMsgs((m) => [...m, { who: "user", text }]);
  setVal("");
  setTyping(true);
  setStatus("En train d'écrire…");

  const isCompanion = cat === "comp"
  const isDesktop = cat === "desktop"

  // Dev / Communication / Automatisation : assistants de démo, réponses simulées (data.ts)
  if (!isCompanion && !isDesktop) {
    window.setTimeout(() => {
      setTyping(false);
      setStatus("Online");
      setMsgs((m) => [...m, { who: "bot", text: findReply(text) }]);
    }, 900);
    return
  }

  const context = isCompanion ? "general" : "tasks"
  const API_URL = isCompanion
    ? "http://localhost:8000/api/chat/companion"
    : isDesktop
    ? "http://localhost:8000/api/desktop/control"
    : "http://localhost:8000/productivity/execute"

  const payload = isCompanion || isDesktop
    ? { text, context, session_id: getCompanionSessionId() }
    : { text, context }

  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((data) => {
      let botText: string
      let botLang: string
      let botEmotion: NonNullable<ChatMessage["emotion"]> | undefined
      
      if (isCompanion) {
        botText = data.reply || "Je suis la. Dis-moi ce que tu veux partager."
        botLang = String(data.lang || "en")
        botEmotion = mapCompanionMood(data.emotion)
      } else if (isDesktop) {
        botText = data.message || "I didn't understand the command."
        botLang = "en"
        botEmotion = undefined
      } else {
        botText = data.message || "I didn't understand."
        botLang = "en"
        botEmotion = undefined
      }
      
      window.setTimeout(() => {
        setTyping(false);
        setStatus("Online");
        if (isCompanion && botEmotion) {
          setCompanionMood(botEmotion)
        }
        setMsgs((m) => [...m, { who: "bot", text: botText, emotion: botEmotion }]);
        if (isCompanion) {
          speakCompanionReply(botText, botLang)
        }
      }, 900);
    })
    .catch(() => {
      window.setTimeout(() => {
        setTyping(false);
        setStatus("Online");
        let reply: string
        if (isCompanion) {
          reply = "Nova est indisponible pour le moment. Verifie que le backend est relance et reessaie."
        } else if (isDesktop) {
          reply = "🖥️ Desktop control is offline. Please check the backend."
        } else {
          reply = findReply(text)
        }
        setMsgs((m) => [...m, { who: "bot", text: reply, emotion: isCompanion ? "negative" : undefined }]);
      }, 900);
    });
}
  async function mic() {
    if (cat !== "comp" && cat !== "desktop") {
      setStatus("🎙️ À l'écoute…")
      const items = DATA[cat].items
      const ex = items[Math.floor(Math.random() * items.length)]
      window.setTimeout(() => send(ex.cmd), 700)
      return
    }

    if (isElectronShell()) {
      if (isListening) {
        setIsListening(false)
        setStatus("Transcription…")
        clearAudioCapture()

        try {
          const transcript = await transcribeElectronAudio()
          if (transcript) {
            setVal(transcript)
            send(transcript)
          } else {
            setStatus("Online")
          }
        } catch (err) {
          console.warn("Electron companion transcription failed:", err)
          setStatus("Transcription indisponible")
        }
        return
      }

      try {
        const stream = await ensureMicrophoneAccess()
        setIsListening(true)
        transcriptRef.current = ""
        setStatus("🎙️ À l'écoute…")
        startElectronAudioCapture(stream)
      } catch (err) {
        console.warn("Electron companion microphone failed:", err)
        setStatus("Micro indisponible")
      }
      return
    }

    if (!recognitionRef.current) {
      setStatus("Micro indisponible")
      return
    }

    if (isListening) {
      stopRequestedRef.current = true
      try {
        recognitionRef.current.stop()
      } catch (err) {
        console.warn("Microphone stop ignored:", err)
      }
      return
    }

    stopRequestedRef.current = false
    transcriptRef.current = ""
    try {
      recognitionRef.current.start()
    } catch (err) {
      console.warn("Microphone start ignored:", err)
    }
  }

  const assistant = ASSISTANTS.find((a) => a.key === cat) ?? ASSISTANTS[0]

  function openAssistant(k: CategoryKey) {
    setCat(k)
    setPage("chat")
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className={"brand-mark" + (typing ? " talk" : "")}>
            <Logo />
          </div>
          <div>
            <div className="brand-name">Tradroro</div>
            <div className="brand-sub">Pomodoro &amp; productivité</div>
          </div>
        </div>

        <div className="nav-label">Espace de travail</div>
        {WORKSPACE.map((n) => (
          <button
            key={n.key}
            className={"nav-item" + (page === n.key ? " active" : "")}
            onClick={() => setPage(n.key)}
          >
            {n.icon}
            {n.label}
          </button>
        ))}

        <div className="nav-label">Assistants</div>
        {ASSISTANTS.map((a) => (
          <button
            key={a.key}
            className={"nav-item" + (page === "chat" && cat === a.key ? " active" : "")}
            onClick={() => openAssistant(a.key)}
          >
            {a.icon}
            {a.label}
          </button>
        ))}

        <div className="mascot-card">
          <Sticker name="tomato" size={46} rotate={-8} className="float" />
          <span>Une tâche à la fois, tu gères !</span>
        </div>

        <div className="sidebar-foot">
          <span className="online-dot" />
          Gemini AI · {status === "Online" ? "en ligne" : status}
        </div>
      </aside>

      <main className="main">
        {page === "home" ? (
          <ProductivityHome go={setPage} />
        ) : page === "tasks" ? (
          <TasksView />
        ) : page === "calendar" ? (
          <CalendarView />
        ) : page === "focus" ? (
          <FocusView />
        ) : (
          <div className="page">
            <PageHeader kicker="Assistant" title={assistant.label} sub={assistant.desc} sticker={cat === "comp" ? "heart" : "sparkle"} />

            <div className="chatwrap" data-led-state={cat === "comp" ? companionMood : undefined}>
              <div className="chead">
                {cat === "comp" ? (
                  <div className={`nova-avatar ${companionMood} ${typing ? "talk" : ""}`} data-led-state={companionMood} aria-label="Nova avatar" title="Nova">
                    <span className="nova-orb" />
                    <span className="nova-face">
                      <span className="nova-eye" />
                      <span className="nova-eye" />
                    </span>
                  </div>
                ) : (
                  <div className="chead-icon">{assistant.icon}</div>
                )}
                <div>
                  <strong>{assistant.label}</strong>
                  <span className="status">
                    <span className="online-dot" /> {status === "Online" ? "En ligne" : status}
                  </span>
                </div>
              </div>

              <div className="chat" ref={chatRef}>
                {msgs.length === 0 && (
                  <div className="empty" style={{ margin: "auto" }}>
                    <Sticker name="heart" size={80} rotate={-8} className="float" />
                    <div>Comment te sens-tu aujourd'hui ?</div>
                    <div className="empty-hint">Écris ou utilise le micro — français, anglais ou arabe.</div>
                  </div>
                )}
                {msgs.map((m, i) => (
                  <div
                    key={i}
                    className={"msg " + m.who + (cat === "comp" && m.who === "bot" && m.emotion ? ` mood-${m.emotion}` : "")}
                    data-emotion={m.emotion ?? "neutral"}
                  >
                    {m.text}
                  </div>
                ))}
                {typing && (
                  <div className="msg bot typing">
                    <span />
                    <span />
                    <span />
                  </div>
                )}
              </div>

              {cat !== "comp" && cat !== "desktop" && (
                <div className="sugg">
                  {DATA[cat].items.map((it, i) => (
                    <button key={i} className="chip" onClick={() => send(it.cmd)}>
                      {it.cmd}
                    </button>
                  ))}
                </div>
              )}

              <div className="inputbar">
                <input
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") send(val)
                  }}
                  placeholder={
                    cat === "comp"
                      ? "Écris librement… Nova t'écoute."
                      : cat === "desktop"
                      ? "Dis-moi quoi faire sur ton bureau…"
                      : "Écris ou choisis une commande…"
                  }
                />
                <button className={"mic" + (cat === "comp" && isListening ? " mic-listening" : "")} onClick={mic} title={cat === "comp" ? (isListening ? "Arrêter l'écoute" : "Dicter au micro") : "Parler"}>
                  {cat === "comp" && isListening ? <StopRounded /> : <MicRounded />}
                </button>
                <button className="btn" onClick={() => send(val)}>
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
