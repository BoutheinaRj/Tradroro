import type { CSSProperties, ReactNode } from "react"

// Autocollants décoratifs (SVG) dans le thème corail.
// Le contour blanc et l'ombre « sticker » viennent de la classe .sticker (styles.css).

export type StickerName =
  | "tomato"
  | "tomatoSleep"
  | "star"
  | "leaf"
  | "heart"
  | "check"
  | "clock"
  | "calendar"
  | "sparkle"
  | "coffee"

type Props = {
  name: StickerName
  size?: number
  rotate?: number
  className?: string
  style?: CSSProperties
}

export function Sticker({ name, size = 64, rotate = 0, className, style }: Props) {
  return (
    <span
      className={"sticker" + (className ? " " + className : "")}
      style={{ width: size, height: size, ["--rot" as string]: `${rotate}deg`, ...style }}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        {ART[name]}
      </svg>
    </span>
  )
}

const face = (y: number, sleepy = false): ReactNode => (
  <g>
    {sleepy ? (
      <>
        <path d={`M34 ${y} q5 4 10 0`} stroke="#2a2630" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d={`M56 ${y} q5 4 10 0`} stroke="#2a2630" strokeWidth="3" fill="none" strokeLinecap="round" />
      </>
    ) : (
      <>
        <ellipse cx="39" cy={y} rx="4" ry="5" fill="#2a2630" />
        <ellipse cx="61" cy={y} rx="4" ry="5" fill="#2a2630" />
        <circle cx="40.5" cy={y - 2} r="1.4" fill="#fff" />
        <circle cx="62.5" cy={y - 2} r="1.4" fill="#fff" />
      </>
    )}
    <ellipse cx="31" cy={y + 9} rx="5" ry="3" fill="#ff9e94" />
    <ellipse cx="69" cy={y + 9} rx="5" ry="3" fill="#ff9e94" />
    <path d={`M44 ${y + 9} q6 6 12 0`} stroke="#2a2630" strokeWidth="3" fill="none" strokeLinecap="round" />
  </g>
)

const leaves = (
  <g>
    <path d="M50 22 C44 12 34 12 28 18 C38 20 44 22 50 26 Z" fill="#2fa36b" />
    <path d="M50 22 C56 12 66 12 72 18 C62 20 56 22 50 26 Z" fill="#2fa36b" />
    <path d="M50 26 C46 18 46 14 50 10 C54 14 54 18 50 26 Z" fill="#46c486" />
    <path d="M50 12 v-6" stroke="#2fa36b" strokeWidth="4" strokeLinecap="round" />
  </g>
)

const ART: Record<StickerName, ReactNode> = {
  tomato: (
    <g>
      <path d="M50 24 C22 24 12 44 14 60 C16 80 32 92 50 92 C68 92 84 80 86 60 C88 44 78 24 50 24 Z" fill="#f2645a" />
      <path d="M26 44 C30 36 38 32 44 32" stroke="#ff9e94" strokeWidth="5" fill="none" strokeLinecap="round" />
      {leaves}
      {face(58)}
      <path d="M15 64 L6 58" stroke="#e04c42" strokeWidth="6" strokeLinecap="round" />
      <path d="M85 60 L94 50" stroke="#e04c42" strokeWidth="6" strokeLinecap="round" />
    </g>
  ),
  tomatoSleep: (
    <g>
      <path d="M50 26 C22 26 12 46 14 62 C16 82 32 92 50 92 C68 92 84 82 86 62 C88 46 78 26 50 26 Z" fill="#f2645a" />
      <path d="M26 46 C30 38 38 34 44 34" stroke="#ff9e94" strokeWidth="5" fill="none" strokeLinecap="round" />
      <g transform="translate(0 2)">{leaves}</g>
      {face(60, true)}
      <text x="72" y="26" fontSize="16" fontWeight="800" fill="#8a6ff0" fontFamily="sans-serif">z</text>
      <text x="82" y="14" fontSize="11" fontWeight="800" fill="#8a6ff0" fontFamily="sans-serif">z</text>
    </g>
  ),
  star: (
    <g>
      <path d="M50 8 L61 36 L91 38 L68 57 L76 87 L50 70 L24 87 L32 57 L9 38 L39 36 Z" fill="#ffc542" strokeLinejoin="round" />
      <path d="M50 20 L57 38" stroke="#ffe08a" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="42" cy="54" rx="3" ry="4" fill="#2a2630" />
      <ellipse cx="58" cy="54" rx="3" ry="4" fill="#2a2630" />
      <path d="M45 62 q5 5 10 0" stroke="#2a2630" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </g>
  ),
  leaf: (
    <g>
      <path d="M20 82 C16 44 40 16 84 14 C86 56 62 84 20 82 Z" fill="#46c486" />
      <path d="M22 80 C40 60 56 42 76 22" stroke="#2fa36b" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M44 56 L36 40 M56 44 L52 30 M40 62 L56 66 M54 50 L70 52" stroke="#2fa36b" strokeWidth="3" strokeLinecap="round" />
    </g>
  ),
  heart: (
    <g>
      <path d="M50 88 C22 68 8 52 10 34 C12 20 24 12 36 14 C43 15 48 20 50 26 C52 20 57 15 64 14 C76 12 88 20 90 34 C92 52 78 68 50 88 Z" fill="#ff7b8a" />
      <path d="M24 30 C26 24 30 22 34 22" stroke="#ffc2c9" strokeWidth="5" fill="none" strokeLinecap="round" />
    </g>
  ),
  check: (
    <g>
      <circle cx="50" cy="50" r="40" fill="#2fa36b" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#46c486" strokeWidth="6" strokeDasharray="40 220" strokeLinecap="round" transform="rotate(200 50 50)" />
      <path d="M30 51 L44 65 L71 36" stroke="#fff" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  clock: (
    <g>
      <path d="M18 24 L30 12" stroke="#e04c42" strokeWidth="8" strokeLinecap="round" />
      <path d="M82 24 L70 12" stroke="#e04c42" strokeWidth="8" strokeLinecap="round" />
      <circle cx="50" cy="54" r="36" fill="#f2645a" />
      <circle cx="50" cy="54" r="27" fill="#fff" />
      <path d="M50 54 V36" stroke="#2a2630" strokeWidth="5" strokeLinecap="round" />
      <path d="M50 54 L62 62" stroke="#f2645a" strokeWidth="5" strokeLinecap="round" />
      <circle cx="50" cy="54" r="4" fill="#2a2630" />
      <path d="M34 88 L28 94 M66 88 L72 94" stroke="#e04c42" strokeWidth="6" strokeLinecap="round" />
    </g>
  ),
  calendar: (
    <g>
      <rect x="14" y="20" width="72" height="68" rx="14" fill="#fff" />
      <path d="M14 34 C14 26 20 20 28 20 H72 C80 20 86 26 86 34 V42 H14 Z" fill="#f2645a" />
      <rect x="30" y="10" width="8" height="18" rx="4" fill="#2a2630" />
      <rect x="62" y="10" width="8" height="18" rx="4" fill="#2a2630" />
      <circle cx="34" cy="58" r="5" fill="#ffe2de" />
      <circle cx="50" cy="58" r="5" fill="#f2645a" />
      <circle cx="66" cy="58" r="5" fill="#ffe2de" />
      <circle cx="34" cy="74" r="5" fill="#ffe2de" />
      <circle cx="50" cy="74" r="5" fill="#ffe2de" />
      <circle cx="66" cy="74" r="5" fill="#ffc542" />
    </g>
  ),
  sparkle: (
    <g>
      <path d="M44 6 C48 30 54 38 78 42 C54 46 48 54 44 80 C40 54 34 46 10 42 C34 38 40 30 44 6 Z" fill="#ffc542" />
      <path d="M78 62 C80 72 82 74 92 76 C82 78 80 80 78 90 C76 80 74 78 64 76 C74 74 76 72 78 62 Z" fill="#ff7b8a" />
    </g>
  ),
  coffee: (
    <g>
      <path d="M38 20 c-4 -6 4 -8 0 -14 M52 20 c-4 -6 4 -8 0 -14" stroke="#c9bfd0" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M74 44 h6 a12 12 0 0 1 0 24 h-8" stroke="#8a6ff0" strokeWidth="7" fill="none" />
      <path d="M18 30 H78 V62 C78 78 66 88 50 88 H46 C30 88 18 78 18 62 Z" fill="#8a6ff0" />
      <rect x="18" y="30" width="60" height="10" fill="#a691f5" />
      {face(58)}
    </g>
  ),
}
