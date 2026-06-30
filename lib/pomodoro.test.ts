import { describe, it, expect } from 'vitest'
import { pad, localDateString, isValidDurations, nextMode, clampMinutes, clampRound } from './pomodoro'

describe('pad', () => {
  it('zero-pads single digits', () => {
    expect(pad(0)).toBe('00')
    expect(pad(5)).toBe('05')
  })
  it('leaves two-digit numbers unchanged', () => {
    expect(pad(25)).toBe('25')
    expect(pad(59)).toBe('59')
  })
})

describe('localDateString', () => {
  it('formats as YYYY-MM-DD with padded month/day', () => {
    expect(localDateString(new Date(2026, 0, 3))).toBe('2026-01-03')
    expect(localDateString(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
  it('uses local components, not UTC', () => {
    // A local date constructed this way always renders its own Y/M/D.
    const d = new Date(2026, 5, 30)
    expect(localDateString(d)).toBe('2026-06-30')
  })
})

describe('isValidDurations', () => {
  it('accepts a well-formed durations object', () => {
    expect(isValidDurations({ work: 1500, shortBreak: 300, longBreak: 900 })).toBe(true)
  })
  it('rejects missing keys, non-numbers, and non-positive values', () => {
    expect(isValidDurations({ work: 1500, shortBreak: 300 })).toBe(false)
    expect(isValidDurations({ work: 1500, shortBreak: '300', longBreak: 900 })).toBe(false)
    expect(isValidDurations({ work: 0, shortBreak: 300, longBreak: 900 })).toBe(false)
    expect(isValidDurations({ work: NaN, shortBreak: 300, longBreak: 900 })).toBe(false)
  })
  it('rejects non-objects', () => {
    expect(isValidDurations(null)).toBe(false)
    expect(isValidDurations('nope')).toBe(false)
    expect(isValidDurations(undefined)).toBe(false)
  })
})

describe('nextMode', () => {
  it('goes from focus to a short break mid-round', () => {
    expect(nextMode('work', 1, 4)).toBe('shortBreak')
    expect(nextMode('work', 3, 4)).toBe('shortBreak')
  })
  it('goes from focus to a long break when the round completes', () => {
    expect(nextMode('work', 4, 4)).toBe('longBreak')
    expect(nextMode('work', 8, 4)).toBe('longBreak')
  })
  it('honors a custom round length', () => {
    expect(nextMode('work', 2, 2)).toBe('longBreak')
    expect(nextMode('work', 1, 2)).toBe('shortBreak')
    expect(nextMode('work', 6, 3)).toBe('longBreak')
  })
  it('always returns to focus after any break', () => {
    expect(nextMode('shortBreak', 2, 4)).toBe('work')
    expect(nextMode('longBreak', 4, 4)).toBe('work')
  })
})

describe('clampMinutes', () => {
  it('clamps to 1–99 and rounds', () => {
    expect(clampMinutes(0)).toBe(1)
    expect(clampMinutes(-5)).toBe(1)
    expect(clampMinutes(120)).toBe(99)
    expect(clampMinutes(25)).toBe(25)
    expect(clampMinutes(24.6)).toBe(25)
  })
})

describe('clampRound', () => {
  it('clamps to 2–8 and rounds', () => {
    expect(clampRound(1)).toBe(2)
    expect(clampRound(99)).toBe(8)
    expect(clampRound(4)).toBe(4)
    expect(clampRound(3.4)).toBe(3)
  })
})
