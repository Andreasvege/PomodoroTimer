// Pure timer logic, extracted so it can be unit-tested without React.

export type Mode = 'work' | 'shortBreak' | 'longBreak'

/** Two-digit zero-padded string, e.g. 5 -> "05". */
export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local calendar day (YYYY-MM-DD) so daily stats roll over at the user's midnight. */
export function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** True only for an object with positive, finite durations for all three modes. */
export function isValidDurations(d: unknown): d is Record<Mode, number> {
  if (!d || typeof d !== 'object') return false
  const r = d as Record<string, unknown>
  return (['work', 'shortBreak', 'longBreak'] as const).every(
    k => typeof r[k] === 'number' && Number.isFinite(r[k] as number) && (r[k] as number) > 0,
  )
}

/**
 * The session that follows `completed`. After a focus session, take a long
 * break every `roundLength`th session, otherwise a short break; after any
 * break, return to focus. `sessionsAfter` is the focus count *including* the
 * one just finished.
 */
export function nextMode(completed: Mode, sessionsAfter: number, roundLength: number): Mode {
  if (completed === 'work') {
    return sessionsAfter % roundLength === 0 ? 'longBreak' : 'shortBreak'
  }
  return 'work'
}

/** Clamp a minute value to the editable range (1–99). */
export function clampMinutes(n: number): number {
  return Math.min(99, Math.max(1, Math.round(n)))
}

/** Clamp the long-break interval to its allowed range (2–8 sessions). */
export function clampRound(n: number): number {
  return Math.min(8, Math.max(2, Math.round(n)))
}
