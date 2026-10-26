// Types renvoyés par l'API Python (port 8000)

export type Task = {
  id: number
  title: string
  status: string
  priority: number
  priority_label: string
  assignee?: string
  deadline?: string
  description?: string
  created_at?: string
}

export type EventItem = {
  id: number
  title: string
  start_at: string
  end_at?: string | null
}

export type FocusSession = {
  id: number
  minutes: number
  status: string
  started_at: string
  ended_at?: string | null
}

/** Classe de pastille selon la priorité (5 = urgent … 1 = faible). */
export function priorityTone(priority: number): string {
  if (priority >= 5) return ""
  if (priority === 4) return "amber"
  if (priority === 3) return "violet"
  if (priority === 2) return "sky"
  return "muted"
}
