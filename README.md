# Träning & Kost

Personlig tränings- och kostapp för mobilen (installerbar PWA, svenskt gränssnitt). Ingen backend, inga konton, inga nätverksanrop. Datan sparas lokalt på enheten.

Det här är steg 1 (grund och design): skalet, navigeringen och lagringen. Själva träningen och kosten kommer i senare steg.

## Köra lokalt

Appen är vanlig HTML/CSS/JS utan byggsteg. Servera mappen statiskt, till exempel:

```
python -m http.server 8080
```

Öppna sedan `http://localhost:8080`. Service worker och installation fungerar på `localhost` och på HTTPS, men inte på vanlig `http://` mot en annan adress. Dubbelklick på `index.html` (`file://`) fungerar inte, eftersom ES-moduler kräver en server.

Efter ändringar i filer som cachas: höj versionen i `CACHE` i `sw.js` (t.ex. `traningskost-shell-v2`) och lägg till nya filer i listan `SHELL`.

## Publicera gratis på GitHub Pages

HTTPS krävs för att appen ska kunna installeras, och det får du automatiskt på GitHub Pages.

1. Skapa ett repo på GitHub och pusha koden.
2. Gå till **Settings → Pages**.
3. Under **Build and deployment**, välj **Deploy from a branch**, branch `main` och mapp `/ (root)`. Spara.
4. Efter en minut finns appen på `https://<ditt-användarnamn>.github.io/<repo-namn>/`.

Alla sökvägar i appen är relativa, så den fungerar även under ett repo-namn i adressen.

## Lägga till på Android-hemskärmen

1. Öppna adressen i Chrome på telefonen.
2. Tryck på menyn (⋮) uppe till höger.
3. Välj **Installera app** (eller **Lägg till på startskärmen**).
4. Bekräfta. Appen ligger nu på hemskärmen och öppnas i helskärm utan adressfält.

Första gången måste telefonen ha nätet på så att appen hinner cachas. Därefter fungerar den i flygplansläge.

## Struktur

- `index.html`, `styles.css`, `app.js` – skal, design och router (`#/idag`, `#/vecka`, `#/kost`, `#/profil`)
- `js/store.js` – all lagring (localStorage, nyckel `traningskost.v1`, `schemaVersion` och `migrate()`)
- `js/views/` – en fil per vy
- `sw.js` – service worker (cache-first för appskalet)
- `tools/make-icons.py` – genererar ikonerna i `icons/` (kräver Pillow)
