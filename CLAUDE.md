@AGENTS.md

# Pomodoro Timer — Project State

## What it is
A 70s-inspired Pomodoro timer built with Next.js (App Router), TypeScript, and Tailwind CSS v4. Single component at `components/PomodoroTimer.tsx`, styles in `app/globals.css`.

## Design language
- **Palette**: warm beige background (`#C8B898`), charcoal clock face (`#1C1A18`), earth tone accents (burnt orange, avocado, mustard)
- **Fonts**: Righteous (numerals/headings) + Space Mono (labels/UI) via `next/font/google`
- **Clock**: SVG with decorative concentric rings (burnt orange outer band, avocado mid, mustard inner), progress arc depletes clockwise from 12 o'clock
- **Mode colors**: Focus = golden amber `#D4A020`, Short Break = avocado `#708030`, Long Rest = burnt orange `#C04818`
- **Session dots**: 4 pips beneath the clock, fill with the current mode color

## Key technical decisions
- Fixed-width digit spans (`width: 0.62em`) prevent layout shift as numbers change
- Colon is static (no blink) — animating the parent with `tickParity` boolean toggle (not `key` remount) avoids restarting the colon's DOM node
- SVG viewBox is `"-8 -8 336 336"` to prevent stroke clipping at edges
- CSS `filter: drop-shadow` on `.clock-shell` div (not SVG filter) for the shadow — SVG filters caused clipping artifacts

## Next features to consider (discussed, not started)
1. **Keyboard shortcuts** — Space to start/pause, R to reset
2. **Task label** — text input for what you're working on, shown inside/below the clock
3. **Browser notification + sound** — chime when a session ends, works when tab is in background
4. **Auto-advance** — automatically start the next break/session
5. **Custom durations** — click the time to edit minutes

