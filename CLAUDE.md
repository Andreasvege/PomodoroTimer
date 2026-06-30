@AGENTS.md

# Pomodoro Timer — Project State

## What it is
A 70s-inspired Pomodoro timer built with Next.js (App Router), TypeScript, and Tailwind CSS v4. Main component at `components/PomodoroTimer.tsx`, sound/notification logic in `lib/alerts.ts`, styles in `app/globals.css`.

## Design language
- **Palette**: warm beige background (`#C8B898`), charcoal clock face (`#1C1A18`), earth tone accents (burnt orange, avocado, mustard)
- **Fonts**: Righteous (numerals/headings) + Space Mono (labels/UI) via `next/font/google`
- **Clock**: SVG with decorative concentric rings (burnt orange outer band, avocado mid, mustard inner), progress arc depletes clockwise from 12 o'clock
- **Mode colors**: Focus = golden amber `#D4A020`, Short Break = avocado `#708030`, Long Rest = burnt orange `#C04818`
- **Session dots**: 4 pips beneath the clock, fill with the current mode color

## Implemented features
- **Session-end alerts** (`lib/alerts.ts`): per-mode two-tone chime via Web Audio API (no bundled asset) + browser Notification; fired from the `flash` effect when the timer hits 0 (`mode` still holds the completed mode). Single bell toggle in the controls row, persisted to `localStorage['pomodoro-alerts']` (read in a post-mount effect to avoid hydration mismatch), default on. Notification permission requested only when the user turns alerts on.
- **Dark mode**: toggle button beside the bell (same `.btn-reset` style, sun/moon line icon). Applies `data-theme="dark"` on `<html>`; dark palette in `globals.css` overrides the `:root` CSS vars (dusk espresso bg, cream text) while keeping the earth-tone accents. Persisted to `localStorage['pomodoro-theme']`, read post-mount like alerts, default light. Clock face is already charcoal so it reads intentionally in dark. **Anti-FOUC**: an inline blocking `<script>` in `app/layout.tsx` `<head>` sets `data-theme` before first paint (`<html suppressHydrationWarning>`).
- **Keyboard shortcuts**: `Space` = start/pause, `R` = reset. Global `keydown` listener, ignored when focus is in an input/textarea/contentEditable; `Space` calls `preventDefault()` to block page scroll and the default activation of any focused button (avoids double-toggle).
- **Auto-advance**: toggle button left of reset (mustard `.btn-auto--on` when active), persisted to `localStorage['pomodoro-auto']`. When on, a `flash`-keyed effect calls `advance()` ~1.6s after a session ends — work → shortBreak (or longBreak every 4th via `sessions % SESSIONS_PER_ROUND`), break → work, then auto-starts. `advance()` reads `mode`/`sessions`/`durations` via refs to dodge stale closures.
- **Task label**: `.task-input` under the clock, persisted to `localStorage['pomodoro-task']`, maxLength 60.
- **Custom durations**: `durations` is now state (default `DEFAULT_DURATIONS`), persisted to `localStorage['pomodoro-durations']` as JSON (validated by `isValidDurations`). Click the time numeral when not running → inline `<input type=number>`; Enter commits (clamped 1–99 min), Escape cancels via `skipBlurRef` so the `onBlur` commit is skipped.

## Controls layout
Row is symmetric so Start/Pause sits centered: `[auto] [reset]` · **[Start/Pause]** · `[bell] [theme]`. Icon buttons share `.btn-icon` (was `.btn-alert`).

## Persistence pattern
Each pref has a paired load/save effect. Load (post-mount, declared first) avoids hydration mismatch; the first-commit save may momentarily clobber storage with the default, but the load's `setState` changes the dep so the save effect re-runs and restores the real value. No `hydrated` guard needed.

## Key technical decisions
- Fixed-width digit spans (`width: 0.62em`) prevent layout shift as numbers change
- Colon is static (no blink) — animating the parent with `tickParity` boolean toggle (not `key` remount) avoids restarting the colon's DOM node
- SVG viewBox is `"-8 -8 336 336"` to prevent stroke clipping at edges
- CSS `filter: drop-shadow` on `.clock-shell` div (not SVG filter) for the shadow — SVG filters caused clipping artifacts
- **`tsc --noEmit` gotcha**: reports spurious errors from duplicate `.next/types/… 2.ts` files (macOS/sync artifacts, note the " 2" suffix) — these are not from your code. Dev server is `npm run dev -- -p <port>` (Next 16 + Turbopack).

## Next features to consider (discussed, not started)
1. **Long-break length already custom** — consider a settings panel instead of inline edit if more options pile up
2. **Sound choice** — let the user pick the chime tone/volume

