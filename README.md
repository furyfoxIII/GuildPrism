# Guild Prism Board

A guild donation/leaderboard tracker for "Noob Incremental", with big-number
support (k/b/t/qd/... suffixes), a weekly trend chart, spreadsheet
import/export (xlsx/xls/csv), and a raw history log.

## Notes

- Nothing persists automatically — use "Export spreadsheet" to save your data
  between sessions, and "Import spreadsheet" to load it back in.
- The xlsx library (SheetJS) is loaded from a CDN in `index.html`.
