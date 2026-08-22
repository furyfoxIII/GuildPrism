# Guild Prism Board

A guild donation/leaderboard tracker for "Noob Incremental", with big-number
support (k/b/t/qd/... suffixes), a weekly trend chart, spreadsheet
import/export (xlsx/xls/csv), and a raw history log.

## Structure

```
guild-prism-board/
├── index.html            Page markup, loads CSS + JS in order
├── css/
│   └── style.css         All styling (dark theme, layout, components)
└── js/
    ├── bignumber.js       App.BN — arbitrary-scale number engine (parse/format/math)
    ├── dates.js           App.Dates — local-time date helpers, week bucketing
    ├── state.js           App.State — in-memory history array + derived-stats computation
    ├── render.js           App.els / App.renderAll — DOM refs and all rendering
    ├── importExport.js     App.initImportExport — spreadsheet import/export (SheetJS)
    └── main.js             Wires up form/tabs/sample/clear buttons, boots the app
```

Scripts are loaded as plain `<script>` tags (no bundler needed) and attach
themselves to a shared `window.App` namespace in dependency order:
`bignumber.js` → `dates.js` → `state.js` → `render.js` → `importExport.js` → `main.js`.

## Running it

No build step — just open `index.html` in a browser, or serve the folder
with any static file server, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Notes

- Nothing persists automatically — use "Export spreadsheet" to save your data
  between sessions, and "Import spreadsheet" to load it back in.
- The xlsx library (SheetJS) is loaded from a CDN in `index.html`.
