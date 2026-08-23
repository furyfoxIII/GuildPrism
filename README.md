# Guild Prism Board

A guild donation/leaderboard tracker for "Noob Incremental", with big-number
support (k/b/t/qd/... suffixes), a weekly trend chart, spreadsheet
import/export (xlsx/xls/csv), and a raw history log.

## Notes

- Nothing persists automatically — use "Export spreadsheet" to save your data
  between sessions, and "Import spreadsheet" to load it back in.
- The xlsx library (SheetJS) is loaded from a CDN in `index.html`.

## Syncing with a Google Sheet

GuildPrism is a static site (e.g. hosted on GitHub Pages), so it has no
server of its own and can't hold a private credential. Rather than a normal
Google sign-in flow, it talks to a small Apps Script that you deploy once on
your own Google Sheet — that script runs with your permission, so
GuildPrism itself never needs to authenticate as anyone.

**One-time setup, per sheet:**

1. Open (or create) the Google Sheet you want to use, then
   **Extensions → Apps Script**.
2. Delete the placeholder code and paste in the contents of
   [`google-apps-script/Code.gs`](google-apps-script/Code.gs) from this repo.
3. Change `SHARED_SECRET` at the top to something private to your guild.
   Anyone who has your deployed URL *and* this secret can overwrite the
   sheet, so treat it like a password — don't post it publicly.
4. **Deploy → New deployment**, type **Web app**, with:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click through the Google authorization prompt (this is you granting
   *your own script* permission to edit *your own sheet* — it's a one-time
   step for the sheet owner, not something every guild member does).
6. Copy the deployed URL (it ends in `/exec`).

**In GuildPrism:** click **Google Sheet** in the toolbar, paste in that URL
and the same secret, then **Save**. From there:
- **Pull from sheet** loads the sheet's data into GuildPrism (same
  replace-all-data confirmation as importing a file).
- **Push to sheet** overwrites the sheet's `History` tab with whatever is
  currently loaded in GuildPrism.

Both directions also carry the guild treasury total (prism from removed
members) via the sheet's `Meta` tab, same as file export/import.

The URL and secret are saved in that browser's local storage only — each
person who wants to sync (e.g. multiple officers) does steps in the "In
GuildPrism" section above using the same URL/secret, but nobody needs a
Google account of their own for this to work, since the script always acts
as the sheet's owner.

Because this bypasses Google's own auth, **the secret is the only thing
protecting the sheet from being overwritten by someone else who finds the
URL** — don't commit it to a public repo or share it outside the guild.
