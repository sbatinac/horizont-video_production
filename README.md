# Horizont LHB – video produkcija

Web stranica video produkcije (bijela, plavo-zlatna). Radovi (slike, video, PDF) učitavaju se s Google Drivea, upiti idu u Google tablicu, a nalozi se vode u `admin.html`.

## Drive
Mape *Slike*, *Video materijali* i *PDF materijali* već su upisane u `index.html` (`FOLDERS`). Podmape postaju tabovi. Novi sadržaj vidi se nakon osvježavanja.

## Google skripta (upiti + admin)
1. Nova Google tablica, npr. *Horizont video – upiti*.
2. **Proširenja → Apps Script**, obriši sve i zalijepi `apps-script/Code.gs`.
3. Upiši `ADMIN_KEY` (lozinka za admin) i provjeri `NOTIFY_EMAIL` → **Spremi**.
4. Odaberi funkciju `odobriDozvole` → **Pokreni** → dopusti pristup.
5. **Implementiraj → Nova implementacija → Web aplikacija**: Izvrši kao **Ja**, Pristup **Svi** → Implementiraj.
6. `/exec` link upiši u `index.html` i `admin.html` (`const ENDPOINT = '…'`).

Nakon izmjene skripte: Implementiraj → Upravljanje implementacijama → ✏️ → Nova verzija.

## Admin
`https://sbatinac.github.io/horizont-video_production/admin.html`
Upiti, otvaranje naloga, štoperica i evidencija rada, obračun (satnica u ⚙ Postavke, zadano 100 €/h, ne prikazuje se javno), napomena da nisi u sustavu PDV-a, plaćanje, ispis obračuna i poruke klijentu.

## Glazba
`glazba-1.mp3` (Neon Sunset Drive) i `glazba-2.mp3` (Neon Overdrive), gumbi u zaglavlju, sviraju samo na klik.
