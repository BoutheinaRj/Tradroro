import { useState } from "react"

type ModuleKey = "tasks" | "calendar" | "focus"

type ModuleItem = {
  key: ModuleKey
  icon: string
  title: string
  desc: string
  accent: string
}

const MODULES: ModuleItem[] = [
  {
    key: "tasks",
    icon: "✅",
    title: "Tasks",
    desc: "Créez, suivez et complétez vos tâches.",
    accent: "#22d3ee",
  },
  {
    key: "calendar",
    icon: "📅",
    title: "Calendar",
    desc: "Planifiez vos événements et rappels.",
    accent: "#a78bfa",
  },
  {
    key: "focus",
    icon: "🎯",
    title: "Focus Mode",
    desc: "Lancez des sessions de concentration.",
    accent: "#34d399",
  },
]

export default function ProductivityHome({
  go,
}: {
  go: (v: ModuleKey) => void
}) {
  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <span style={styles.kicker}>ESPACE DE TRAVAIL</span>
          <h2 style={styles.title}>Productivity</h2>
          <p style={styles.subtitle}>
            Choisissez un module pour créer, consulter, modifier ou supprimer
            vos éléments.
          </p>
        </header>

        <div style={styles.grid}>
          {MODULES.map((m) => (
            <ModuleCard key={m.key} item={m} onClick={() => go(m.key)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ModuleCard({
  item,
  onClick,
}: {
  item: ModuleItem
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={cardStyle(item.accent, hover)}
    >
      <div style={iconWrapStyle(item.accent)}>
        <span style={styles.icon}>{item.icon}</span>
      </div>
      <div style={styles.cardBody}>
        <span style={styles.cardTitle}>{item.title}</span>
        <span style={styles.cardDesc}>{item.desc}</span>
      </div>
      <span style={arrowStyle(item.accent, hover)}>→</span>
    </button>
  )
}

// ---- Styles dynamiques ----
function cardStyle(accent: string, hover: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 16,
    width: "100%",
    textAlign: "left",
    padding: 18,
    borderRadius: 16,
    cursor: "pointer",
    background: hover ? "rgba(30,41,59,0.9)" : "rgba(30,41,59,0.45)",
    border: `1px solid ${hover ? accent : "#1e293b"}`,
    boxShadow: hover ? `0 8px 30px ${accent}22` : "none",
    transform: hover ? "translateY(-2px)" : "translateY(0)",
    transition: "all 0.18s ease",
    color: "#e2e8f0",
  }
}

function iconWrapStyle(accent: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    borderRadius: 12,
    background: `${accent}1a`,
    border: `1px solid ${accent}55`,
    flexShrink: 0,
  }
}

function arrowStyle(accent: string, hover: boolean): React.CSSProperties {
  return {
    marginLeft: "auto",
    fontSize: 20,
    color: accent,
    transform: hover ? "translateX(4px)" : "translateX(0)",
    transition: "transform 0.18s ease",
  }
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
    gap: 24,
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 2,
    color: "#22d3ee",
    fontWeight: 600,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: 0.5,
  },
  subtitle: {
    margin: 0,
    fontSize: 14,
    color: "#94a3b8",
    maxWidth: 460,
    lineHeight: 1.5,
  },
  grid: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  icon: {
    fontSize: 22,
  },
  cardBody: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
  },
  cardDesc: {
    fontSize: 13,
    color: "#94a3b8",
  },
}