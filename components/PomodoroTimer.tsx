'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { playChime, showNotification, requestNotificationPermission } from '@/lib/alerts'

type Mode = 'work' | 'shortBreak' | 'longBreak'

const DURATIONS: Record<Mode, number> = {
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

export default function PomodoroTimer() {
  const [mode, setMode] = useState<Mode>('work')
  const [timeLeft, setTimeLeft] = useState(DURATIONS.work)
  const [isRunning, setIsRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  const [flash, setFlash] = useState(false)
  const [tickParity, setTickParity] = useState(false)
  const [alertsOn, setAlertsOn] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const alertsOnRef = useRef(alertsOn)
  alertsOnRef.current = alertsOn

  const total = DURATIONS[mode]
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

  // Load persisted alert preference after mount (avoids hydration mismatch).
  useEffect(() => {
    const saved = localStorage.getItem('pomodoro-alerts')
    if (saved !== null) setAlertsOn(saved === '1')
  }, [])

  useEffect(() => {
    localStorage.setItem('pomodoro-alerts', alertsOn ? '1' : '0')
  }, [alertsOn])

  useEffect(() => {
    if (!flash) return
    if (alertsOnRef.current) {
      playChime(mode)
      showNotification(mode)
    }
    const t = setTimeout(() => setFlash(false), 4000)
    return () => clearTimeout(t)
  }, [flash, mode])

  function changeMode(m: Mode) {
    stop()
    setMode(m)
    setIsRunning(false)
    setTimeLeft(DURATIONS[m])
    setFlash(false)
  }

  function toggle() {
    if (timeLeft === 0) return
    setIsRunning(r => !r)
    setFlash(false)
  }

  function reset() {
    stop()
    setIsRunning(false)
    setTimeLeft(DURATIONS[mode])
    setFlash(false)
  }

  function toggleAlerts() {
    setAlertsOn(on => {
      const next = !on
      if (next) void requestNotificationPermission()
      return next
    })
  }

  return (
    <div className="wrapper">

      {/* Top stripe bar — 70s graphic element */}
      <div className="stripe-bar">
        <span className="stripe-label">POMODORO TIMER</span>
      </div>

      {/* Mode selector */}
      <nav className="mode-nav">
        {(Object.keys(DURATIONS) as Mode[]).map(m => (
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
          <div
            className={`time-numeral${flash ? ' time-flash' : ''}${isRunning ? (tickParity ? ' time-tick-a' : ' time-tick-b') : ''}`}
            style={{ color: flash ? cfg.arc : undefined }}
          >
            <span className="digit">{pad(mins)[0]}</span>
            <span className="digit">{pad(mins)[1]}</span>
            <span className="colon">:</span>
            <span className="digit">{pad(secs)[0]}</span>
            <span className="digit">{pad(secs)[1]}</span>
          </div>
          <p className="time-sub" style={{ color: cfg.arc }}>
            {flash ? 'Complete' : cfg.label}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <button className="btn-reset" onClick={reset} aria-label="Reset" title="Reset">↺</button>
        <button
          className={`btn-main${isRunning ? ' btn-main--active' : ''}${timeLeft === 0 ? ' btn-main--done' : ''}`}
          style={isRunning ? { '--btn-color': cfg.arc } as React.CSSProperties : {}}
          onClick={toggle}
          disabled={timeLeft === 0}
        >
          {isRunning ? 'Pause' : timeLeft === 0 ? 'Done' : 'Start'}
        </button>
        <button
          className="btn-reset btn-alert"
          onClick={toggleAlerts}
          aria-label={alertsOn ? 'Mute alerts' : 'Unmute alerts'}
          title={alertsOn ? 'Alerts on' : 'Alerts off'}
        >
          <BellIcon muted={!alertsOn} />
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
