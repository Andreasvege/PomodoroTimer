// Session-end sound + browser notifications for the Pomodoro timer.
// Self-contained so the component stays focused. Everything fails silently
// when the browser lacks Web Audio / Notification support or permission.

export type Mode = 'work' | 'shortBreak' | 'longBreak'

// Two-tone sequences keyed by the mode that JUST finished.
// Focus done -> bright, rising (relief into a break).
// Break done -> deeper, settling (back into focus).
const TONES: Record<Mode, [number, number]> = {
  work: [660, 880],
  shortBreak: [440, 330],
  longBreak: [392, 294],
}

const MESSAGES: Record<Mode, { title: string; body: string }> = {
  work: { title: 'Focus complete', body: 'Time for a break.' },
  shortBreak: { title: 'Break over', body: 'Back to focus.' },
  longBreak: { title: 'Rest over', body: 'Back to focus.' },
}

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  return audioCtx
}

function playTone(ctx: AudioContext, freq: number, start: number, duration: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq

  // Soft attack + decay to avoid clicks.
  const peak = 0.18
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(peak, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration)
}

export function playChime(mode: Mode): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    const [a, b] = TONES[mode]
    const t = ctx.currentTime
    playTone(ctx, a, t, 0.32)
    playTone(ctx, b, t + 0.18, 0.42)
  } catch {
    // No audio available — stay silent.
  }
}

export function showNotification(mode: Mode): void {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const { title, body } = MESSAGES[mode]
    new Notification(title, { body })
  } catch {
    // Notifications unavailable — skip.
  }
}

export async function requestNotificationPermission(): Promise<void> {
  try {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'default') await Notification.requestPermission()
  } catch {
    // Permission API unavailable — ignore.
  }
}
