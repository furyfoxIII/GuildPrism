// GuildPrism sync script.
//
// Setup (do this once, on the Google Sheet you want GuildPrism to sync with):
//   1. Open the sheet -> Extensions -> Apps Script.
//   2. Delete any starter code and paste this file in instead.
//   3. Change SHARED_SECRET below to something only your guild knows
//      (leave it as '' to disable the secret check entirely — not
//      recommended, since anyone with the deployed URL could overwrite
//      the sheet).
//   4. Deploy -> New deployment -> select type "Web app".
//        Execute as: Me
//        Who has access: Anyone
//   5. Authorize it (it's your own script, running with your own
//      permissions — this step is what lets it edit the sheet on your
//      behalf without GuildPrism itself ever needing a Google sign-in).
//   6. Copy the resulting URL (ends in /exec) into GuildPrism's
//      "Google Sheet" settings, along with the same secret.
//   7. Change YOUR_SHEET_ID by the id of the google sheet, it's located between
//	/d/YOUR_SHEET_ID/edit in the google sheet link

const SHARED_SECRET = 'change-me';
const YOUR_SHEET_ID = 'change-me-too';
const SHEET_NAME = 'History';
const META_SHEET_NAME = 'Meta';

function doGet(e) {
  if (e.parameter.action !== 'pull') {
    return jsonResponse({ ok: false, error: 'Unknown action.' });
  }
  if (SHARED_SECRET && e.parameter.secret !== SHARED_SECRET) {
    return jsonResponse({ ok: false, error: 'Invalid secret.' });
  }

  const ss = SpreadsheetApp.openById(YOUR_SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return jsonResponse({ ok: true, formatVersion: readFormatVersion(ss), treasury: readTreasury(ss), rows: [] });

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonResponse({ ok: true, formatVersion: readFormatVersion(ss), treasury: readTreasury(ss), rows: [] });

  const headers = values[0];
  const rows = values.slice(1)
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });

  return jsonResponse({ ok: true, formatVersion: readFormatVersion(ss), treasury: readTreasury(ss), rows });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' });
  }
  if (SHARED_SECRET && body.secret !== SHARED_SECRET) {
    return jsonResponse({ ok: false, error: 'Invalid secret.' });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  const ss = SpreadsheetApp.openById(YOUR_SHEET_ID);

  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 3).setValues([['Date', 'Player', 'Total']]);
  if (rows.length) {
    const values = rows.map(r => [r.Date, r.Player, r.Total]);
    sheet.getRange(2, 1, values.length, 3).setValues(values);
  }

  let metaSheet = ss.getSheetByName(META_SHEET_NAME);
  if (!metaSheet) metaSheet = ss.insertSheet(META_SHEET_NAME);
  metaSheet.clearContents();
  metaSheet.getRange(1, 1, 4, 2).setValues([
    ['Key', 'Value'],
    ['Format version', body.formatVersion || 1],
    ['Exported', new Date().toISOString().slice(0, 10)],
    ['Treasury', body.treasury != null ? body.treasury : 0],
  ]);

  return jsonResponse({ ok: true, count: rows.length });
}

function readFormatVersion(ss) {
  const metaSheet = ss.getSheetByName(META_SHEET_NAME);
  if (!metaSheet) return 1;
  const values = metaSheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === 'format version') {
      const v = parseInt(values[i][1], 10);
      return isNaN(v) ? 1 : v;
    }
  }
  return 1;
}

// Returns the raw "Treasury" meta value as-is (a plain number, or a
// scientific-notation string for very large totals) — GuildPrism's own
// BN parser on the client side interprets it, so this stays a passthrough.
function readTreasury(ss) {
  const metaSheet = ss.getSheetByName(META_SHEET_NAME);
  if (!metaSheet) return 0;
  const values = metaSheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === 'treasury') {
      return values[i][1];
    }
  }
  return 0;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
