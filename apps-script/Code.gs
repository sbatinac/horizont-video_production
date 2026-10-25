/**
 * Horizont LHB – video produkcija
 * Upiti za ponudu: upis u Google tablicu + mail obavijest + kratka potvrda klijentu.
 * Zalijepi u Google tablicu → Proširenja → Apps Script → Deploy kao Web app (Execute as: Me, Access: Anyone).
 */
const NOTIFY_EMAIL = 'horizont.servisi@gmail.com'; // promijeni ako upiti trebaju ići na drugu adresu
const SHEET_NAME = 'Upiti';
const POLJA = [
  ['vrijeme', 'Vrijeme'], ['firma', 'Firma'], ['ime', 'Kontakt osoba'], ['email', 'E-pošta'], ['telefon', 'Telefon'],
  ['usluge', 'Usluge'], ['kanali', 'Gdje se koristi'], ['budzet', 'Budžet'], ['rok', 'Rok'], ['opis', 'Opis projekta']
];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents || '{}');
    if (!d.firma || !d.email || !d.opis) return out({ ok: false, error: 'nedostaju podaci' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) {
      sh.appendRow(POLJA.map(p => p[1]).concat('Status'));
      sh.getRange(1, 1, 1, POLJA.length + 1).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    sh.appendRow(POLJA.map(p => String(d[p[0]] || '').slice(0, 5000)).concat('Novo'));

    const tijelo = POLJA.map(p => p[1] + ': ' + (d[p[0]] || '–')).join('\n');
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      replyTo: d.email,
      subject: 'Novi upit za video: ' + d.firma,
      body: tijelo + '\n\nTablica: ' + ss.getUrl()
    });
    MailApp.sendEmail({
      to: d.email,
      name: 'Horizont LHB – video produkcija',
      replyTo: NOTIFY_EMAIL,
      subject: 'Primili smo Vaš upit',
      body: 'Poštovani,\n\nhvala na upitu za ' + (d.usluge || 'projekt') + '. Javljamo se uskoro s idejom i ponudom.\n\n' +
        'Za brži dogovor: 091/358 4122 (poziv, WhatsApp, Viber).\n\nHorizont LHB d.o.o. – video produkcija'
    });
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function doGet() { return out({ ok: true, servis: 'horizont-video_production' }); }

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
