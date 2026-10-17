# Inspector Nice

Klimarisiken und die Menschen, die sie treffen — für Utrecht, nur aus offenen, amtlichen Daten.
Live: **https://inspectornice.nicehere.nl** (neue Ansicht `next.html` ist die Startseite, die klassische Ansicht bleibt über `index.html?classic` erreichbar).

## Zwei Perspektiven

| | Stadt | Straße |
|---|---|---|
| Frage | Wo ist die Belastung am größten, wen trifft sie? | Was passiert genau hier, und was hilft? |
| Inhalt | Klimabelastung A–E je Quartier, Menschen- und Wandel-Themen, Profile, Missionen | Straßenlabor: 10 Werkzeuge in „Verstehen" und „Gestalten", 3D-Spielstadt |
| Daten | CBS, RIVM, GGD, Gemeente, LIWO, Leefbaarometer | 3D BAG, BGT, AHN, NWB, LIWO, Baumregister, Open-Meteo |

Umgeschaltet wird oben mit **Stadt | Straße**; jede Perspektive zeigt nur ihre eigenen Ebenen.

## Schnellstart

```bash
npm install
npm run dev          # http://localhost:5199/next.html
npm test             # alle jsdom-Prüfungen (ohne Netz, ≈ 70 s)
npm run check:live   # echte Anfrage an alle 22 Datenquellen
npm run build        # dist/ (index.html + public/ werden kopiert)
```

Deploy: `git push origin main:react-app` → GitHub Actions → Pages (`.github/workflows/deploy.yml`).

## Aufbau

- `public/next.html` — neue Ansicht: Karte, Klimabelastung, Profile, Legende, Kopfzeile (Stil und Kernlogik in einer Datei)
- `public/js/` — Module, die sich an `window.__NX` (Kern) bzw. `window.LAB` (Straßenlabor) hängen
- `public/data/official/` — vorbereitete amtliche Daten (Quartiere, Bäume, Straßenschatten, KNMI'23 …)
- `tools/` — Abruf- und Aufbereitungsskripte für diese Daten, `live_check.cjs`
- `tests/` — jsdom-Prüfungen `qa_*.cjs`, `run.cjs`, Live-Durchlauf `smoke-live.mjs`
- `index.html`, `public/dashboard.html`, `public/methodik.html` — klassische Ansicht (auch Frankfurt)

Mehr: [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md) · [docs/FUNKTIONEN.md](docs/FUNKTIONEN.md) · [ONTOLOGY_ROADMAP.md](ONTOLOGY_ROADMAP.md)

## Grundsätze

- Nur offene Daten, Quelle und Jahr an jeder Zahl, „ungeprüft" wo nicht geprüft; keine Kameras, keine Daten über einzelne Menschen.
- Apple-HIG als Maßstab: Schrift in rem und ≥ 11 px, Tippflächen ≥ 44 px, Kontrast ≥ 4,5 : 1 in hell und dunkel, Hell/Dunkel nach System.
- Vor jedem Deploy `npm test`; bei sichtbaren Änderungen zusätzlich im Browser prüfen.
