'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { playChime, showNotification, requestNotificationPermission } from '@/lib/alerts'

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

const SESSIONS_PER_ROUND = 4
const C = 160
const RADIUS = 120
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function pad(n: number) {
  return String(n).padStart(2, '0')
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

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const skipBlurRef = useRef(false)

  // Refs mirror state so the auto-advance closure always sees current values.
  const alertsOnRef = useRef(alertsOn); alertsOnRef.current = alertsOn
  const modeRef = useRef(mode); modeRef.current = mode
  const sessionsRef = useRef(sessions); sessionsRef.current = sessions
  const durationsRef = useRef(durations); durationsRef.current = durations

  const total = durations[mode]
  const progress = 1 - timeLeft / total
  const dashOffset = CIRCUMFERENCE * progress
  const cfg = MODE_CONFIG[mode]

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const sessionsFilled = sessions % SESSIONS_PER_ROUND
  const totalRounds = Math.floor(sessions / SESSIONS_PER_ROUND) + 1

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
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
          if (mode === 'work') setSessions(s => s + 1)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return stop
  }, [isRunning, stop, mode])

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

  // Session-end chime + notification.
  useEffect(() => {
    if (!flash) return
    if (alertsOnRef.current) {
      playChime(mode)
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
      ? (sessionsRef.current % SESSIONS_PER_ROUND === 0 ? 'longBreak' : 'shortBreak')
      : 'work'
    setMode(next)
    setTimeLeft(durationsRef.current[next])
    setFlash(false)
    setIsRunning(true)
  }, [])

  // When a session ends and auto-advance is on, roll into the next one.
  useEffect(() => {
    if (!flash || !autoAdvance) return
    const t = setTimeout(advance, 1600)
    return () => clearTimeout(t)
  }, [flash, autoAdvance, advance])

  // Keyboard: Space = start/pause, R = reset. Ignored while typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.key === 'r' || e.key === 'R') {
        reset()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, reset])

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

      {/* Top stripe bar — 70s graphic element */}
      <div className="stripe-bar">
        <span className="stripe-label">POMODORO TIMER</span>
      </div>

      {/* Mode selector */}
      <nav className="mode-nav">
        {(Object.keys(MODE_CONFIG) as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => changeMode(m)}
            className={`mode-tab${mode === m ? ' mode-tab--on' : ''}`}
            style={mode === m ? { '--tab-color': MODE_CONFIG[m].arc } as React.CSSProperties : {}}
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
          <p className="time-sub" style={{ color: cfg.arc }}>
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

      {/* Controls — Start/Pause centered, two small buttons flanking each side */}
      <div className="controls">
        <button
          className={`btn-reset btn-icon${autoAdvance ? ' btn-auto--on' : ''}`}
          onClick={() => setAutoAdvance(a => !a)}
          aria-pressed={autoAdvance}
          aria-label={autoAdvance ? 'Auto-advance on' : 'Auto-advance off'}
          title={autoAdvance ? 'Auto-advance: on' : 'Auto-advance: off'}
        >
          <AutoIcon />
        </button>
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
          onClick={toggleAlerts}
          aria-label={alertsOn ? 'Mute alerts' : 'Unmute alerts'}
          title={alertsOn ? 'Alerts on' : 'Alerts off'}
        >
          <BellIcon muted={!alertsOn} />
        </button>
        <button
          className="btn-reset btn-icon"
          onClick={() => setDark(d => !d)}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          <ThemeIcon dark={dark} />
        </button>
      </div>

      <div className="session-block">
        <div className="session-dots">
          {Array.from({ length: SESSIONS_PER_ROUND }).map((_, i) => (
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
      </div>
    </div>
  )
}
