/**
 * Horizont LHB – video produkcija
 * Upiti s web stranice + admin (nalozi, evidencija rada, obračun).
 * Zalijepi u Google tablicu → Proširenja → Apps Script → Implementiraj kao Web app (Execute as: Me, Access: Anyone).
 * Lozinku za admin upiši SAMO ovdje (ADMIN_KEY), nikad u GitHub repo.
 */
const NOTIFY_EMAIL = 'horizont.servisi@gmail.com'; // na ovu adresu stižu upiti
const ADMIN_KEY = 'UPISI_LOZINKU';                // lozinka za admin.html
const SHEET_NAME = 'Upiti';
const SHEET_POSJETE = 'Posjete';
const NAZIV = 'Horizont LHB d.o.o. – video produkcija';
const TEL = '091/358 4122';
const WEB = 'https://sbatinac.github.io/horizont-video_production/';
const TZ = 'Europe/Zagreb';
const BOJA = '#0B1E44';

const POLJA = [
  ['nr', 'Broj upita'], ['vrijeme', 'Vrijeme'], ['tip', 'Klijent'], ['firma', 'Naziv firme / udruge'], ['oib', 'OIB'],
  ['ime', 'Ime i prezime / kontakt osoba'], ['email', 'E-pošta'], ['telefon', 'Mobitel'], ['grad', 'Grad'],
  ['kontakt_nacin', 'Kako kontaktirati'], ['kontakt_kada', 'Kada kontaktirati'],
  ['usluge', 'Usluge'], ['kanali', 'Gdje se koristi'], ['budzet', 'Budžet'], ['rok', 'Rok'], ['opis', 'Opis projekta']
];
const DEF_POSTAVKE = { satnica: 100, pdv: false, stopa: 25, napomena: 'Obveznik nije u sustavu PDV-a. PDV nije obračunat temeljem čl. 90. st. 2. Zakona o porezu na dodanu vrijednost.' };

// ===== JAVNO =====
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents || '{}');
    if (d._vrsta === 'admin') return out(admin_(d));
    if (!d.ime || !d.email || !d.opis) return out({ ok: false, error: 'Nedostaju podaci.' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = sheet_();
    d.nr = noviBroj_(sh);
    const row = POLJA.map(p => {
      const v = String(d[p[0]] || '').slice(0, 5000);
      return /^[+0][\d\s\/().-]*$/.test(v) && v ? "'" + v : v; // broj mobitela / OIB ostaju tekst
    });
    sh.appendRow(row.concat('Novo'));
    try {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL, replyTo: d.email,
        subject: 'Novi upit ' + d.nr + ': ' + (d.firma || d.ime) + ' – ' + (d.usluge || 'video'),
        body: POLJA.filter(p => d[p[0]]).map(p => p[1] + ': ' + d[p[0]]).join('\n') + '\n\nOdgovori direktno na ovaj mail (ide klijentu).\nAdmin: ' + WEB + 'admin.html\nTablica: ' + ss.getUrl()
      });
    } catch (err) { console.warn(err); }
    try {
      MailApp.sendEmail({ to: d.email, name: NAZIV, replyTo: NOTIFY_EMAIL, subject: 'Primili smo Vaš upit ' + d.nr, htmlBody: potvrda_(d) });
    } catch (err) { console.warn(err); }
    return out({ ok: true, nr: d.nr });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.a === 'hit') return out(hit_());
  return out({ ok: true, servis: 'horizont-video_production' });
}

// ===== ADMIN =====
function admin_(d) {
  if (!ADMIN_KEY || ADMIN_KEY === 'UPISI_LOZINKU' || d.k !== ADMIN_KEY) { Utilities.sleep(800); return { ok: false, error: 'Pogrešna lozinka.' }; }
  const props = PropertiesService.getScriptProperties();
  if (d.akcija === 'podaci') {
    return { ok: true, upiti: table_(SHEET_NAME), posjete: table_(SHEET_POSJETE), postavke: postavke_(),
      predlosci: JSON.parse(props.getProperty('predlosci') || '[]'), tablica: SpreadsheetApp.getActiveSpreadsheet().getUrl() };
  }
  if (d.akcija === 'postavke') {
    const P = d.postavke || {};
    const o = { satnica: Math.max(0, Number(P.satnica) || 0), pdv: !!P.pdv, stopa: Math.max(0, Number(P.stopa) || 25), napomena: String(P.napomena || '').slice(0, 400) };
    props.setProperty('postavke', JSON.stringify(o));
    return { ok: true, postavke: o };
  }
  if (d.akcija === 'predlosci') {
    const L = (Array.isArray(d.predlosci) ? d.predlosci : []).slice(0, 40).map(x => ({ n: String(x.n || '').slice(0, 80), t: String(x.t || '').slice(0, 2000) })).filter(x => x.n && x.t);
    props.setProperty('predlosci', JSON.stringify(L));
    return { ok: true, predlosci: L };
  }
  if (d.akcija === 'spremi') {
    const sh = sheet_(), row = rowByNr_(sh, d.nr);
    if (!row) return { ok: false, error: 'Upit ' + d.nr + ' nije pronađen.' };
    setFields_(sh, row, d.polja || {});
    return { ok: true };
  }
  if (d.akcija === 'brisi') {
    const sh = sheet_(), row = rowByNr_(sh, d.nr);
    if (!row) return { ok: false, error: 'Upit nije pronađen.' };
    if (d.lozinka !== ADMIN_KEY) { Utilities.sleep(800); return { ok: false, error: 'Pogrešna lozinka za potvrdu.' }; }
    sh.deleteRow(row);
    return { ok: true };
  }
  return { ok: false, error: 'Nepoznata akcija.' };
}

function postavke_() {
  try { return Object.assign({}, DEF_POSTAVKE, JSON.parse(PropertiesService.getScriptProperties().getProperty('postavke') || '{}')); }
  catch (e) { return DEF_POSTAVKE; }
}

// ===== POMOĆNE =====
function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(POLJA.map(p => p[1]).concat('Status'));
    sh.getRange(1, 1, 1, POLJA.length + 1).setFontWeight('bold').setBackground(BOJA).setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
  return sh;
}

function rowByNr_(sh, nr) {
  if (!nr || sh.getLastRow() < 2) return 0;
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().flat();
  const i = v.indexOf(String(nr));
  return i === -1 ? 0 : i + 2;
}

// Upiše vrijednosti po nazivu stupca; stupci koji ne postoje dodaju se na kraj.
function setFields_(sh, row, fields) {
  const H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  Object.keys(fields).forEach(k => {
    let i = H.indexOf(k);
    if (i === -1) { i = H.length; sh.getRange(1, i + 1).setValue(k).setFontWeight('bold').setBackground(BOJA).setFontColor('#FFFFFF'); H.push(k); }
    const v = fields[k];
    sh.getRange(row, i + 1).setValue(typeof v === 'string' && /^[=+\-@]/.test(v) && !/^-?\d/.test(v) ? "'" + v : v);
  });
}

function table_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh || !sh.getLastRow()) return { headers: [], rows: [] };
  const v = sh.getDataRange().getDisplayValues();
  return { headers: v[0], rows: v.slice(1) };
}

function noviBroj_(sh) {
  const god = new Date().getFullYear(), pre = 'UP-' + god + '-';
  const n = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().flat()
    .filter(v => String(v).startsWith(pre)).map(v => +String(v).slice(pre.length) || 0) : [];
  return pre + String((n.length ? Math.max.apply(null, n) : 0) + 1).padStart(4, '0');
}

function hit_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_POSJETE) || ss.insertSheet(SHEET_POSJETE);
    if (!sh.getLastRow()) { sh.appendRow(['Datum', 'Posjete']); sh.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground(BOJA).setFontColor('#FFFFFF'); sh.setFrozenRows(1); }
    const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), last = sh.getLastRow();
    if (last > 1 && sh.getRange(last, 1).getDisplayValue() === today) { const c = sh.getRange(last, 2); c.setValue(Number(c.getValue() || 0) + 1); }
    else sh.appendRow(["'" + today, 1]);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function potvrda_(d) {
  const e = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ime = (d.ime || '').split(' ')[0];
  const rows = [['Broj upita', d.nr], ['Usluge', d.usluge], ['Kontakt', d.kontakt_nacin], ['Kada', d.kontakt_kada], ['Rok', d.rok]]
    .filter(r => r[1]).map(r => `<tr><td style="padding:6px 14px 6px 0;color:#56627A">${e(r[0])}</td><td style="padding:6px 0"><b>${e(r[1])}</b></td></tr>`).join('');
  return `<div style="font-family:Arial,sans-serif;max-width:560px;color:#0B1424">
    <div style="height:4px;background:linear-gradient(90deg,#1E6BFF,#FFC23D,#FF9500)"></div>
    <h2 style="margin:22px 0 8px">Hvala${ime ? ', ' + e(ime) : ''}!</h2>
    <p>Zaprimili smo Vaš upit i javljamo se odabranim kanalom s prijedlogom i ponudom.</p>
    <table style="border-collapse:collapse;margin:14px 0">${rows}</table>
    <p>Za brži dogovor: <b>${TEL}</b> (poziv, WhatsApp, Viber).</p>
    <p style="color:#56627A;font-size:13px;margin-top:26px">${NAZIV}<br><a href="${WEB}" style="color:#1559E0">${WEB}</a></p>
  </div>`;
}

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// Pokreni jednom ručno (▶ Run) da Google zatraži dozvole za tablicu i mail.
function odobriDozvole() { sheet_(); MailApp.getRemainingDailyQuota(); }
