import type { ReactNode } from "react"
import { Sticker, type StickerName } from "./stickers"

// Petits composants partagés par les pages (design coral)

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="13.5" r="8" fill="#fff" />
      <path d="M12 13.5V9.2" stroke="#f2645a" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 13.5l2.8 1.8" stroke="#f2645a" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 3.5c1.2.4 2.2 1.2 3 2.3.8-1.1 1.8-1.9 3-2.3" stroke="#bff0d4" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function PageHeader({
  kicker,
  title,
  sub,
  right,
  sticker,
}: {
  kicker: string
  title: string
  sub?: ReactNode
  right?: ReactNode
  sticker?: StickerName
}) {
  return (
    <header className="page-head">
      <div>
        <div className="page-kicker">{kicker}</div>
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {title}
          {sticker && <Sticker name={sticker} size={40} rotate={-10} />}
        </h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {right}
    </header>
  )
}

export function StatCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: ReactNode
  value: ReactNode
  label: string
  tone?: "leaf" | "amber" | "sky" | "violet"
}) {
  return (
    <div className="stat">
      <div className={"stat-icon" + (tone ? " " + tone : "")}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

export function Empty({
  icon,
  sticker,
  text,
  hint,
}: {
  icon?: ReactNode
  sticker?: StickerName
  text: string
  hint?: string
}) {
  return (
    <div className="empty">
      {sticker ? <Sticker name={sticker} size={72} rotate={-6} className="float" /> : <div className="empty-icon">{icon}</div>}
      <div>{text}</div>
      {hint && <div className="empty-hint">{hint}</div>}
    </div>
  )
}

/** Anneau Pomodoro avec graduations, inspiré du minuteur tomate. */
export function FocusRing({
  size = 280,
  progress,
  time,
  label,
}: {
  size?: number
  progress: number
  time: string
  label: string
}) {
  const stroke = Math.round(size * 0.055)
  const r = size / 2 - stroke - 10
  const c = 2 * Math.PI * r
  const ticks = Array.from({ length: 60 }, (_, i) => i)
  const p = Math.min(1, Math.max(0, progress))

  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {ticks.map((i) => {
          const a = (i / 60) * 2 * Math.PI
          const outer = size / 2 - 2
          const inner = outer - (i % 5 === 0 ? 8 : 4)
          return (
            <line
              key={i}
              x1={size / 2 + outer * Math.cos(a)}
              y1={size / 2 + outer * Math.sin(a)}
              x2={size / 2 + inner * Math.cos(a)}
              y2={size / 2 + inner * Math.sin(a)}
              stroke={i / 60 < p ? "#f2645a" : "#f3d9d4"}
              strokeWidth={i % 5 === 0 ? 2 : 1.2}
              strokeLinecap="round"
            />
          )
        })}
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#ffe9e5" strokeWidth={stroke} fill="none" />
        <circle
          className="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#f2645a"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
        />
      </svg>
      <div className="ring-center">
        <div className="ring-time" style={{ fontSize: Math.round(size * 0.2) }}>{time}</div>
        <div className="ring-label">{label}</div>
      </div>
    </div>
  )
}
