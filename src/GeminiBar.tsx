import MicRounded from "@mui/icons-material/MicRounded"
import StopRounded from "@mui/icons-material/StopRounded"
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
  tasks:   "#f2645a",
  events:  "#f2645a",
  focus:   "#f2645a",
  general: "#f2645a",
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
  const [audioLevel, setAudioLevel] = useState(0)
  const [isVoiceDetected, setIsVoiceDetected] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recognitionRef = useRef<any>(null)
  const voiceTranscriptRef = useRef("")  // Track current transcript
  const shouldSpeakResponseRef = useRef(false)  // Track if we should speak response
  const isRecordingIntentionallyRef = useRef(false)  // Track if user wants to keep recording
  const isStartingRecognitionRef = useRef(false)
  const manualStopRef = useRef(false)
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restartAttemptsRef = useRef(0)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)  // Track gTTS audio to prevent overlap
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])           // Cached voices (loaded async)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioFrameRef = useRef<number | null>(null)
  const recordedChunksRef = useRef<Float32Array[]>([])
  const recordedSampleRateRef = useRef(44100)
  const sessionId = useRef("")

  function clearRestartTimeout() {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current)
      restartTimeoutRef.current = null
    }
  }

  function stopRecognitionLoop() {
    manualStopRef.current = true
    isRecordingIntentionallyRef.current = false
    isStartingRecognitionRef.current = false
    restartAttemptsRef.current = 0
    clearRestartTimeout()
    setIsRecording(false)
    stopAudioMonitor()
    releaseMicrophone()
  }

  function getRecognitionLanguage() {
    return navigator.languages?.find(Boolean) || navigator.language || "en-US"
  }

  function shouldUseBackendStt() {
    return isElectronShell()
  }

  function isElectronShell() {
    return navigator.userAgent.toLowerCase().includes("electron")
  }

  function stopAudioMonitor() {
    if (audioFrameRef.current !== null) {
      cancelAnimationFrame(audioFrameRef.current)
      audioFrameRef.current = null
    }

    processorRef.current?.disconnect()
    processorRef.current = null
    audioSourceRef.current?.disconnect()
    audioSourceRef.current = null
    analyserRef.current = null

    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined)
      audioContextRef.current = null
    }

    setAudioLevel(0)
    setIsVoiceDetected(false)
  }

  function releaseMicrophone() {
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

  async function transcribeRecordedAudio() {
    const merged = mergeAudioChunks(recordedChunksRef.current)
    recordedChunksRef.current = []

    if (!merged.length) {
      setToast({
        message: "No speech captured — try again and speak closer to the microphone",
        type: "error",
        icon: "❌"
      })
      return ""
    }

    const audioBlob = encodeWav(merged, recordedSampleRateRef.current)
    const formData = new FormData()
    formData.append("audio", audioBlob, "speech.wav")

    const response = await fetch(`${API}/api/stt?lang=${encodeURIComponent(getRecognitionLanguage())}`, {
      method: "POST",
      body: formData,
    })
    const payload = await response.json()

    if (!response.ok || !payload.success || !payload.text) {
      throw new Error(payload.error || "Speech transcription failed")
    }

    return String(payload.text).trim()
  }

  function startAudioMonitor(stream: MediaStream, captureForTranscription: boolean) {
    stopAudioMonitor()

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextCtor) return

    const audioContext = new AudioContextCtor()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.85

    const source = audioContext.createMediaStreamSource(stream)
    audioSourceRef.current = source
    source.connect(analyser)

    const buffer = new Uint8Array(analyser.fftSize)

    audioContextRef.current = audioContext
    analyserRef.current = analyser
    recordedSampleRateRef.current = audioContext.sampleRate
    recordedChunksRef.current = []

    if (captureForTranscription) {
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processor.onaudioprocess = (event) => {
        if (!isRecordingIntentionallyRef.current) return

        const channelData = event.inputBuffer.getChannelData(0)
        recordedChunksRef.current.push(new Float32Array(channelData))
      }
      source.connect(processor)
      processor.connect(audioContext.destination)
      processorRef.current = processor
    }

    const tick = () => {
      if (!analyserRef.current) return

      analyserRef.current.getByteTimeDomainData(buffer)

      let sum = 0
      for (let index = 0; index < buffer.length; index += 1) {
        const normalized = (buffer[index] - 128) / 128
        sum += normalized * normalized
      }

      const rms = Math.sqrt(sum / buffer.length)
      const nextLevel = Math.min(rms * 6, 1)
      setAudioLevel(nextLevel)
      setIsVoiceDetected(nextLevel > 0.08)

      audioFrameRef.current = requestAnimationFrame(tick)
    }

    audioFrameRef.current = requestAnimationFrame(tick)
  }

  async function ensureMicrophoneAccess() {
    if (mediaStreamRef.current && mediaStreamRef.current.active) {
      return mediaStreamRef.current
    }

    if (!navigator.mediaDevices?.getUserMedia) return null

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaStreamRef.current = stream
    return stream
  }

  useEffect(() => { sessionId.current = getSessionId(context) }, [context])

  // Pre-load TTS voices (getVoices() is async on first call)
  useEffect(() => {
    function loadVoices() {
      const v = speechSynthesis.getVoices()
      if (v.length > 0) voicesRef.current = v
    }
    loadVoices()
    speechSynthesis.onvoiceschanged = loadVoices
    return () => { speechSynthesis.onvoiceschanged = null }
  }, [])

  // Initialize Web Speech API with professional quality settings
  useEffect(() => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (SpeechRecognition) {
      const r = new SpeechRecognition()
      
      // Professional speech recognition settings
      r.continuous = true                     // Keep the session open while user is speaking
      r.interimResults = true                 // Show live transcription while speaking
      r.maxAlternatives = 1                   // Only need best result (faster, less noise)
      r.lang = getRecognitionLanguage()       // Start with the browser locale for better local accuracy
      
      r.onstart = () => {
        isStartingRecognitionRef.current = false
        restartAttemptsRef.current = 0
        clearRestartTimeout()
        setIsRecording(true)
        isRecordingIntentionallyRef.current = true
        console.log("🎤 Microphone started — listening...")
      }
      
      r.onend = () => {
        setIsRecording(false)
        isStartingRecognitionRef.current = false
        console.log("🎤 Microphone stopped")

        const shouldReconnect = isRecordingIntentionallyRef.current && !manualStopRef.current
        if (!shouldReconnect) return

        const attempt = restartAttemptsRef.current
        const backoffMs = Math.min(500 + attempt * 500, 3000)
        restartAttemptsRef.current = attempt + 1

        clearRestartTimeout()
        restartTimeoutRef.current = setTimeout(() => {
          if (!recognitionRef.current || manualStopRef.current || !isRecordingIntentionallyRef.current) return
          if (isStartingRecognitionRef.current || isRecording) return

          try {
            isStartingRecognitionRef.current = true
            recognitionRef.current.lang = getRecognitionLanguage()
            recognitionRef.current.start()
            console.log(`🎤 Reconnecting microphone (attempt ${restartAttemptsRef.current})...`)
          } catch (err) {
            isStartingRecognitionRef.current = false
            console.warn("Microphone reconnect ignored:", err)
          }
        }, backoffMs)
      }
      
      r.onresult = (event: any) => {
        let transcript = ""
        let isFinal = false
        
        // Collect all transcripts from result index
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const text = result[0].transcript
          transcript += text
          
          // Mark if this is a final result
          if (result.isFinal) {
            isFinal = true
          }
        }
        
        // Clean up whitespace and capitalize
        transcript = transcript.trim()
        if (transcript) {
          transcript = transcript.charAt(0).toUpperCase() + transcript.slice(1)
        }
        
        setVoiceTranscript(transcript)
        voiceTranscriptRef.current = transcript
        
        // Debug: log transcript quality
        if (isFinal) {
          console.log(`✅ Final transcript: "${transcript}"`)
        } else {
          console.log(`📝 Interim: "${transcript}"`)
        }
      }
      
      r.onerror = (event: any) => {
        isStartingRecognitionRef.current = false
        console.error(`❌ Microphone error: ${event.error}`)
        if (event.error === "network") {
          stopRecognitionLoop()
          setToast({
            message: isElectronShell()
              ? "Microphone ok, but speech transcription is unavailable in the Electron app. Test voice from Chrome or Edge on localhost:5173."
              : "Speech service unavailable — check internet, then retry the microphone",
            type: "error",
            icon: "❌"
          })
        } else if (event.error === "no-speech") {
          console.warn("No speech detected — make sure your microphone is working and not muted")
        } else if (event.error === "audio-capture") {
          stopRecognitionLoop()
          setToast({
            message: "No microphone input detected — check the selected device and mute state",
            type: "error",
            icon: "❌"
          })
        } else if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          stopRecognitionLoop()
          setToast({
            message: "Microphone permission denied — check browser settings",
            type: "error",
            icon: "❌"
          })
        }
      }
      
      recognitionRef.current = r
    }

    return () => {
      clearRestartTimeout()
      stopAudioMonitor()
      releaseMicrophone()
    }
  }, [])

  async function startRecording() {
    const useBackendStt = shouldUseBackendStt()

    if (!useBackendStt && !recognitionRef.current) {
      setToast({
        message: "Speech recognition is not available in this browser window",
        type: "error",
        icon: "❌"
      })
      return
    }

    if (isRecording || isStartingRecognitionRef.current) return

    manualStopRef.current = false
    isRecordingIntentionallyRef.current = true  // Mark: user wants to record
    setVoiceTranscript("")
    restartAttemptsRef.current = 0
    clearRestartTimeout()

    try {
      const stream = await ensureMicrophoneAccess()
      if (!stream) throw new Error("Microphone API unavailable")

      startAudioMonitor(stream, useBackendStt)

      if (useBackendStt) {
        setIsRecording(true)
        setToast({
          message: "Recording in Electron — release the microphone button to transcribe",
          type: "success",
          icon: "🎤"
        })
        return
      }

      recognitionRef.current.lang = getRecognitionLanguage()
      isStartingRecognitionRef.current = true
      recognitionRef.current.start()
    } catch (err: any) {
      stopRecognitionLoop()

      const denied = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"
      setToast({
        message: denied
          ? "Microphone permission denied — allow access and retry"
          : "Unable to access the microphone — check the selected input device",
        type: "error",
        icon: "❌"
      })
      console.warn("Microphone start failed:", err)
    }
  }

  async function stopRecording() {
    const useBackendStt = shouldUseBackendStt()

    manualStopRef.current = true
    isRecordingIntentionallyRef.current = false  // Mark: stop recording
    isStartingRecognitionRef.current = false
    restartAttemptsRef.current = 0
    clearRestartTimeout()

    if (!useBackendStt && recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (err) {
        console.warn("Microphone stop ignored:", err)
      }
      // Send the captured transcript when user releases button
      const transcript = voiceTranscriptRef.current.trim()
      if (transcript) {
        shouldSpeakResponseRef.current = true  // Mark: speak the response
        send(transcript)  // Fire & forget is ok here
        voiceTranscriptRef.current = ""  // Reset for next recording
        setVoiceTranscript("")
      }
    }

    if (useBackendStt) {
      setIsRecording(false)
      setVoiceTranscript("Transcribing...")

      try {
        const transcript = await transcribeRecordedAudio()
        if (transcript) {
          const normalizedTranscript = transcript.charAt(0).toUpperCase() + transcript.slice(1)
          voiceTranscriptRef.current = normalizedTranscript
          setVoiceTranscript(normalizedTranscript)
          shouldSpeakResponseRef.current = true
          await send(normalizedTranscript)
          voiceTranscriptRef.current = ""
          setVoiceTranscript("")
        }
      } catch (err: any) {
        setToast({
          message: err?.message || "Speech transcription failed in Electron",
          type: "error",
          icon: "❌"
        })
        console.warn("Electron transcription failed:", err)
      }
    }

    stopAudioMonitor()
    releaseMicrophone()
  }

  function speakResponse(text: string) {
    // Stop any ongoing speech before starting a new one (prevents double-click overlap)
    speechSynthesis.cancel()
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.currentTime = 0
      currentAudioRef.current = null
    }

    // Detect language more robustly
    const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length
    
    // Comprehensive English word list (common words + productivity domain)
    const EN_WORDS = /\b(the|a|an|and|or|but|is|are|was|were|been|be|have|has|had|do|does|did|will|would|should|could|can|may|might|must|i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|her|its|our|their|this|that|these|those|what|which|who|whom|where|when|why|how|with|from|to|of|in|on|at|by|for|as|about|into|through|after|before|between|up|down|out|off|over|under|above|below|task|tasks|event|events|meeting|meetings|call|calls|calendar|schedule|scheduled|done|completed|todo|focus|session|added|deleted|created|updated|marked|reminder|reminders|tomorrow|today|yesterday|week|month|year|time|date|minute|hour|morning|afternoon|evening|night)\b/gi
    
    // Comprehensive French word list
    const FR_WORDS = /\b(je|tu|il|elle|on|nous|vous|ils|elles|le|la|les|de|du|des|un|une|et|ou|mais|est|sont|a|ont|avoir|etre|with|pour|sur|dans|par|qui|que|quoi|où|quand|comment|pourquoi|bonjour|salut|merci|s'il vous plaît|oui|non|très|bien|aussi|donc|puis|ensuite|voici|voilà|j'ai|c'est|n'est|qu'il|qu'elle|tâche|tâches|événement|réunion|calendrier|agenda|ajouté|supprimé|créé|terminé|fait|en cours|réunion|rendez|rdv)\b/gi

    const frScore = (text.match(FR_WORDS) || []).length
    const enScore = (text.match(EN_WORDS) || []).length

    // Debug log pour vérifier la détection
    console.log(`TTS Language detection: EN=${enScore}, FR=${frScore}, Arabic=${arabicCount}`)

    let detectedLang = "en-US"
    if (arabicCount > 2) {
      detectedLang = "ar-SA"
    } else if (frScore > 0 && enScore === 0) {
      // Si du français et pas d'anglais → français
      detectedLang = "fr-FR"
    } else if (frScore > 0 && enScore > 0) {
      // Si mélange → utiliser le ratio
      if (frScore / enScore > 1.2) {
        // 20% plus de français → français
        detectedLang = "fr-FR"
      }
      // Sinon reste anglais par défaut
    }
    // Default to English if ambiguous or empty

    // For Arabic, skip Web Speech and go straight to gTTS (Windows rarely has Arabic voice)
    if (detectedLang === "ar-SA") {
      console.log("🔊 TTS: Detected Arabic — using gTTS fallback")
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

        // Use pre-cached voices (avoids empty array on first call)
        const allVoices = voicesRef.current.length > 0
          ? voicesRef.current
          : speechSynthesis.getVoices()

        if (detectedLang === "fr-FR") {
          const frVoice = allVoices.find(v => v.lang.startsWith("fr") && v.localService)
                       || allVoices.find(v => v.lang.startsWith("fr"))
          if (frVoice) utterance.voice = frVoice
          utterance.pitch = 1.4
          utterance.rate = 0.85
          console.log(`🔊 TTS: Speaking French — voice: ${utterance.voice?.name ?? "system default"}`)
        } else {
          // Force a real English voice — prefer en-US or en-GB native
          const enVoice = allVoices.find(v => v.lang === "en-US" && v.localService)
                       || allVoices.find(v => v.lang === "en-GB" && v.localService)
                       || allVoices.find(v => v.lang.startsWith("en-") && v.localService)
                       || allVoices.find(v => v.lang.startsWith("en"))
          if (enVoice) {
            utterance.voice = enVoice
            utterance.lang  = enVoice.lang
          }
          utterance.pitch = 1.0
          utterance.rate  = 0.95
          console.log(`🔊 TTS: Speaking English — voice: ${utterance.voice?.name ?? "system default"}`)
        }

        speechSynthesis.speak(utterance)
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
      // Stop previous gTTS audio if still playing
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current.currentTime = 0
        currentAudioRef.current = null
      }
      fetch(`${API}/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
        .then(r => r.json())
        .then(data => {
          if (data.audio_base64) {
            const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`)
            currentAudioRef.current = audio
            audio.onended = () => { currentAudioRef.current = null }
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: "fixed",
          top: 16,
          right: 16,
          padding: "12px 16px",
          borderRadius: 14,
          background: toast.type === "success" ? "#2fa36b" : "#f0a020",
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
          borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", flexShrink: 0,
        }}>Gemini AI</span>
        <span style={{ fontSize: 12, color: "#8b8395" }}>
          Parle librement — français, anglais ou arabe, sans mots-clés exacts
        </span>
      </div>

      {/* Barre de saisie */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "6px 6px 6px 18px", borderRadius: 999,
        background: "#fff5f3",
        border: `1.5px solid ${color}22`,
      }}>
        
        {/* Voix ou texte */}
        {isRecording ? (
          <div style={{ 
            flex: 1, 
            display: "flex", 
            alignItems: "center", 
            gap: 12,
            padding: "8px 14px",
            background: "#fef2f2",
            borderRadius: 999,
            border: "1px solid #fecaca",
            animation: "slideIn 0.3s ease-out"
          }}>
            {/* Animated microphone indicator with waveform effect */}
            <div style={{ 
              fontSize: 18, 
              animation: "micPulse 1.5s ease-in-out infinite",
              display: "flex",
              flexShrink: 0
            }}>
              🎤
            </div>
            
            {/* Transcript text with live update */}
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontSize: 13, 
                color: "#1e293b",
                fontWeight: 500,
                lineHeight: "1.4",
                maxHeight: 40,
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>
                {voiceTranscript || <span style={{ color: "#94a3b8", fontStyle: "italic" }}>{isVoiceDetected ? "Voice detected..." : "Listening..."}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <div style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 999,
                  background: "#fee2e2",
                  overflow: "hidden",
                }}>
                  <div style={{
                    width: `${Math.max(audioLevel * 100, 4)}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: isVoiceDetected
                      ? "linear-gradient(90deg, #ef4444, #f97316)"
                      : "linear-gradient(90deg, #fda4af, #fecaca)",
                    transition: "width 80ms linear, background 160ms ease",
                  }} />
                </div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isVoiceDetected ? "#b91c1c" : "#94a3b8",
                  whiteSpace: "nowrap",
                }}>
                  {isVoiceDetected ? "Voice detected" : "Waiting for voice"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={placeholder ?? "Say anything in English, French or Arabic..."}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "#2a2630", fontSize: 14, fontFamily: "inherit", caretColor: color, padding: "10px 0",
            }}
          />
        )}

        {/* Boutons d'action */}
        <div style={{ display: "flex", gap: 6 }}>
          {/* Bouton Voix - Professional design */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "8px 12px",
              background: isRecording 
                ? "linear-gradient(135deg, #ef4444, #dc2626)" 
                : color,
              color: "#fff",
              fontSize: isRecording ? 16 : 14,
              cursor: "pointer",
              fontWeight: 700,
              transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
              boxShadow: isRecording 
                ? "0 4px 12px rgba(239, 68, 68, 0.3)"
                : `0 6px 14px ${color}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 44,
              height: 44,
              whiteSpace: "nowrap",
            }}
            title={isRecording ? "Stop recording (Enter)" : "Start recording (hold or click)"}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)"
            }}
          >
            {isRecording ? <StopRounded /> : <MicRounded />}
          </button>

          {/* Bouton Envoyer */}
          {(input.trim().length > 0 || (isRecording && voiceTranscript)) && (
            <button
              onClick={() => { send(input || voiceTranscript); setInput(""); setVoiceTranscript("") }}
              style={{
                border: "none", borderRadius: 999, padding: "0 20px", height: 44,
                background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                boxShadow: `0 2px 8px ${color}44`,
              }}
            >
              {loading ? "⏳" : "Envoyer"}
            </button>
          )}
        </div>
      </div>

      {/* Panneau résultat */}
      {show && (
        <div style={{
          borderRadius: 18, border: `1px solid ${color}26`,
          background: "#ffffff",
          overflow: "hidden",
          boxShadow: "0 8px 24px rgba(242,100,90,0.10)",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "9px 14px", background: `${color}0d`,
            borderBottom: `1px solid ${color}22`,
          }}>
            <span style={{ color, fontWeight: 700, fontSize: 13 }}>✨ Tradroro AI</span>
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
              <span style={{ color: "#8b8395", fontSize: 13 }}>Gemini réfléchit…</span>
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
