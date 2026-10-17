# Architektur der neuen Ansicht

Statische Seite ohne Build-Schritt für den Code: `public/next.html` lädt Leaflet und die Module aus `public/js/` als normale Skripte. Schwere Bibliotheken kommen erst bei Bedarf (three.js für 3D, jsPDF für Berichte, geotiff für Wasser).

## Reihenfolge und Schichten

```
next.html ─ Kern: Karte, Quartiere, Klimabelastung, Profil, Legende, Kopfzeile, Sprache  → window.__NX
  ├─ lab.js            Straßenlabor-Kern + Sonne + Hitze (inkl. Kühl-Lücken)               → window.LAB, LAB.api
  ├─ lab-street.js     Straßenquerschnitt              ┐
  ├─ lab-water.js      Starkregen, Deichbruch, Zukunft │ melden sich mit LAB.addTool({...}) an
  ├─ lab-measures.js   Maßnahmen im Querschnitt         │
  ├─ lab-wind.js       Wind (2D)                        │
  ├─ lab-area.js       Fläche + Export                  │
  ├─ lab-studio.js     Studio, Diagramme, Laserschnitt  │
  ├─ lab-standort.js   Standort-Check                   │
  ├─ lab-route.js      Kühle Route                      │
  ├─ lab-cad.js        CAD-Paket (Export) + Gebäudeanalyse ┘
  ├─ lab-3d.js         3D-Spielstadt (LAB.v3d)
  ├─ act.js            Handeln: Missionen und Fälle (window.ACT)
  └─ nx-more.js        Methodik, Alle Quartiere, Begriffe, Befehle, Hitze-Hinweis, Bericht, Mitwirken, Utrecht jetzt (window.NXM)
```

## Verträge

**`window.__NX`** (Kern) — u. a. `BU` (Quartiere), `score/grade/parts/RISKS/ALL`, `openBuurt`, `closePanel`, `setTheme`, `openLab`, `syncView`, `map`, `T(de,en,nl)`, `lang()`, `fmt/nf/rnd`, `KN` (KNMI'23).

**Ereignisse auf `document`**
- `nx:panel` (detail = Quartier) — nach jedem Profil-Aufbau; nx-more hängt die Aktionsleiste an.
- `nx:theme` (detail = `'light'` | `'dark'`) — nach jedem Wechsel der Darstellung (System oder Menü).
- `nx:view` (detail = `'street'` | `'city'`) — beim Wechsel der Perspektive. **Jede Ebene, die nur zu einer Perspektive gehört, blendet sich hier aus bzw. ein** (Missionen, Meldungen, Messstationen …).

**Labor-Werkzeug** (`LAB.addTool`)

| Feld | Bedeutung |
|---|---|
| `id`, `order`, `grp` | Kennung, Reihenfolge, Gruppe `'see'` (Verstehen), `'check'` (Prüfen) oder `'make'` (Gestalten) |
| `gate:false` | Werkzeug geht auch weit herausgezoomt (sonst ab Zoom 16) |
| `icon`, `label()`, `sub()` | Knopf und Untertitel, dreisprachig über `T` |
| `render(api)`, `bind(root,api)` | Inhalt des Bedienfelds und seine Ereignisse |
| `load(api)` | Daten holen/rechnen; Statuszeile über `api.status(text,busy)` |
| `draw(g,X,api)` | Zeichnen auf die Labor-Leinwand; Weltkoordinaten über `api.w20`, `X.k/ox/oy/sc` |
| `click(e)` | Tippen auf die Karte; Rückgabe = Infotext oder `null` |
| `note()`, `src()` | „Wie wird gerechnet?" und Quellen — Pflicht |
| `enter/leave/tick` | optional |

Daten fürs Gebiet immer mit `api.ensure(kind,bounds)` laden (eigene Liste, leert die Ansicht nicht).

## Regeln, die schon einmal wehgetan haben

- **Kommentare:** Die Module sind lange Einzeiler. Nie `// …` mitten in eine Zeile setzen — es verschluckt den Rest der Zeile.
- **Klassennamen:** `.top` gehört der Kopfzeile. Allgemeine Namen in Bausteinen vermeiden (eine Karte mit `.top` lag einmal fest über dem Querschnitt).
- **Hell/Dunkel:** Standard folgt dem System; im Mehr-Menü fest wählbar (System · Hell · Dunkel, gespeichert als `nx_look`, vor dem ersten Zeichnen im `<head>` gesetzt). Wer Farben je Modus rechnet, hört auf das Ereignis `nx:theme`.
- **Knöpfe** brauchen eigene Gestaltung (`border:none;background:none` oder eigene Farbe) — sonst zeigt der Browser graue Standardknöpfe, im Dunkelmodus besonders auffällig.
- **Farben** nur über Tokens (`--ink`, `--ink2`, `--mute`, `--card`, `--sheet`, `--glass`, `--pos`, `--neg`); jedes Token hat eine Dunkel-Variante.
- **Schrift** in `rem`; Tippflächen ≥ 44 px am Handy; Glas nur auf Bedienelementen, Textflächen fast deckend.
- **Ehrlichkeit:** Schätzungen als Schätzung benennen, Quelle und Jahr nennen, bei Ausfall „gerade nicht erreichbar" statt leerer Zahl.
- **Langsame Fremddienste** (OpenStreetMap/Overpass) nie blockierend: amtliche Werte zuerst zeigen, Fremdes nachladen, Zeitlimit setzen.
- **Leaflet:** `setView` während einer Kamerafahrt wird verschluckt — vorher `map.stop()`.

## CAD-Ausgaben (lab-cad.js)

- **Koordinaten:** Pläne (DXF/SVG) in echten RD-Koordinaten (EPSG:28992), Höhen in m NAP. 3D-Rohdaten (DXF 3D, OBJ) mit lokalem Ursprung. IFC lokal mit `IfcMapConversion` (Verschiebung = linke untere Ecke des Gebiets).
- **DXF:** R12 (AC1009), Text nur ASCII (Umlaute umschrieben, Akzente entfernt), Ebenen siehe `LAY`. Höhenlinien aus AHN `dtm_05m`, geglättet, an Wasserflächen aufgetrennt.
- **IFC4 (ReferenceView):** `IfcProject → IfcSite → IfcBuilding` je 3D-BAG-Gebäude mit `IfcBuildingElementProxy` (extrudierter Grundriss), Gelände als `IfcGeographicElement` (`.TERRAIN.`, `IfcTriangulatedFaceSet`), Eigenschaften in `Pset_InspectorNice` und `Pset_BuildingCommon`.
- **STL:** binär, wasserdicht (geprüft in `qa_cad`), Sockel ≥ 3 mm, Wasser als ebene Rinne, Gebäude 1 m eingelassen, Relief wählbar überhöht.
- **Gebäude:** 3D BAG (`identificatie`, `b3_h_max`, `b3_h_nok`, `b3_bouwlagen`, `b3_opp_buitenmuur`, `b3_opp_scheidingsmuur`, `b3_volume_lod22`), BAG-Einheiten über die **interne Kennung (UUID)** des Gebäudes (`pand.href`), Denkmalregister (RCE, PDOK `ps-ch`) liefert **RD-Koordinaten**.

## Prüfen

- `npm test` — jsdom, ohne Netz. Die Prüfungen setzen die Module per Regex in die Seite ein: `<script src="js/(lab…|act|nx-…).js">`. Ein neues Modul muss in dieses Muster passen.
- `npm run check:live` — echte Anfrage an jede Datenquelle (täglich per GitHub Action, sobald `react-app` Standard-Branch ist).
- `tests/smoke-live.mjs` — Durchlauf aller Funktionen im echten Browser mit echten Daten. Im Dev-Server in der Konsole:
  `const m=await import('/tests/smoke-live.mjs?'+Date.now()); m.start({lang:'de'})` → Ergebnis in `window.__smoke`.
- `tests/hig-live.mjs` — Apple-Regel-Check jeder Oberfläche in Hell und Dunkel: Kontrast nach Überblendung (4,5:1, große Schrift 3:1), Schrift ≥ 11 px, Tippflächen (Handy 44 px, Desktop 24 px; Begriffe im Fließtext ausgenommen), Browser-Standardknöpfe, Namen für Bildschirmleser, Escape, Querscrollen. Für das Handy das Fenster vorher auf 375 px stellen.
  `const m=await import('/tests/hig-live.mjs?'+Date.now()); m.start()` → Ergebnis in `window.__hig`.

## Daten aufbereiten

`tools/fetch_buurten_utr.cjs` erzeugt `buurten_utr.json`; danach `tools/fetch_leefbaarometer_utr.cjs` (ergänzt die Lebensqualität). Straßenschatten: `tools/fetch_streets_utr.cjs`, Klimaszenarien: `tools/fetch_knmi23.cjs`. Die Skripte schreiben direkt nach `public/data/official/`.

## Bekannte Grenzen von außen

- Overpass (OpenStreetMap) ist oft überlastet → nur noch für Haltestellen genutzt, mit ehrlichem Hinweis.
- Supabase (Mitwirken) ist pausiert → Meldungen bleiben auf dem Gerät und werden nachgereicht.
- Live-Busse (OVapi) und Leihräder bräuchten einen eigenen Zwischendienst (keine CORS-Freigabe bzw. kein offener Feed).
