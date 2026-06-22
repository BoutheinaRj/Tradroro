// Types partages de l'application TRADRLY BOT

export type CategoryKey =
  | "desktop"
  | "dev"
  | "prod"
  | "comm"
  | "auto"
  | "comp"

export interface CommandItem {
  /** Commande vocale prononcee par l'utilisateur */
  cmd: string
  /** Reponse simulee du bot */
  res: string
}

export interface Category {
  name: string
  icon: string
  items: CommandItem[]
}

export type CategoryMap = Record<CategoryKey, Category>

export interface ChatMessage {
  who: "bot" | "user"
  text: string
  emotion?: "neutral" | "positive" | "negative" | "stressed" | "calm" | "happy"
}
