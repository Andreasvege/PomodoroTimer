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
- **Session-end alerts** (`lib/alerts.ts`): per-mode two-tone chime via Web Audio API (no bundled asset) + browser Notification; fired from the `flash` effect when the timer hits 0 (`mode` still holds the completed mode). Sound toggle lives in the settings menu, persisted to `localStorage['pomodoro-alerts']` (read in a post-mount effect to avoid hydration mismatch), default on. Notification permission requested only when the user turns alerts on.
- **Dark mode**: toggle in the settings menu (sun/moon line icon). Applies `data-theme="dark"` on `<html>`; dark palette in `globals.css` overrides the `:root` CSS vars (dusk espresso bg, cream text) while keeping the earth-tone accents. Persisted to `localStorage['pomodoro-theme']`, read post-mount like alerts, default light. Clock face is already charcoal so it reads intentionally in dark. **Anti-FOUC**: an inline blocking `<script>` in `app/layout.tsx` `<head>` sets `data-theme` before first paint (`<html suppressHydrationWarning>`).
- **Keyboard shortcuts**: `Space` = start/pause, `R` = reset. Global `keydown` listener, ignored when focus is in an input/textarea/contentEditable; `Space` calls `preventDefault()` to block page scroll and the default activation of any focused button (avoids double-toggle).
- **Auto-advance**: toggle in the settings menu, persisted to `localStorage['pomodoro-auto']`. When on, a `flash`-keyed effect calls `advance()` ~1.6s after a session ends — work → shortBreak (or longBreak every `roundLength`th), break → work, then auto-starts. `advance()` reads `mode`/`sessions`/`durations`/`roundLength` via refs to dodge stale closures.
- **Skip** (`»` button, right of Start/Pause): `skip()` jumps to the next session **paused**. Skipping a focus session increments `sessions` (fills a dot, follows long-break cadence); skipping a break just returns to work.
- **Task label**: `.task-input` under the clock, persisted to `localStorage['pomodoro-task']`, maxLength 60.
- **Custom durations**: `durations` is state (default `DEFAULT_DURATIONS`), persisted to `localStorage['pomodoro-durations']` as JSON (validated by `isValidDurations`). Click the time numeral when not running → inline `<input type=number>`; Enter commits (clamped 1–99 min), Escape cancels via `skipBlurRef` so the `onBlur` commit is skipped.
- **Audio warm-up** (`warmUpAudio` in `lib/alerts.ts`): resumes the `AudioContext` from the Start click (a user gesture) so auto-advance chimes — fired without a gesture — aren't blocked by the browser.
- **Tab title countdown**: an effect sets `document.title` to `MM:SS · Label` while running, `✓ Label done` on completion, else `Pomodoro Timer`.
- **Settings menu**: floating gear fixed to the viewport top-right (`.settings` is `position: fixed`, wraps gear + panel and holds `settingsRef`). Panel has toggles for **Sound**, **Dark mode**, **Auto-advance** (`Toggle` switch component), a divider, the long-break interval (`roundLength`, 2–8, replaces the old `SESSIONS_PER_ROUND` const; default `DEFAULT_ROUND`; persisted to `localStorage['pomodoro-round']`; session dots count follows it), and a "Reset progress" action. Closes on outside `mousedown` (checked against `settingsRef`) or Escape.
- **Accessibility**: `role="status"` + `aria-live="polite"` on the status line announces "Complete"; `:focus-visible` outlines (burnt orange) on all buttons/inputs. Honors `prefers-reduced-motion` (drops glow pulse, tick nudge, completion flash, gear rotation, theme transitions).
- **Responsive**: clock sizes to `min(486px, 86vw)`, SVG fills it, numerals use `clamp()`; a `max-width: 520px` query tightens spacing/padding.
- **Screen wake lock**: `wakeLockRef` requests a screen lock while running, releases on pause/stop, re-acquires on `visibilitychange` (lock drops when the tab hides). Fails silently where unsupported.
- **Daily stats**: completed (not skipped) focus sessions counted per local calendar day via `bumpToday()`, stored in `localStorage['pomodoro-stats']` as `{date,count}`; shown as "N focus sessions today". `localDateString()` keys by local midnight.
- **Keyboard (expanded)**: `S` = skip, `1/2/3` = modes, plus the original Space/R. Modifier combos (cmd/ctrl/alt) are ignored. Tabs/skip advertise keys via `title`.
- **Alert volume**: `volume` (0–1) state, persisted to `localStorage['pomodoro-volume']`, passed to `playChime(mode, volume)` via `volumeRef`. Slider in the settings menu previews on pointer-up. `playChime` scales tone peak by volume and no-ops at 0.

## Controls layout
Row is symmetric so Start/Pause sits centered: `[↺ reset]` · **[Start/Pause]** · `[» skip]`. Icon buttons share `.btn-icon`. The three preference toggles (sound/dark/auto) live in the floating settings menu, not the row.

## Persistence pattern
Each pref has a paired load/save effect. Load (post-mount, declared first) avoids hydration mismatch; the first-commit save may momentarily clobber storage with the default, but the load's `setState` changes the dep so the save effect re-runs and restores the real value. No `hydrated` guard needed.

## Key technical decisions
- Fixed-width digit spans (`width: 0.62em`) prevent layout shift as numbers change
- Colon is static (no blink) — animating the parent with `tickParity` boolean toggle (not `key` remount) avoids restarting the colon's DOM node
- SVG viewBox is `"-8 -8 336 336"` to prevent stroke clipping at edges
- CSS `filter: drop-shadow` on `.clock-shell` div (not SVG filter) for the shadow — SVG filters caused clipping artifacts
- **`tsc --noEmit` gotcha**: reports spurious errors from duplicate `.next/types/… 2.ts` files (macOS/sync artifacts, note the " 2" suffix) — these are not from your code. Dev server is `npm run dev -- -p <port>` (Next 16 + Turbopack).

## Next features to consider (discussed, not started)
1. **Restore session across reload** — persist mode/timeLeft/running so a refresh doesn't lose an active session
2. **Stats history** — beyond today's count: a small weekly view or streak
3. **Chime tone choice** — pick the sound character, not just volume

