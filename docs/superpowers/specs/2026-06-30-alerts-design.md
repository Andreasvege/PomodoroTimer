# Lyd + varsler ved øktslutt — Design

**Dato:** 2026-06-30
**Status:** Godkjent design, klar for plan

## Mål
Gi brukeren et hørbart og synlig signal når en Pomodoro-økt er ferdig, slik at man kan
ha fanen i bakgrunnen og likevel få beskjed. Styres med én av/på-knapp.

## Omfang
- **Lydchime** generert med Web Audio API (ingen lydfil å bundle).
- **Browser-varsling** via Notification API (funker når fanen er i bakgrunnen).
- Begge styres av én felles `alertsOn`-bryter. Default: **på**.
- Tone varierer per modus som nettopp ble ferdig.

Ikke i omfang (YAGNI): justerbar volum, valg av lydtema, separat bryter for lyd vs. varsel,
vibrasjon.

## Arkitektur

### Ny modul: `lib/alerts.ts`
Holder lyd/varsel-logikken ute av komponenten så `PomodoroTimer.tsx` forblir fokusert.
Rene funksjoner:

- `playChime(mode: Mode): void`
  - Lat-oppretter én delt `AudioContext` (gjenbrukes; `resume()` ved behov).
  - Spiller en to-tones sekvens via `OscillatorNode` + `GainNode` med myk attack/decay
    (unngå klikk).
  - Toner per modus (modusen som *nettopp ble ferdig*):
    - `work` ferdig → pause: lys, oppadgående (ca. 660 → 880 Hz).
    - `shortBreak` ferdig → fokus: dypere, roligere (ca. 440 → 330 Hz).
    - `longBreak` ferdig → fokus: dyp, varm (ca. 392 → 294 Hz).
  - Feiler stille hvis Web Audio ikke er tilgjengelig.

- `showNotification(mode: Mode): void`
  - Viser `Notification` med tittel/brødtekst avhengig av modus
    (f.eks. «Focus complete» / «Time for a break»).
  - No-op hvis `Notification` ikke finnes eller `permission !== 'granted'`.

- `requestNotificationPermission(): Promise<void>`
  - Kalles når brukeren slår bryteren **på**. No-op hvis allerede besvart eller ikke støttet.

### Endringer i `PomodoroTimer.tsx`
- Ny state `alertsOn: boolean` (default `true`).
- **Persistens:** les `localStorage['pomodoro-alerts']` i en `useEffect` etter mount
  (ikke under render, for å unngå hydration-mismatch). Skriv tilbake når verdien endres.
- **Utløser:** den eksisterende `flash`-effekten (settes `true` ved øktslutt, der `mode`
  fortsatt er den fullførte økten). Når `flash` blir `true` og `alertsOn`, kall
  `playChime(mode)` og `showNotification(mode)`.
- **Av/på-knapp:** liten bjelle-knapp (🔔 på / 🔕 av) i kontroll-raden (`.controls`),
  ved siden av reset-knappen. `aria-label` og `title` reflekterer tilstand. Når slått
  **på**, kall `requestNotificationPermission()`.

### Styling i `app/globals.css`
- Stil for bjelle-knappen som matcher eksisterende `.btn-reset` (samme 70-talls uttrykk).

## Dataflyt
1. Timer når 0 → `setFlash(true)` (eksisterende logikk).
2. `flash`-effekt kjører → hvis `alertsOn`: `playChime(mode)` + `showNotification(mode)`.
3. Bruker klikker bjelle → `alertsOn` toggles → skrives til `localStorage`; ved på:
   be om varsel-tillatelse.

## Feilhåndtering
- Web Audio / Notification mangler eller blokkert → funksjonene feiler stille, timeren
  fungerer som før.
- Varsel-tillatelse avslått → chime spiller fortsatt, varsel hoppes over.
- StrictMode kan dobbel-kjøre effekter i dev; akseptabelt for en chime. Vurder en enkel
  guard hvis det blir merkbart.

## Testing
Manuell verifisering i browser: start en kort økt, bekreft chime + varsel ved slutt,
test med fanen i bakgrunnen, og at bryteren av/på + persistens (reload) fungerer.
Ingen automatiske tester for selve lyden.

## Merknad (AGENTS.md)
Endringene er en klient-komponent + ren TS-modul uten nye Next.js-API-er. Sjekk likevel
relevant guide i `node_modules/next/dist/docs/` ved implementering hvis noe Next-spesifikt
dukker opp.
