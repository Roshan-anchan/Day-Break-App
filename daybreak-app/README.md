# Daybreak — Habit Tracker

A local, standalone version of the Daybreak habit tracker. Data is saved to
your browser's localStorage, so it persists between visits on the same
browser/machine.

## Run it

```bash
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173).

## Build for production

```bash
npm run build
npm run preview
```

## Notes

- Data is stored per-browser via localStorage — it will not sync across
  different browsers or devices. If you clear your browser's site data for
  localhost, your habits and history will be lost.
- To back up your data, you can open the browser DevTools console and run:
  `copy(localStorage.getItem('tracker-data'))` — this copies your data as
  JSON to your clipboard so you can save it somewhere safe.
