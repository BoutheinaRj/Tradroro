import { useState } from "react"
import type React from "react"
import TasksView from "./TasksView"
import CalendarView from "./CalendarView"
import FocusView from "./FocusView"
import GeminiBar from "./GeminiBar"

type ModuleKey = "tasks" | "calendar" | "focus"

const MODULES = [
  {
    key: "tasks" as ModuleKey,
    icon: "✅",
    title: "Smart Tasks",
    desc: "Create, track and complete tasks.",
    accent: "#0051FF",
    badge: "Active",
  },
  {
    key: "calendar" as ModuleKey,
    icon: "📅",
    title: "Calendar",
    desc: "Plan events and get reminders.",
    accent: "#7c3aed",
    badge: null,
  },
  {
    key: "focus" as ModuleKey,
    icon: "🎯",
    title: "Focus Mode",
    desc: "Deep work with Pomodoro timer.",
    accent: "#0ea5e9",
    badge: null,
  },
]

export default function ProductivityHome({
  go,
}: {
  go?: (v: ModuleKey) => void
}) {
  const [activeModule, setActiveModule] = useState<ModuleKey | null>(null)

  function handleSelect(key: ModuleKey) {
    setActiveModule(key)
    go?.(key)
  }

  return (
    <div style={layout.root}>
      {/* ── Left: Module Navigation Sidebar ── */}
      <aside style={layout.sidebar}>
        <div style={layout.sideHeader}>
          <span style={layout.kicker}>WORKSPACE</span>
          <h2 style={layout.sideTitle}>Productivity</h2>
          <p style={layout.sideSubtitle}>
            Your smart workspace — tasks, calendar &amp; focus in one place.
          </p>
        </div>

        <div style={layout.divider} />

        <nav style={layout.navList}>
          {MODULES.map((m) => {
            const active = activeModule === m.key
            return (
              <NavItem
                key={m.key}
                icon={m.icon}
                title={m.title}
                desc={m.desc}
                accent={m.accent}
                badge={m.badge}
                active={active}
                onClick={() => handleSelect(m.key)}
              />
            )
          })}
        </nav>

        <div style={layout.sideFooter}>
          <div style={layout.footerLine}>
            <span style={layout.footerDot} />
            <span style={layout.footerText}>AI-powered productivity</span>
          </div>
        </div>
      </aside>

      {/* ── Right: Content Panel ── */}
      <main style={layout.content}>
        {activeModule === null ? (
          <WelcomePanel onSelect={handleSelect} />
        ) : activeModule === "tasks" ? (
          <TasksView back={() => setActiveModule(null)} />
        ) : activeModule === "calendar" ? (
          <CalendarView back={() => setActiveModule(null)} />
        ) : (
          <FocusView back={() => setActiveModule(null)} />
        )}
      </main>
    </div>
  )
}

// ── Nav Item ──
function NavItem({
  icon,
  title,
  desc,
  accent,
  badge,
  active,
  onClick,
}: {
  icon: string
  title: string
  desc: string
  accent: string
  badge: string | null
  active: boolean
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  const highlighted = active || hover

  return (
    <button
      style={navItemStyle(accent, active, hover)}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {active && <span style={activeBar(accent)} />}
      <span style={navIconStyle(accent, highlighted)}>{icon}</span>
      <div style={navTextWrap}>
        <div style={navTitleRow}>
          <span style={navTitleStyle(highlighted)}>{title}</span>
          {badge && <span style={badgeStyle(accent)}>{badge}</span>}
        </div>
        <span style={navDescStyle}>{desc}</span>
      </div>
      {active && <span style={activeDot(accent)} />}
    </button>
  )
}

// ── Welcome Screen ──
function WelcomePanel({ onSelect: _onSelect }: { onSelect: (k: ModuleKey) => void }) {
  return (
    <div style={welcome.root}>
      <div style={welcome.hero}>
        <div style={welcome.heroIcon}>🚀</div>
        <h3 style={welcome.heroTitle}>Welcome to your Workspace</h3>
        <p style={welcome.heroDesc}>
          Select a module from the sidebar to get started.
        </p>
      </div>

      {/* ── Universal AI Command Bar ── */}
      <div style={welcome.commandBar}>
        <div style={welcome.commandHeader}>
          <span style={welcome.commandKicker}>✨ UNIVERSAL AI ASSISTANT</span>
          <p style={welcome.commandHint}>
            Type any command — tasks, calendar or focus. Gemini understands English, French &amp; Arabic.
          </p>
        </div>
        <GeminiBar
          context="general"
          placeholder='Try: "Add task buy milk", "Schedule meeting with Sara tomorrow 3pm", "Start a 45 min focus"...'
        />
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// Styles
// ══════════════════════════════════════════

const layout: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    height: "100%",
    minHeight: 520,
    width: "100%",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    color: "#1e293b",
    overflow: "hidden",
    background: "#f0f4ff",
  },
  sidebar: {
    width: 240,
    minWidth: 200,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    background: "#ffffff",
    borderRight: "1px solid #e2e8f4",
    padding: "24px 12px 16px",
    overflowY: "auto",
    boxShadow: "2px 0 12px rgba(37,99,235,0.06)",
  },
  sideHeader: {
    paddingBottom: 0,
    marginBottom: 4,
    paddingLeft: 6,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 2,
    color: "#2563eb",
    fontWeight: 700,
    textTransform: "uppercase",
    display: "block",
    marginBottom: 6,
  },
  sideTitle: {
    margin: "0 0 4px",
    fontSize: 18,
    fontWeight: 800,
    color: "#1e293b",
    letterSpacing: 0.2,
  },
  sideSubtitle: {
    margin: 0,
    fontSize: 11,
    color: "#94a3b8",
    lineHeight: 1.5,
  },
  divider: {
    margin: "16px 0",
    height: 1,
    background: "#f1f5fe",
  },
  navList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flex: 1,
  },
  sideFooter: {
    marginTop: "auto",
    paddingTop: 14,
    borderTop: "1px solid #f1f5fe",
    paddingLeft: 6,
  },
  footerLine: {
    display: "flex",
    alignItems: "center",
    gap: 7,
  },
  footerDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#2563eb",
    boxShadow: "0 0 6px rgba(37,99,235,0.5)",
    flexShrink: 0,
  },
  footerText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 500,
  },
  content: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "#f0f4ff",
    minWidth: 0,
  },
}

// Nav item
function navItemStyle(
  accent: string,
  active: boolean,
  hover: boolean
): React.CSSProperties {
  return {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 10px 10px 12px",
    borderRadius: 10,
    cursor: "pointer",
    border: active
      ? `1px solid ${accent}33`
      : hover
      ? "1px solid #e2e8f4"
      : "1px solid transparent",
    background: active
      ? `${accent}0f`
      : hover
      ? "#f8faff"
      : "transparent",
    color: "#1e293b",
    width: "100%",
    textAlign: "left",
    transition: "all 0.15s ease",
    overflow: "hidden",
    boxShadow: active ? `0 2px 8px ${accent}18` : "none",
  }
}

function navIconStyle(accent: string, highlighted: boolean): React.CSSProperties {
  return {
    fontSize: 16,
    width: 34,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    background: highlighted ? `${accent}15` : "#f1f5fe",
    border: `1px solid ${highlighted ? accent + "33" : "#e2e8f4"}`,
    flexShrink: 0,
    transition: "all 0.15s ease",
  }
}

const navTextWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  flex: 1,
  minWidth: 0,
}

const navTitleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
}

function navTitleStyle(highlighted: boolean): React.CSSProperties {
  return {
    fontSize: 13,
    fontWeight: highlighted ? 700 : 500,
    color: highlighted ? "#1e293b" : "#64748b",
    transition: "color 0.15s ease",
    whiteSpace: "nowrap",
  }
}

const navDescStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
}

function badgeStyle(accent: string): React.CSSProperties {
  return {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: accent,
    background: `${accent}12`,
    border: `1px solid ${accent}33`,
    borderRadius: 4,
    padding: "1px 6px",
    textTransform: "uppercase",
  }
}

function activeBar(accent: string): React.CSSProperties {
  return {
    position: "absolute",
    left: 0,
    top: "20%",
    bottom: "20%",
    width: 3,
    borderRadius: 2,
    background: `linear-gradient(180deg, ${accent}, ${accent}88)`,
    boxShadow: `0 0 6px ${accent}66`,
  }
}

function activeDot(accent: string): React.CSSProperties {
  return {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: accent,
    boxShadow: `0 0 6px ${accent}88`,
    flexShrink: 0,
  }
}

// Welcome panel
const welcome: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    padding: "40px 28px",
    gap: 36,
  },
  hero: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
  },
  heroIcon: {
    fontSize: 52,
    marginBottom: 4,
    filter: "drop-shadow(0 4px 16px rgba(37,99,235,0.25))",
    lineHeight: 1,
  },
  heroTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
    color: "#1e293b",
    letterSpacing: 0.2,
  },
  heroDesc: {
    margin: 0,
    fontSize: 14,
    color: "#64748b",
    maxWidth: 340,
    lineHeight: 1.6,
  },
  commandBar: {
    width: "100%",
    maxWidth: 560,
    background: "#ffffff",
    border: "1px solid #e2e8f4",
    borderRadius: 16,
    padding: "18px 20px 14px",
    boxShadow: "0 4px 20px rgba(13,148,136,0.10)",
  },
  commandHeader: {
    marginBottom: 10,
  },
  commandKicker: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.2,
    color: "#0d9488",
    display: "block",
  },
  commandHint: {
    margin: "4px 0 0",
    fontSize: 12.5,
    color: "#64748b",
    lineHeight: 1.5,
  },
  grid: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
    maxWidth: 440,
  },
  cardBody: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1e293b",
  },
  cardDesc: {
    fontSize: 12,
    color: "#64748b",
  },
}

function welcomeCardStyle(
  accent: string,
  hover: boolean
): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "16px 18px",
    borderRadius: 14,
    cursor: "pointer",
    border: `1px solid ${hover ? accent + "44" : "#e2e8f4"}`,
    background: hover ? `${accent}08` : "#ffffff",
    color: "#1e293b",
    textAlign: "left",
    transition: "all 0.18s ease",
    transform: hover ? "translateX(5px)" : "translateX(0)",
    boxShadow: hover ? `0 4px 20px ${accent}18, 0 1px 6px rgba(0,0,0,0.06)` : "0 1px 4px rgba(37,99,235,0.07)",
    width: "100%",
  }
}

function welcomeCardIcon(accent: string): React.CSSProperties {
  return {
    fontSize: 22,
    width: 46,
    height: 46,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    background: `${accent}12`,
    border: `1px solid ${accent}33`,
    flexShrink: 0,
  }
}

function welcomeArrow(accent: string, hover: boolean): React.CSSProperties {
  return {
    marginLeft: "auto",
    fontSize: 18,
    color: accent,
    transform: hover ? "translateX(5px)" : "translateX(0)",
    transition: "transform 0.18s ease",
    flexShrink: 0,
    fontWeight: 700,
  }
}