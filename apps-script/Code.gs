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
const LINK = 'https://batinac.com/video-produkcija'; // kratki link koji se prikazuje klijentima
const TZ = 'Europe/Zagreb';
const BOJA = '#0B1E44';
const TG_TOKEN = ''; // može ostati prazno: token se upisuje u adminu (⚙ Postavke → Telegram)

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
    const ss = ss_();
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
        name: 'Horizont video – web', htmlBody: obavijest_(d, ss.getUrl()),
        body: POLJA.filter(p => d[p[0]]).map(p => p[1] + ': ' + d[p[0]]).join('\n') + '\n\nOdgovori direktno na ovaj mail (ide klijentu).\nAdmin: ' + WEB + 'admin.html\nTablica: ' + ss.getUrl()
      });
    } catch (err) { console.warn(err); }
    try { tgNovo_(d); } catch (err) { console.warn(err); }
    try {
      MailApp.sendEmail({ to: d.email, name: NAZIV, replyTo: NOTIFY_EMAIL, subject: 'Primili smo Vaš upit ' + d.nr + ' – Horizont video produkcija', htmlBody: potvrda_(d), body: 'Hvala! Zaprimili smo Vaš upit ' + d.nr + '. Javljamo se uskoro. ' + TEL + ' · ' + LINK });
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
      predlosci: JSON.parse(props.getProperty('predlosci') || '[]'), tablica: ss_().getUrl(), telegram: tgInfo_(), brojac: brojacInfo_() };
  }
  if (d.akcija === 'postavke') {
    const P = d.postavke || {};
    const o = { satnica: Math.max(0, Number(P.satnica) || 0), pdv: !!P.pdv, stopa: Math.max(0, Number(P.stopa) || 25), napomena: String(P.napomena || '').slice(0, 400) };
    props.setProperty('postavke', JSON.stringify(o));
    return { ok: true, postavke: o };
  }
  if (d.akcija === 'tg') return tgAdmin_(d);
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
  if (d.akcija === 'kalendar') {
    const sh = sheet_(), row = rowByNr_(sh, d.nr);
    if (!row) return { ok: false, error: 'Upit ' + d.nr + ' nije pronađen.' };
    const id = kalendar_(sh, row, d);
    return { ok: true, id: id };
  }
  if (d.akcija === 'brisi') {
    if (d.lozinka !== ADMIN_KEY) { Utilities.sleep(800); return { ok: false, error: 'Pogrešna lozinka za potvrdu.' }; }
    const sh = sheet_(), nrs = Array.isArray(d.nrs) ? d.nrs : [d.nr];
    const rows = nrs.map(nr => rowByNr_(sh, nr)).filter(Boolean).sort((a, b) => b - a); // odozdo, da se redovi ne pomaknu
    if (!rows.length) return { ok: false, error: 'Upit nije pronađen.' };
    rows.forEach(row => { brisiDogadaj_(cell_(sh, row, 'Kalendar ID')); sh.deleteRow(row); });
    return { ok: true, obrisano: rows.length, brojac: brojacInfo_() };
  }
  if (d.akcija === 'brojac') {
    const sh = sheet_(), god = new Date().getFullYear(), od = Math.floor(Number(d.od));
    if (!(od >= 1 && od <= 9999)) return { ok: false, error: 'Upiši broj od 1 do 9999.' };
    if (brojeviGodine_(sh, god).indexOf(od) !== -1) return { ok: false, error: 'Broj UP-' + god + '-' + String(od).padStart(4, '0') + ' već postoji. Prvo obriši taj upit ili odaberi drugi broj.' };
    PropertiesService.getScriptProperties().setProperty('brojac', JSON.stringify({ god, od }));
    return { ok: true, brojac: brojacInfo_() };
  }
  return { ok: false, error: 'Nepoznata akcija.' };
}

// Tablica: ako je skripta napravljena iz tablice, koristi nju; inače sama napravi tablicu na Driveu i zapamti je.
function ss_() {
  const a = SpreadsheetApp.getActiveSpreadsheet();
  if (a) return a;
  const P = PropertiesService.getScriptProperties(), id = P.getProperty('ssid');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  const s = SpreadsheetApp.create('Horizont video – upiti');
  P.setProperty('ssid', s.getId());
  return s;
}

// ===== KALENDAR (zadani kalendar računa na kojem radi skripta, kao kod servisa) =====
function cell_(sh, row, name) { const H = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], i = H.indexOf(name); return i > -1 ? sh.getRange(row, i + 1).getDisplayValue() : ''; }
function brisiDogadaj_(id) { if (!id) return; try { const ev = CalendarApp.getDefaultCalendar().getEventById(id); if (ev) ev.deleteEvent(); } catch (e) {} }
function kalendar_(sh, row, d) {
  const cal = CalendarApp.getDefaultCalendar(), staro = cell_(sh, row, 'Kalendar ID');
  if (d.brisi) { brisiDogadaj_(staro); setFields_(sh, row, { 'Kalendar ID': '', 'Rok isporuke': '' }); return ''; }
  const m = String(d.datum || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error('Neispravan datum roka.');
  const dan = new Date(+m[1], +m[2] - 1, +m[3]);
  const title = '🎬 Rok: ' + d.nr + ' – ' + (d.klijent || 'klijent') + (d.projekt ? ' – ' + d.projekt : '');
  const desc = [d.projekt ? 'Projekt: ' + d.projekt : '', d.usluge ? 'Usluge: ' + d.usluge : '', d.kontakt ? 'Kontakt: ' + d.kontakt : '', d.opis ? '\n' + d.opis : '', '\nAdmin: ' + WEB + 'admin.html'].filter(Boolean).join('\n');
  let ev = null;
  if (staro) { try { ev = cal.getEventById(staro); } catch (e) {} }
  if (ev) { ev.setTitle(title); ev.setDescription(desc); ev.setAllDayDate(dan); }
  else ev = cal.createAllDayEvent(title, dan, { description: desc });
  try { ev.removeAllReminders(); ev.addPopupReminder(3 * 24 * 60); ev.addPopupReminder(24 * 60); ev.addEmailReminder(24 * 60); } catch (e) {}
  try { ev.setColor(CalendarApp.EventColor.BLUE); } catch (e) {}
  setFields_(sh, row, { 'Kalendar ID': ev.getId(), 'Rok isporuke': Utilities.formatDate(dan, TZ, 'yyyy-MM-dd') });
  return ev.getId();
}

function postavke_() {
  try { return Object.assign({}, DEF_POSTAVKE, JSON.parse(PropertiesService.getScriptProperties().getProperty('postavke') || '{}')); }
  catch (e) { return DEF_POSTAVKE; }
}

// ===== POMOĆNE =====
function sheet_() {
  const ss = ss_();
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
  const sh = ss_().getSheetByName(name);
  if (!sh || !sh.getLastRow()) return { headers: [], rows: [] };
  const v = sh.getDataRange().getDisplayValues();
  return { headers: v[0], rows: v.slice(1) };
}

// Brojevi upita: UP-GGGG-NNNN. Sljedeći = zadnji + 1, osim ako je u adminu ručno postavljen početni broj.
function brojeviGodine_(sh, god) {
  const pre = 'UP-' + god + '-';
  return sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().flat()
    .filter(v => String(v).startsWith(pre)).map(v => +String(v).slice(pre.length) || 0) : [];
}
function sljedeciBroj_(sh) {
  const god = new Date().getFullYear(), N = brojeviGodine_(sh, god), P = PropertiesService.getScriptProperties();
  const rucno = JSON.parse(P.getProperty('brojac') || 'null');
  let n = rucno && rucno.god === god ? rucno.od : (N.length ? Math.max.apply(null, N) : 0) + 1;
  while (N.indexOf(n) !== -1) n++; // nikad dva ista broja
  return { god, n, zadnji: N.length ? Math.max.apply(null, N) : 0, rucno: !!(rucno && rucno.god === god) };
}
function noviBroj_(sh) {
  const s = sljedeciBroj_(sh);
  PropertiesService.getScriptProperties().deleteProperty('brojac'); // ručna postavka vrijedi za jedan (sljedeći) upit
  return 'UP-' + s.god + '-' + String(s.n).padStart(4, '0');
}
function brojacInfo_() { const s = sljedeciBroj_(sheet_()); return { god: s.god, zadnji: s.zadnji, sljedeci: s.n, rucno: s.rucno }; }

function hit_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = ss_();
    const sh = ss.getSheetByName(SHEET_POSJETE) || ss.insertSheet(SHEET_POSJETE);
    if (!sh.getLastRow()) { sh.appendRow(['Datum', 'Posjete']); sh.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground(BOJA).setFontColor('#FFFFFF'); sh.setFrozenRows(1); }
    const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), last = sh.getLastRow();
    if (last > 1 && sh.getRange(last, 1).getDisplayValue() === today) { const c = sh.getRange(last, 2); c.setValue(Number(c.getValue() || 0) + 1); }
    else sh.appendRow(["'" + today, 1]);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// ===== TELEGRAM (zaseban bot za video, odvojeno od servisa) =====
function tgProps_() { return PropertiesService.getScriptProperties(); }
function tgApi_(metoda, payload) {
  const t = tgProps_().getProperty('tg_token') || TG_TOKEN; if (!t) throw new Error('Telegram bot nije postavljen.');
  const r = UrlFetchApp.fetch('https://api.telegram.org/bot' + t + '/' + metoda, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload || {}), muteHttpExceptions: true });
  const j = JSON.parse(r.getContentText() || '{}'); if (!j.ok) throw new Error('Telegram: ' + (j.description || r.getResponseCode())); return j.result;
}
function tgInfo_() { const p = tgProps_(); if (!p.getProperty('tg_bot') && TG_TOKEN && !p.getProperty('tg_token')) { try { p.setProperty('tg_bot', tgApi_('getMe').username || ''); } catch (e) {} } return { bot: p.getProperty('tg_bot') || '', povezan: !!p.getProperty('tg_chat') }; }
function tgZadnjiChat_() { const up = tgApi_('getUpdates', { limit: 50 }) || []; const m = up.map(u => u.message || u.edited_message || u.my_chat_member).filter(x => x && x.chat).pop(); return m ? String(m.chat.id) : ''; }
function tg_(txt, gumbi) {
  const chat = tgProps_().getProperty('tg_chat'); if (!chat) return;
  const body = { chat_id: chat, text: String(txt).slice(0, 3800), parse_mode: 'HTML', disable_web_page_preview: true };
  if (gumbi && gumbi.length) body.reply_markup = { inline_keyboard: [gumbi] };
  tgApi_('sendMessage', body);
}
function tgAdmin_(d) {
  const p = tgProps_();
  try {
    if (d.op === 'token') {
      const tok = String(d.token || '').trim(); if (!/^\d+:[\w-]{20,}$/.test(tok)) return { ok: false, error: 'Token ne izgleda ispravno (oblik 123456789:ABC…).' };
      p.setProperty('tg_token', tok); p.deleteProperty('tg_chat');
      try { const me = tgApi_('getMe'); p.setProperty('tg_bot', me.username || ''); } catch (e) { p.deleteProperty('tg_token'); return { ok: false, error: 'Telegram ne prihvaća token. Provjeri ga u BotFatheru.' }; }
      return { ok: true, telegram: tgInfo_() };
    }
    if (d.op === 'povezi') {
      const chat = (d.chat && /^-?\d+$/.test(String(d.chat).trim())) ? String(d.chat).trim() : tgZadnjiChat_();
      if (!chat) return { ok: false, error: 'Bot još nije dobio poruku. U Telegramu otvori @' + (p.getProperty('tg_bot') || 'bot') + ', pošalji mu bilo koju poruku (npr. /start) pa opet klikni Poveži.' };
      p.setProperty('tg_chat', chat);
      tg_('✅ <b>Povezano!</b>\nOvdje stižu obavijesti o novim upitima za <b>video produkciju</b>.');
      return { ok: true, telegram: tgInfo_() };
    }
    if (d.op === 'test') { if (!p.getProperty('tg_chat')) return { ok: false, error: 'Telegram još nije povezan.' }; tg_('🎬 <b>Novi upit! (proba)</b>\nHorizont video produkcija', [{ text: 'Otvori admin', url: WEB + 'admin.html' }]); return { ok: true }; }
    if (d.op === 'iskljuci') { ['tg_token', 'tg_chat', 'tg_bot'].forEach(k => p.deleteProperty(k)); return { ok: true, telegram: { bot: '', povezan: false } }; }
  } catch (e) { return { ok: false, error: e.message }; }
  return { ok: false, error: 'Nepoznata akcija.' };
}
function tgNovo_(d) {
  if (!tgProps_().getProperty('tg_chat')) return;
  const h = s => esc_(s);
  const L = ['🎬 <b>Novi upit ' + h(d.nr) + '</b>', '<b>' + h(d.firma || d.ime) + '</b>' + (d.firma ? ' · ' + h(d.ime) : '') + (d.tip ? ' (' + h(d.tip) + ')' : ''),
    d.telefon ? '📞 ' + h(d.telefon) : '', d.email ? '✉️ ' + h(d.email) : '', d.usluge ? '🎯 ' + h(d.usluge) : '', d.rok ? '📅 Rok: ' + h(hrDatum_(d.rok)) : '', d.budzet ? '💶 ' + h(d.budzet) : '',
    d.kontakt_nacin ? '💬 ' + h(d.kontakt_nacin) + (d.kontakt_kada ? ' · ' + h(d.kontakt_kada) : '') : '', d.opis ? '\n' + h(String(d.opis).slice(0, 600)) : ''];
  const tel = intl_(d.telefon), G = [{ text: '📂 Admin', url: WEB + 'admin.html' }];
  if (tel) G.push({ text: 'WhatsApp', url: 'https://wa.me/' + tel });
  tg_(L.filter(String).join('\n'), G);
}

// Ručno (▶ Pokreni) nakon što botu pošalješ poruku: poveže chat i pošalje probu.
function testTelegram() {
  const chat = tgZadnjiChat_(); if (chat) tgProps_().setProperty('tg_chat', chat);
  if (!tgProps_().getProperty('tg_chat')) { Logger.log('❌ Bot nije dobio poruku. Pošalji mu /start pa pokreni ponovno.'); return; }
  tg_('✅ Povezano! 🎬 Novi upit (proba)'); Logger.log('✅ Poslano.');
}

// ===== E-MAIL PREDLOŠCI (tablični HTML, radi u Gmailu, Outlooku i na mobitelu) =====
const MAIL_HEADER = WEB + 'mail-header.jpg';
const WA = '385913584122';
function esc_(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function intl_(t) { const d = String(t || '').replace(/\D/g, ''); return d.startsWith('385') ? d : d.startsWith('0') ? '385' + d.slice(1) : d; }
function hrDatum_(v) { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? (+m[3]) + '. ' + (+m[2]) + '. ' + m[1] + '.' : (v || ''); }
function btn_(href, txt, bg, fg) {
  return `<td style="padding:4px"><a href="${href}" style="display:inline-block;background:${bg};color:${fg};font:bold 14px Arial,sans-serif;text-decoration:none;padding:12px 18px;border-radius:8px">${txt}</a></td>`;
}
function okvir_(naslov, sadrzaj, podnozje) {
  return `<!doctype html><html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc_(naslov)}</title></head>
<body style="margin:0;padding:0;background:#EEF2F9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#0B1424">
<tr><td style="background:#040A18;line-height:0"><a href="${LINK}"><img src="${MAIL_HEADER}" width="600" alt="Horizont LHB d.o.o. – video produkcija" style="display:block;width:100%;max-width:600px;height:auto;border:0"></a></td></tr>
<tr><td style="height:4px;line-height:4px;font-size:0;background:#1E6BFF;background-image:linear-gradient(90deg,#1E6BFF,#4FA3FF 42%,#FFD27A 58%,#FF9500)">&nbsp;</td></tr>
${sadrzaj}
<tr><td style="background:#040A18;padding:22px 28px;color:#9AA8C2;font-size:12px;line-height:1.6">
<b style="color:#FFFFFF;font-size:13px">Horizont LHB d.o.o.</b> <span style="color:#FFC94D">· video produkcija</span><br>
${TEL} · <a href="${LINK}" style="color:#8FC2FF;text-decoration:none">${LINK.replace('https://', '')}</a><br>
${podnozje || 'Ovaj mail je automatska potvrda. Slobodno odgovorite na njega, poruka stiže izravno nama.'}
</td></tr></table></td></tr></table></body></html>`;
}

// Potvrda klijentu nakon upita
function potvrda_(d) {
  const ime = (d.ime || '').split(' ')[0];
  const red = (k, v) => v ? `<tr><td style="padding:9px 14px;color:#56627A;font-size:13px;border-bottom:1px solid #E3E9F3;width:38%">${esc_(k)}</td><td style="padding:9px 14px;font-size:14px;border-bottom:1px solid #E3E9F3"><b>${esc_(v)}</b></td></tr>` : '';
  const korak = (n, t, s) => `<tr><td width="44" valign="top" style="padding:0 0 14px"><div style="width:32px;height:32px;line-height:32px;border-radius:50%;background:#FFB020;color:#0A1630;font-weight:bold;text-align:center;font-size:14px">${n}</div></td><td valign="top" style="padding:3px 0 14px;font-size:14px;line-height:1.5"><b>${t}</b><br><span style="color:#56627A">${s}</span></td></tr>`;
  const sadrzaj = `
<tr><td style="padding:30px 28px 6px">
  <p style="margin:0 0 6px;font:bold 11px monospace;letter-spacing:2px;color:#A85F00;text-transform:uppercase">Upit zaprimljen · ${esc_(d.nr)}</p>
  <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#0B1424">Hvala${ime ? ', ' + esc_(ime) : ''}!</h1>
  <p style="margin:0;font-size:15px;line-height:1.6;color:#33405A">Zaprimili smo Vaš upit. Pregledat ćemo ga i javiti Vam se ${d.kontakt_nacin ? 'putem: <b>' + esc_(d.kontakt_nacin) + '</b>,' : 'odabranim kanalom'} s idejom, prijedlogom i točnom cijenom.</p>
</td></tr>
<tr><td style="padding:20px 28px 4px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E3E9F3;border-radius:10px;overflow:hidden;background:#F7F9FD">
    ${red('Broj upita', d.nr)}${red(d.firma ? 'Firma' : '', d.firma)}${red('Usluge', d.usluge)}${red('Gdje se koristi', d.kanali)}${red('Rok', hrDatum_(d.rok))}${red('Kontakt', d.kontakt_nacin)}${red('Kada Vam odgovara', d.kontakt_kada)}
  </table>
</td></tr>
<tr><td style="padding:24px 28px 6px">
  <p style="margin:0 0 14px;font-size:17px;font-weight:bold">Što slijedi</p>
  <table role="presentation" cellpadding="0" cellspacing="0">
    ${korak(1, 'Pregled upita', 'Proučimo što trebate i javimo se, ako treba, s pitanjem ili dvije.')}
    ${korak(2, 'Ideja i ponuda', 'Dobivate prijedlog, primjere i točnu cijenu prije početka.')}
    ${korak(3, 'Produkcija i isporuka', 'Snimamo, montiramo i isporučujemo u svim formatima koji Vam trebaju.')}
  </table>
</td></tr>
<tr><td style="padding:10px 24px 30px">
  <p style="margin:0 0 10px 4px;font-size:14px;color:#33405A">Želite brži dogovor? Javite nam se izravno:</p>
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    ${btn_('https://wa.me/' + WA + '?text=' + encodeURIComponent('Pozdrav, šaljem upit ' + d.nr + '.'), 'WhatsApp', '#1E6BFF', '#FFFFFF')}
    ${btn_('tel:+' + WA, 'Nazovite', '#FFB020', '#0A1630')}
    ${btn_(LINK, 'Naši radovi', '#EEF2F9', '#0B1424')}
  </tr></table>
</td></tr>`;
  return okvir_('Primili smo Vaš upit ' + d.nr, sadrzaj);
}

// Obavijest tebi o novom upitu
function obavijest_(d, tablicaUrl) {
  const red = (k, v) => v ? `<tr><td style="padding:7px 12px;color:#56627A;font-size:13px;border-bottom:1px solid #E3E9F3;width:36%;vertical-align:top">${esc_(k)}</td><td style="padding:7px 12px;font-size:14px;border-bottom:1px solid #E3E9F3">${esc_(v)}</td></tr>` : '';
  const tel = intl_(d.telefon);
  const sadrzaj = `
<tr><td style="padding:26px 28px 4px">
  <p style="margin:0 0 6px;font:bold 11px monospace;letter-spacing:2px;color:#1559E0;text-transform:uppercase">Novi upit · ${esc_(d.nr)}</p>
  <h1 style="margin:0 0 6px;font-size:24px;line-height:1.2">${esc_(d.firma || d.ime)}</h1>
  <p style="margin:0;font-size:14px;color:#56627A">${esc_(d.tip || '')}${d.usluge ? ' · ' + esc_(d.usluge) : ''}</p>
</td></tr>
<tr><td style="padding:16px 24px 4px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
  ${btn_(WEB + 'admin.html', 'Otvori admin', '#FFB020', '#0A1630')}
  ${tel ? btn_('https://wa.me/' + tel, 'WhatsApp', '#1E6BFF', '#FFFFFF') + btn_('tel:+' + tel, 'Nazovi', '#EEF2F9', '#0B1424') : ''}
</tr></table></td></tr>
<tr><td style="padding:14px 28px 28px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E3E9F3;border-radius:10px;overflow:hidden">
    ${POLJA.filter(p => p[0] !== 'nr').map(p => red(p[1], p[0] === 'rok' ? hrDatum_(d[p[0]]) : d[p[0]])).join('')}
  </table>
  <p style="margin:14px 0 0;font-size:13px;color:#56627A">Odgovor na ovaj mail ide izravno klijentu. <a href="${tablicaUrl}" style="color:#1559E0">Otvori tablicu</a></p>
</td></tr>`;
  return okvir_('Novi upit ' + d.nr, sadrzaj, 'Obavijest s web stranice. Klijent je dobio automatsku potvrdu.');
}

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// Pokreni jednom ručno (▶ Run) da Google zatraži dozvole za tablicu i mail.
function odobriDozvole() { sheet_(); MailApp.getRemainingDailyQuota(); CalendarApp.getDefaultCalendar().getName(); try { UrlFetchApp.fetch('https://api.telegram.org', { muteHttpExceptions: true }); } catch (e) {} Logger.log('Tablica: ' + ss_().getUrl()); }
