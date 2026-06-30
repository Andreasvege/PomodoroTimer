'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { playChime, showNotification, requestNotificationPermission, warmUpAudio } from '@/lib/alerts'

type Mode = 'work' | 'shortBreak' | 'longBreak'

const DEFAULT_DURATIONS: Record<Mode, number> = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
}

const MODE_CONFIG: Record<Mode, { label: string; short: string; arc: string; glow: string }> = {
  work:       { label: 'Focus',       short: 'Focus',  arc: '#D4A020', glow: 'rgba(212,160,32,0.18)' },
  shortBreak: { label: 'Short Break', short: 'Break',  arc: '#708030', glow: 'rgba(112,128,48,0.18)' },
  longBreak:  { label: 'Long Rest',   short: 'Rest',   arc: '#C04818', glow: 'rgba(192,72,24,0.18)' },
}

const DEFAULT_ROUND = 4
const C = 160
const RADIUS = 120
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Local calendar day, so the daily stat rolls over at the user's midnight.
function localDateString(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function isValidDurations(d: unknown): d is Record<Mode, number> {
  if (!d || typeof d !== 'object') return false
  const r = d as Record<string, unknown>
  return ['work', 'shortBreak', 'longBreak'].every(
    k => typeof r[k] === 'number' && Number.isFinite(r[k] as number) && (r[k] as number) > 0,
  )
}

// Hugeicons-style line icons, drawn with currentColor so they inherit button state.
function BellIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.5V4" />
      <path d="M6.5 9.5C6.5 6.46 8.96 4 12 4s5.5 2.46 5.5 5.5c0 3.5 1 5.5 2.5 7H4c1.5-1.5 2.5-3.5 2.5-7Z" />
      <path d="M9.5 16.5a2.5 2.5 0 0 0 5 0" />
      {muted && <path d="M3.5 3.5l17 17" />}
    </svg>
  )
}

// Sun when dark (click → go light); crescent moon when light (click → go dark).
function ThemeIcon({ dark }: { dark: boolean }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {dark ? (
        <>
          <circle cx={12} cy={12} r={4} />
          <path d="M12 2.5V4M12 20v1.5M4.2 4.2l1.1 1.1M18.7 18.7l1.1 1.1M2.5 12H4M20 12h1.5M4.2 19.8l1.1-1.1M18.7 5.3l1.1-1.1" />
        </>
      ) : (
        <path d="M20 13.5A8 8 0 0 1 10.5 4 6.5 6.5 0 1 0 20 13.5Z" />
      )}
    </svg>
  )
}

// Circular arrows — auto-advance between sessions.
function AutoIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9a8 8 0 0 1 13.5-3.4L20 8" />
      <path d="M20 3.5V8h-4.5" />
      <path d="M20 15a8 8 0 0 1-13.5 3.4L4 16" />
      <path d="M4 20.5V16h4.5" />
    </svg>
  )
}

// Gear — opens the settings popover.
function GearIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx={12} cy={12} r={3} />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  )
}

// Skip to the next session.
function SkipIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 5l8 7-8 7V5Z" />
      <path d="M18 5v14" />
    </svg>
  )
}

// Sliding on/off switch used in the settings panel.
function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`toggle${on ? ' toggle--on' : ''}`}
    >
      <span className="toggle-knob" />
    </button>
  )
}

export default function PomodoroTimer() {
  const [mode, setMode] = useState<Mode>('work')
  const [durations, setDurations] = useState<Record<Mode, number>>(DEFAULT_DURATIONS)
  const [timeLeft, setTimeLeft] = useState(DEFAULT_DURATIONS.work)
  const [isRunning, setIsRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  const [flash, setFlash] = useState(false)
  const [tickParity, setTickParity] = useState(false)
  const [alertsOn, setAlertsOn] = useState(true)
  const [dark, setDark] = useState(false)
  const [autoAdvance, setAutoAdvance] = useState(false)
  const [task, setTask] = useState('')
  const [editing, setEditing] = useState(false)
  const [draftMin, setDraftMin] = useState('')
  const [roundLength, setRoundLength] = useState(DEFAULT_ROUND)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [todayCount, setTodayCount] = useState(0)
  const [volume, setVolume] = useState(1)
  const todayDateRef = useRef('')

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const skipBlurRef = useRef(false)
  const settingsRef = useRef<HTMLDivElement | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const faviconCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const faviconLinkRef = useRef<HTMLLinkElement | null>(null)

  // Refs mirror state so the auto-advance closure always sees current values.
  const alertsOnRef = useRef(alertsOn); alertsOnRef.current = alertsOn
  const volumeRef = useRef(volume); volumeRef.current = volume
  const modeRef = useRef(mode); modeRef.current = mode
  const sessionsRef = useRef(sessions); sessionsRef.current = sessions
  const durationsRef = useRef(durations); durationsRef.current = durations
  const roundLengthRef = useRef(roundLength); roundLengthRef.current = roundLength

  const total = durations[mode]
  const progress = 1 - timeLeft / total
  const dashOffset = CIRCUMFERENCE * progress
  const cfg = MODE_CONFIG[mode]

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const sessionsFilled = sessions % roundLength
  const totalRounds = Math.floor(sessions / roundLength) + 1

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Record one completed focus session against today's date (rolls at midnight).
  const bumpToday = useCallback(() => {
    const today = localDateString()
    setTodayCount(prev => {
      const next = todayDateRef.current === today ? prev + 1 : 1
      todayDateRef.current = today
      try {
        localStorage.setItem('pomodoro-stats', JSON.stringify({ date: today, count: next }))
      } catch { /* storage unavailable — keep in-memory count */ }
      return next
    })
  }, [])

  useEffect(() => {
    if (!isRunning) { stop(); return }
    intervalRef.current = setInterval(() => {
      setTickParity(p => !p)
      setTimeLeft(prev => {
        if (prev <= 1) {
          stop()
          setIsRunning(false)
          setFlash(true)
          if (mode === 'work') { setSessions(s => s + 1); bumpToday() }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return stop
  }, [isRunning, stop, mode, bumpToday])

  // ── Persistence: each pref loads after mount (avoids hydration mismatch),
  //    then a paired effect writes it back on change. ──
  useEffect(() => {
    const saved = localStorage.getItem('pomodoro-alerts')
    if (saved !== null) setAlertsOn(saved === '1')
  }, [])
  useEffect(() => {
    localStorage.setItem('pomodoro-alerts', alertsOn ? '1' : '0')
  }, [alertsOn])

  useEffect(() => {
    const saved = localStorage.getItem('pomodoro-volume')
    if (saved !== null) {
      const v = parseFloat(saved)
      if (Number.isFinite(v)) setVolume(Math.max(0, Math.min(1, v)))
    }
  }, [])
  useEffect(() => {
    localStorage.setItem('pomodoro-volume', String(volume))
  }, [volume])

  useEffect(() => {
    const saved = localStorage.getItem('pomodoro-theme')
    if (saved !== null) setDark(saved === 'dark')
  }, [])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('pomodoro-theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    const saved = localStorage.getItem('pomodoro-auto')
    if (saved !== null) setAutoAdvance(saved === '1')
  }, [])
  useEffect(() => {
    localStorage.setItem('pomodoro-auto', autoAdvance ? '1' : '0')
  }, [autoAdvance])

  useEffect(() => {
    const saved = localStorage.getItem('pomodoro-task')
    if (saved !== null) setTask(saved)
  }, [])
  useEffect(() => {
    localStorage.setItem('pomodoro-task', task)
  }, [task])

  useEffect(() => {
    const saved = localStorage.getItem('pomodoro-durations')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (isValidDurations(parsed)) {
          setDurations(parsed)
          setTimeLeft(parsed[modeRef.current])
        }
      } catch { /* ignore corrupt value */ }
    }
  }, [])
  useEffect(() => {
    localStorage.setItem('pomodoro-durations', JSON.stringify(durations))
  }, [durations])

  // Resume an in-progress session after reload, subtracting the time elapsed
  // while the page was gone. Declared before the save effect below so it reads
  // storage before that effect can overwrite it. Must also run after the
  // durations loader so its setTimeLeft is the one that wins on mount.
  useEffect(() => {
    const raw = localStorage.getItem('pomodoro-session')
    if (!raw) return
    try {
      const s = JSON.parse(raw)
      if (!s || !(s.mode in DEFAULT_DURATIONS) || typeof s.timeLeft !== 'number') return
      if (s.isRunning && typeof s.savedAt === 'number') {
        const remaining = s.timeLeft - (Date.now() - s.savedAt) / 1000
        if (remaining > 0.5) {
          setMode(s.mode)
          setTimeLeft(Math.round(remaining))
          setIsRunning(true)
        }
        return
      }
      if (s.timeLeft > 0) {
        setMode(s.mode)
        setTimeLeft(s.timeLeft)
      }
    } catch { /* ignore corrupt value */ }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem('pomodoro-session', JSON.stringify({ mode, timeLeft, isRunning, savedAt: Date.now() }))
    } catch { /* storage unavailable */ }
  }, [mode, timeLeft, isRunning])

  useEffect(() => {
    const saved = localStorage.getItem('pomodoro-round')
    if (saved !== null) {
      const n = parseInt(saved, 10)
      if (Number.isFinite(n) && n >= 2 && n <= 8) setRoundLength(n)
    }
  }, [])
  useEffect(() => {
    localStorage.setItem('pomodoro-round', String(roundLength))
  }, [roundLength])

  // Load today's focus-session count; a saved count from a prior day stays 0.
  useEffect(() => {
    const today = localDateString()
    todayDateRef.current = today
    const saved = localStorage.getItem('pomodoro-stats')
    if (saved) {
      try {
        const p = JSON.parse(saved)
        if (p && p.date === today && typeof p.count === 'number') setTodayCount(p.count)
      } catch { /* ignore corrupt value */ }
    }
  }, [])

  // Live countdown in the tab title so it's useful in a background tab.
  useEffect(() => {
    if (flash) document.title = `✓ ${cfg.label} done`
    else if (isRunning) document.title = `${pad(mins)}:${pad(secs)} · ${cfg.label}`
    else document.title = 'Pomodoro Timer'
  }, [flash, isRunning, mins, secs, cfg.label])

  // Draw a favicon that mirrors the clock: charcoal face + mode-colored
  // remaining-time ring, so the tab icon reflects status at a glance.
  useEffect(() => {
    if (!faviconCanvasRef.current) faviconCanvasRef.current = document.createElement('canvas')
    const canvas = faviconCanvasRef.current
    const size = 64
    canvas.width = size
    canvas.height = size
    const g = canvas.getContext('2d')
    if (!g) return

    const cx = size / 2
    const cy = size / 2
    const r = 24
    const lw = 10
    g.clearRect(0, 0, size, size)
    g.beginPath()
    g.arc(cx, cy, r + lw / 2, 0, Math.PI * 2)
    g.fillStyle = '#1C1A18'
    g.fill()
    g.beginPath()
    g.arc(cx, cy, r, 0, Math.PI * 2)
    g.lineWidth = lw
    g.strokeStyle = 'rgba(232,204,170,0.18)'
    g.stroke()

    const frac = flash ? 1 : Math.max(0, Math.min(1, timeLeft / total))
    if (frac > 0) {
      const start = -Math.PI / 2
      g.beginPath()
      g.arc(cx, cy, r, start, start + Math.PI * 2 * frac)
      g.lineWidth = lw
      g.lineCap = 'round'
      g.strokeStyle = cfg.arc
      g.stroke()
    }

    if (!faviconLinkRef.current) {
      let link = document.querySelector<HTMLLinkElement>('link#dynamic-favicon')
      if (!link) {
        link = document.createElement('link')
        link.id = 'dynamic-favicon'
        link.rel = 'icon'
        link.type = 'image/png'
        document.head.appendChild(link)
      }
      faviconLinkRef.current = link
    }
    faviconLinkRef.current.href = canvas.toDataURL('image/png')
  }, [timeLeft, total, flash, cfg.arc])

  // Session-end chime + notification.
  useEffect(() => {
    if (!flash) return
    if (alertsOnRef.current) {
      playChime(mode, volumeRef.current)
      showNotification(mode)
    }
    const t = setTimeout(() => setFlash(false), 4000)
    return () => clearTimeout(t)
  }, [flash, mode])

  const changeMode = useCallback((m: Mode) => {
    stop()
    setMode(m)
    setIsRunning(false)
    setTimeLeft(durations[m])
    setFlash(false)
    setEditing(false)
  }, [stop, durations])

  const toggle = useCallback(() => {
    if (timeLeft === 0) return
    warmUpAudio() // unlock audio from this gesture so auto-advance chimes can play
    setIsRunning(r => !r)
    setFlash(false)
  }, [timeLeft])

  const reset = useCallback(() => {
    stop()
    setIsRunning(false)
    setTimeLeft(durations[mode])
    setFlash(false)
    setEditing(false)
  }, [stop, durations, mode])

  // Advance to the next session in the Pomodoro cycle and auto-start it.
  const advance = useCallback(() => {
    const completed = modeRef.current
    const next: Mode = completed === 'work'
      ? (sessionsRef.current % roundLengthRef.current === 0 ? 'longBreak' : 'shortBreak')
      : 'work'
    setMode(next)
    setTimeLeft(durationsRef.current[next])
    setFlash(false)
    setIsRunning(true)
  }, [])

  // Manual skip to the next session (paused). Skipping a focus session counts
  // it toward the round so the dots and long-break cadence stay in sync.
  const skip = useCallback(() => {
    let next: Mode
    if (modeRef.current === 'work') {
      const nextSessions = sessionsRef.current + 1
      setSessions(nextSessions)
      next = nextSessions % roundLengthRef.current === 0 ? 'longBreak' : 'shortBreak'
    } else {
      next = 'work'
    }
    stop()
    setMode(next)
    setTimeLeft(durationsRef.current[next])
    setIsRunning(false)
    setFlash(false)
    setEditing(false)
  }, [stop])

  // When a session ends and auto-advance is on, roll into the next one.
  useEffect(() => {
    if (!flash || !autoAdvance) return
    const t = setTimeout(advance, 1600)
    return () => clearTimeout(t)
  }, [flash, autoAdvance, advance])

  // Keep the screen awake while running. The lock is auto-dropped when the tab
  // is hidden, so re-acquire it when the tab becomes visible again.
  useEffect(() => {
    if (!isRunning) return
    let cancelled = false

    async function acquire() {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLockRef.current) {
          const lock = await navigator.wakeLock.request('screen')
          if (cancelled) { void lock.release(); return }
          wakeLockRef.current = lock
        }
      } catch { /* wake lock unavailable or denied — ignore */ }
    }
    function onVisible() {
      if (document.visibilityState === 'visible') void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void wakeLockRef.current?.release().catch(() => {})
      wakeLockRef.current = null
    }
  }, [isRunning])

  // Keyboard: Space start/pause, R reset, S skip, 1/2/3 modes. Ignored while typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.key === 'r' || e.key === 'R') {
        reset()
      } else if (e.key === 's' || e.key === 'S') {
        skip()
      } else if (e.key === '1') {
        changeMode('work')
      } else if (e.key === '2') {
        changeMode('shortBreak')
      } else if (e.key === '3') {
        changeMode('longBreak')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, reset, skip, changeMode])

  // Close the settings popover on outside click or Escape.
  useEffect(() => {
    if (!settingsOpen) return
    function onPointer(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setSettingsOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onEsc)
    }
  }, [settingsOpen])

  function toggleAlerts() {
    setAlertsOn(on => {
      const next = !on
      if (next) void requestNotificationPermission()
      return next
    })
  }

  function startEdit() {
    if (isRunning) return
    skipBlurRef.current = false
    setDraftMin(String(Math.round(durations[mode] / 60)))
    setEditing(true)
  }

  function commitEdit() {
    if (skipBlurRef.current) {
      skipBlurRef.current = false
      setEditing(false)
      return
    }
    setEditing(false)
    const m = parseInt(draftMin, 10)
    if (!Number.isFinite(m)) return
    const clamped = Math.min(99, Math.max(1, m))
    const secs = clamped * 60
    setDurations(d => ({ ...d, [mode]: secs }))
    setTimeLeft(secs)
  }

  return (
    <div className="wrapper">

      {/* Floating settings — fixed to the top-right corner */}
      <div className="settings" ref={settingsRef}>
        <button
          className="settings-gear"
          onClick={() => setSettingsOpen(o => !o)}
          aria-label="Settings"
          aria-expanded={settingsOpen}
          title="Settings"
        >
          <GearIcon />
        </button>
        {settingsOpen && (
          <div className="settings-panel" role="dialog" aria-label="Settings">
            <div className="settings-toggle-row">
              <span className="settings-toggle-label"><BellIcon muted={!alertsOn} /> Sound</span>
              <Toggle on={alertsOn} onClick={toggleAlerts} label="Sound" />
            </div>
            <div className="settings-toggle-row">
              <span className="settings-toggle-label"><ThemeIcon dark={dark} /> Dark mode</span>
              <Toggle on={dark} onClick={() => setDark(d => !d)} label="Dark mode" />
            </div>
            <div className="settings-toggle-row">
              <span className="settings-toggle-label"><AutoIcon /> Auto-advance</span>
              <Toggle on={autoAdvance} onClick={() => setAutoAdvance(a => !a)} label="Auto-advance" />
            </div>
            <div className="settings-slider-row">
              <span className="settings-toggle-label">Volume</span>
              <input
                className="settings-slider"
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                aria-label="Alert volume"
                onChange={e => setVolume(parseInt(e.target.value, 10) / 100)}
                onPointerUp={() => { if (alertsOn) playChime('work', volumeRef.current) }}
              />
            </div>
            <div className="settings-divider" />
            <label className="settings-row">
              <span>Long break after</span>
              <span className="settings-control">
                <input
                  type="number"
                  min={2}
                  max={8}
                  value={roundLength}
                  onChange={e => {
                    const n = parseInt(e.target.value, 10)
                    if (Number.isFinite(n)) setRoundLength(Math.min(8, Math.max(2, n)))
                  }}
                />
                <span className="settings-unit">focus sessions</span>
              </span>
            </label>
            <button
              className="settings-action"
              onClick={() => { setSessions(0); setSettingsOpen(false) }}
            >
              Reset progress
            </button>
          </div>
        )}
      </div>

      {/* Top stripe bar — 70s graphic element */}
      <div className="stripe-bar">
        <span className="stripe-label">POMODORO TIMER</span>
      </div>

      {/* Mode selector */}
      <nav className="mode-nav">
        {(Object.keys(MODE_CONFIG) as Mode[]).map((m, i) => (
          <button
            key={m}
            onClick={() => changeMode(m)}
            className={`mode-tab${mode === m ? ' mode-tab--on' : ''}`}
            style={mode === m ? { '--tab-color': MODE_CONFIG[m].arc } as React.CSSProperties : {}}
            title={`${MODE_CONFIG[m].label} (${i + 1})`}
          >
            {MODE_CONFIG[m].short}
          </button>
        ))}
      </nav>

      {/* Clock */}
      <div className="clock-shell">
        <svg viewBox="-8 -8 336 336" width={486} height={486} aria-label={`${pad(mins)}:${pad(secs)}`}>
          <defs>
          </defs>

          {/* Ambient glow when running */}
          {isRunning && (
            <circle cx={C} cy={C} r={152}
              fill={cfg.glow}
              className="ambient-glow"
            />
          )}

          {/* Outer frame fill */}
          <circle cx={C} cy={C} r={155} fill="#1C1A18" />
          {/* Burnt orange outer band */}
          <circle cx={C} cy={C} r={155} fill="none" stroke="#C04818" strokeWidth={12} />
          {/* Avocado middle ring */}
          <circle cx={C} cy={C} r={141} fill="none" stroke="#708030" strokeWidth={4} />
          {/* Mustard inner ring */}
          <circle cx={C} cy={C} r={134} fill="none" stroke="#C08A0A" strokeWidth={2} />
          {/* Charcoal face */}
          <circle cx={C} cy={C} r={130} fill="#1C1A18" />

          {/* Progress track */}
          <circle cx={C} cy={C} r={RADIUS}
            fill="none"
            stroke="rgba(232,204,170,0.09)"
            strokeWidth={11}
          />

          {/* Progress arc */}
          <circle cx={C} cy={C} r={RADIUS}
            fill="none"
            stroke={cfg.arc}
            strokeWidth={11}
            strokeLinecap="butt"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${C} ${C})`}
            style={{
              transition: isRunning
                ? 'stroke-dashoffset 1s linear'
                : 'stroke-dashoffset 0.35s ease',
            }}
          />

        </svg>

        {/* Time overlay */}
        <div className="time-overlay">
          {editing ? (
            <input
              className="time-edit"
              type="number"
              min={1}
              max={99}
              value={draftMin}
              autoFocus
              aria-label="Minutes"
              onChange={e => setDraftMin(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit()
                else if (e.key === 'Escape') { skipBlurRef.current = true; setEditing(false) }
              }}
              onBlur={commitEdit}
            />
          ) : (
            <div
              className={`time-numeral${flash ? ' time-flash' : ''}${isRunning ? (tickParity ? ' time-tick-a' : ' time-tick-b') : ''}${!isRunning ? ' time-numeral--editable' : ''}`}
              style={{ color: flash ? cfg.arc : undefined }}
              onClick={startEdit}
              title={!isRunning ? 'Click to set minutes' : undefined}
            >
              <span className="digit">{pad(mins)[0]}</span>
              <span className="digit">{pad(mins)[1]}</span>
              <span className="colon">:</span>
              <span className="digit">{pad(secs)[0]}</span>
              <span className="digit">{pad(secs)[1]}</span>
            </div>
          )}
          <p className="time-sub" style={{ color: cfg.arc }} role="status" aria-live="polite">
            {flash ? 'Complete' : cfg.label}
          </p>
        </div>
      </div>

      {/* Task label */}
      <input
        className="task-input"
        type="text"
        value={task}
        maxLength={60}
        placeholder="What are you working on?"
        aria-label="Current task"
        onChange={e => setTask(e.target.value)}
      />

      {/* Controls — Start/Pause centered, reset left, skip right */}
      <div className="controls">
        <button className="btn-reset" onClick={reset} aria-label="Reset" title="Reset (R)">↺</button>
        <button
          className={`btn-main${isRunning ? ' btn-main--active' : ''}${timeLeft === 0 ? ' btn-main--done' : ''}`}
          style={isRunning ? { '--btn-color': cfg.arc } as React.CSSProperties : {}}
          onClick={toggle}
          disabled={timeLeft === 0}
          title="Start / Pause (Space)"
        >
          {isRunning ? 'Pause' : timeLeft === 0 ? 'Done' : 'Start'}
        </button>
        <button
          className="btn-reset btn-icon"
          onClick={skip}
          aria-label="Skip to next session"
          title="Skip to next session (S)"
        >
          <SkipIcon />
        </button>
      </div>

      <div className="session-block">
        <div className="session-dots">
          {Array.from({ length: roundLength }).map((_, i) => (
            <div
              key={i}
              className={`session-pip${i < sessionsFilled ? ' session-pip--on' : ''}`}
              style={i < sessionsFilled ? { background: cfg.arc, borderColor: cfg.arc } as React.CSSProperties : {}}
            />
          ))}
        </div>
        <p className="session-label">
          {totalRounds > 1 ? `round ${totalRounds}` : 'sessions'}
        </p>
        {todayCount > 0 && (
          <p className="today-stat">
            {todayCount} focus session{todayCount === 1 ? '' : 's'} today
          </p>
        )}
      </div>
    </div>
  )
}
