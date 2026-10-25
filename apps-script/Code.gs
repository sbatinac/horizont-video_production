/**
 * Horizont LHB – video produkcija
 * Upiti za ponudu: upis u Google tablicu, broj upita (UP-GGGG-NNNN), mail obavijest i potvrda klijentu.
 * Zalijepi u Google tablicu → Proširenja → Apps Script → Implementiraj kao Web app (Execute as: Me, Access: Anyone).
 */
const NOTIFY_EMAIL = 'horizont.servisi@gmail.com'; // promijeni ako upiti trebaju ići na drugu adresu
const SHEET_NAME = 'Upiti';
const NAZIV = 'Horizont LHB d.o.o. – video produkcija';
const TEL = '091/358 4122';
const WEB = 'https://sbatinac.github.io/horizont-video_production/';
const POLJA = [
  ['nr', 'Broj upita'], ['vrijeme', 'Vrijeme'], ['tip', 'Klijent'], ['firma', 'Naziv firme / udruge'], ['oib', 'OIB'],
  ['ime', 'Ime i prezime / kontakt osoba'], ['email', 'E-pošta'], ['telefon', 'Mobitel'], ['grad', 'Grad'],
  ['kontakt_nacin', 'Kako kontaktirati'], ['kontakt_kada', 'Kada kontaktirati'],
  ['usluge', 'Usluge'], ['kanali', 'Gdje se koristi'], ['budzet', 'Budžet'], ['rok', 'Rok'], ['opis', 'Opis projekta']
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents || '{}');
    if (!d.ime || !d.email || !d.opis) return out({ ok: false, error: 'Nedostaju podaci.' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) {
      sh.appendRow(POLJA.map(p => p[1]).concat('Status', 'Bilješke'));
      sh.getRange(1, 1, 1, POLJA.length + 2).setFontWeight('bold').setBackground('#0B1E44').setFontColor('#FFFFFF');
      sh.setFrozenRows(1);
    }
    d.nr = noviBroj_(sh);
    sh.appendRow(POLJA.map(p => String(d[p[0]] || '').slice(0, 5000)).concat('Novo', ''));

    const red = POLJA.filter(p => d[p[0]]).map(p => p[1] + ': ' + d[p[0]]).join('\n');
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      replyTo: d.email,
      subject: 'Novi upit ' + d.nr + ': ' + (d.firma || d.ime) + ' – ' + (d.usluge || 'video'),
      body: red + '\n\nOdgovori direktno na ovaj mail (ide klijentu).\nTablica: ' + ss.getUrl()
    });
    MailApp.sendEmail({
      to: d.email,
      name: NAZIV,
      replyTo: NOTIFY_EMAIL,
      subject: 'Primili smo Vaš upit ' + d.nr,
      htmlBody: potvrda_(d)
    });
    return out({ ok: true, nr: d.nr });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return out({ ok: true, servis: 'horizont-video_production' }); }

function noviBroj_(sh) {
  const god = new Date().getFullYear(), pre = 'UP-' + god + '-';
  const n = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat()
    .filter(v => String(v).startsWith(pre)).map(v => +String(v).slice(pre.length) || 0) : [];
  return pre + String((n.length ? Math.max.apply(null, n) : 0) + 1).padStart(4, '0');
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
