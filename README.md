# Pomodoro Timer

A small Pomodoro timer with a 70s look — warm beige, earth tones and a chunky clock face. Built for fun, and because I wanted a timer I actually liked looking at.

<p align="center">
  <img src="docs/screenshots/demo.gif" alt="Timer counting down, finishing a focus session and rolling into a break" width="380">
</p>

## Screenshots

| Light | Dark |
| :---: | :---: |
| <img src="docs/screenshots/light.png" alt="Light theme" width="400"> | <img src="docs/screenshots/settings.png" alt="Dark theme with the settings menu open" width="400"> |

<p align="center">
  <img src="docs/screenshots/mobile.png" alt="Mobile layout" width="240">
</p>

## What it does

- Focus, short break and long rest, with a long rest every 4th session (adjustable)
- Click the time to change the duration
- Optional auto-advance to the next session
- A soft chime and a browser notification when a session ends
- Dark mode
- Keyboard shortcuts: `Space` start/pause, `R` reset, `S` skip, `1` `2` `3` switch mode
- Remembers where you were if you reload the page
- The tab title and favicon show the countdown

## Running it locally

```bash
npm install
npm run dev
```

Then open [localhost:3000](http://localhost:3000). Tests run with `npm test`.

Built with Next.js, TypeScript and Tailwind CSS. The chime is generated with the Web Audio API, so there are no sound files.
