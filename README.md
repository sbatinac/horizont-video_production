# Horizont LHB – video produkcija

Web stranica za video produkciju (za firme). Isti raspored kao [Horizont servisi](https://sbatinac.github.io/horizont-servisi/), vlastite boje iz logotipa. Slike, video i PDF radovi učitavaju se izravno s Google Drivea.

## 1. Drive mape (galerija radova)
Napravi tri mape: **Slike**, **Video** i **PDF**. Svaku podijeli kao **Svi s poveznicom → Preglednik**.

- Podmape postaju tabovi (npr. *Logotipi*, *Reels*, *Promo*, *Katalozi*).
- Datoteke izravno u glavnoj mapi idu pod tab **Ostalo**.
- Dok ID mape nije upisan, sekcija prikazuje polja „Uskoro”. Upisana, a prazna mapa = sekcija se skriva.

ID mape je dio linka iza `/folders/`. Upiši ga u `index.html`:

```js
const FOLDERS = {
  gallery: 'ID_MAPE_SLIKE',
  video:   'ID_MAPE_VIDEO',
  pdf:     'ID_MAPE_PDF'
};
```

Drive API ključ je isti kao na servisima (zaključan na `https://sbatinac.github.io/*`).

## 2. GitHub Pages
1. Novi javni repo **`horizont-video_production`**, učitaj sve datoteke iz ove mape (i `.nojekyll`).
2. Settings → Pages → Branch: `main` / root → Save.
3. Stranica: `https://sbatinac.github.io/horizont-video_production/`

`SITE_URL` u `index.html` već je postavljen na ovu adresu.

## 3. Obrazac „Zatraži ponudu” (Google tablica + mail)
1. Nova **Google tablica**, npr. *Horizont video – upiti*.
2. **Proširenja → Apps Script**, obriši sve i zalijepi `apps-script/Code.gs`.
3. Provjeri `NOTIFY_EMAIL` (na koji mail stižu upiti) → **Spremi**.
4. **Deploy → New deployment → Web app**: Execute as **Me**, Who has access **Anyone** → Deploy → dopusti pristup.
5. Kopiraj **Web app URL** (`…/exec`) u `index.html`:
   ```js
   const ENDPOINT = 'https://script.google.com/macros/s/…/exec';
   ```

Svaki upit: novi red u listu *Upiti*, mail tebi (Reply ide izravno klijentu) i kratka potvrda klijentu.
Nakon promjene skripte: Deploy → Manage deployments → ✏️ → **New version**.

## Datoteke
- `intro.mp4` – animirani logo na vrhu (bez zvuka dok posjetitelj ne klikne „Uključi zvuk”)
- `intro-poster.webp`, `intro-kraj.webp` – prvi i zadnji kadar
- `logo.webp`, `logo-znak.webp`, `favicon.png`, `og.jpg` (slika za dijeljenje na mrežama)
