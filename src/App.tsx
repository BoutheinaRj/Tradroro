import { useEffect, useRef, useState } from "react"
import { DATA, findReply } from "./data"
import type { CategoryKey, ChatMessage } from "./types"
import ProductivityHome from "./ProductivityHome"
import TasksView from "./TasksView"
import CalendarView from "./CalendarView"
import FocusView from "./FocusView"

export default function App() {
  const [cat, setCat] = useState<CategoryKey>("desktop")
  const [prodView, setProdView] = useState<"home" | "tasks" | "calendar" | "focus">("home")
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [typing, setTyping] = useState(false)
  const [status, setStatus] = useState("Online")
  const [val, setVal] = useState("")
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMsgs([
      {
        who: "bot",
        text: `Hi 👋 I'm TRADRLY BOT. Pick a "${DATA[cat].name}" command below.`,
      },
    ])
    setProdView("home")
  }, [cat])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [msgs, typing])

 function send(text: string) {
  if (!text.trim()) return;
  setMsgs((m) => [...m, { who: "user", text }]);
  setVal("");
  setTyping(true);
  setStatus("Typing...");

  // 🔥 Déterminer le contexte en fonction de la catégorie
  let context = "tasks"; // par défaut
  if (cat === "prod") {
    // Si on est dans la vue prod, utiliser le sous‑menu actif
    if (prodView === "tasks") context = "tasks";
    else if (prodView === "calendar") context = "calendar";
    else if (prodView === "focus") context = "focus";
    else context = "tasks"; // home -> tasks par défaut
  } else {
    // Pour les autres catégories (desktop, dev, etc.), on peut mettre "tasks" par défaut
    // ou gérer selon le besoin, mais pour l'instant on laisse "tasks"
    context = "tasks";
  }

  // 🔥 URL du backend (port 8000)
  const API_URL = "http://localhost:8000/productivity/execute";

  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, context }),
  })
    .then((res) => res.json())
    .then((data) => {
      window.setTimeout(() => {
        setTyping(false);
        setStatus("Online");
        setMsgs((m) => [...m, { who: "bot", text: data.message || "Je n’ai pas compris." }]);
      }, 900);
    })
    .catch(() => {
      window.setTimeout(() => {
        setTyping(false);
        setStatus("Online");
        const reply = findReply(text);
        setMsgs((m) => [...m, { who: "bot", text: reply }]);
      }, 900);
    });
}
  function mic() {
    setStatus("🎙️ Listening...")
    const items = DATA[cat].items
    const ex = items[Math.floor(Math.random() * items.length)]
    window.setTimeout(() => send(ex.cmd), 700)
  }

  return (
    <div className="wrap">
      <header className="hero">
        <div className={"avatar" + (typing ? " talk" : "")}>
          <div className="face">
            <span className="eye" />
            <span className="eye" />
          </div>
        </div>
        <div>
          <div className="eyebrow">React + TS demo • Desktop AI assistant</div>
          <h1>TRADRLY BOT</h1>
          <p className="sub">Your smart companion that understands, speaks, and acts.</p>
        </div>
      </header>

      <div className="pills">
        <span className="pill">🎙️ 100% voice control</span>
        <span className="pill">🧠 Advanced AI (GPT-4o)</span>
        <span className="pill">😊 Emotional presence</span>
        <span className="pill">🔒 Privacy respected</span>
      </div>

      <div className="app">
        <aside className="side">
          <h3>Categories</h3>
          {(Object.keys(DATA) as CategoryKey[]).map((k) => (
            <button
              key={k}
              className={"cat" + (k === cat ? " active" : "")}
              onClick={() => setCat(k)}
            >
              <span>{DATA[k].icon}</span> {DATA[k].name}
            </button>
          ))}
        </aside>
        {cat === "prod" ? (
          prodView === "home" ? (
            <ProductivityHome go={(view) => setProdView(view)} />
          ) : prodView === "tasks" ? (
            <TasksView back={() => setProdView("home")} />
          ) : prodView === "calendar" ? (
            <CalendarView back={() => setProdView("home")} />
          ) : (
            <FocusView back={() => setProdView("home")} />
          )
        ) : (
          <div className="chatwrap">
            <div className="chead">
              <span className="dot" />
              <strong>{DATA[cat].name}</strong>
              <span className="status">{status}</span>
            </div>

            <div className="chat" ref={chatRef}>
              {msgs.map((m, i) => (
                <div key={i} className={"msg " + m.who}>
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

            <div className="sugg">
              {DATA[cat].items.map((it, i) => (
                <button key={i} className="chip" onClick={() => send(it.cmd)}>
                  {"« " + it.cmd + " »"}
                </button>
              ))}
            </div>

            <div className="inputbar">
              <input
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send(val)
                }}
                placeholder="Type or click a command..."
              />
              <button className="mic" onClick={mic} title="Speak">
                🎙️
              </button>
              <button className="btn" onClick={() => send(val)}>
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="foot">
        TRADRLY BOT — React + TypeScript prototype.
      </p>
    </div>
  )
}
