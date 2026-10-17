# Funktionen der neuen Ansicht

Stand 17. Oktober 2026. Jede Zeile nennt die Datenquelle und die Prüfung (`tests/…`). Alles wurde zusätzlich mit `tests/smoke-live.mjs` im echten Browser durchgespielt: Deutsch, Englisch, Niederländisch · hell und dunkel · Desktop und Handy · je drei Orte.

## Stadt (Quartiere)

| Funktion | Daten | Prüfung |
|---|---|---|
| Klimabelastung 0–100 und Noten A–E je Quartier (Hitze, Lärm, Kronendach, Schatten auf Wegen) | RIVM, GGD-Monitor, Gemeente Utrecht | qa_next |
| Themen Risiken · Menschen · Wandel, Legende mit Richtwert und Quelle | CBS, GGD, BAG, Leefbaarometer | qa_next, qa_more |
| Quartiersprofil: Risiken in Menschen, Zukunft (Tropentage), wer hier lebt, was hilft, was gebaut wird | CBS, KNMI'23, BAG, Muster-Katalog | qa_next |
| „Was gilt hier?": je Risiko alle passenden Regeln nach Verbindlichkeit (Pflicht · Teils Pflicht · Ziel · Empfehlung · Faustregel), Soll gegen Ist, „nicht direkt vergleichbar" mit Grund, Einteilung der App getrennt ausgewiesen | data/rahmen_utr.json (28 Regeln mit Quelle) | qa_norms |
| Aktionen im Profil: Merken, Vergleichen, PDF-Bericht, Melden | — | qa_more |
| Handeln: Missionen Kühle Wege, Hitzesichere Schulen, Starkregen; Fälle mit ID, Status, Brief | Gemeente (Schaduw wegdelen, Knelpunte), POIs, Rahmenwerk | qa_act |
| Suche: Adressen und Quartiere | PDOK Locatieserver | qa_next |

## Mehr-Menü

| Funktion | Daten | Prüfung |
|---|---|---|
| Alle Quartiere: Tabelle (sortieren, filtern, Merkliste, CSV), Ranglisten, Vergleich bis 3 | wie oben | qa_more |
| Utrecht jetzt: Wetter, Regen 2 h, Luft an 3 RIVM-Stationen mit WHO-Vergleich | Open-Meteo, Luchtmeetnet | qa_more |
| Methodik und Quellen, Begriffe | Metadaten der Daten | qa_more |
| Regeln und Richtwerte: alle Regeln nach Stufe, Filter nach Thema, Quelle und Stand, „ungeprüft" markiert | data/rahmen_utr.json | qa_norms |
| Befehle (⌘K / Strg K) | — | qa_more |
| Etwas melden (7 Arten, ohne Freitext) | Supabase, sonst Gerät | qa_more |
| Hitze-Hinweis ab 27 °C; meldet eine Hitzewelle nach KNMI-Definition (5 Tage ≥ 25 °C, 3 ≥ 30 °C). Den Nationalen Hitzeplan aktiviert das RIVM ohne feste Gradzahl | Open-Meteo | qa_more |
| Sprache DE · EN · NL, Darstellung System · Hell · Dunkel, Klassische Ansicht | — | qa_next |

## Straße (Straßenlabor)

| Gruppe | Werkzeug | Daten | Prüfung |
|---|---|---|---|
| Verstehen | Sonne: Schatten jetzt, Sonnenstunden, Sonnenbahn am Punkt | 3D BAG, Baumregister, AHN | qa_lab |
| | Hitze: Oberflächen, Hitze-Index, Kühl-Lücken (21. Juni, zweistufig) | BGT, 3D BAG, Baumregister | qa_lab, qa_more |
| | Wasser: Starkregen-Mulden, Deichbruch, Zukunft, Gelände | AHN, LIWO, Gemeente-Knelpunte | qa_lab_tools |
| | Wind: Strömung und Wetter 36 h | Open-Meteo (KNMI HARMONIE) | qa_lab_tools |
| Prüfen | Standort: Läden, Bildung, Gesundheit, Sport, Gastro, Grün in Gehweite, Haltestellen, Klima am Ort, Straßenfoto | BAG, BGT, OSM, RIVM, Panoramax | qa_more |
| | Route: schattigster gegen kürzesten Fußweg, Bänke unterwegs | NWB, Schaduw wegdelen, Straatmeubilair | qa_more |
| | Gebäude: Maße, Höhen (70 %, max., First), Geschosse, Volumen, Geschossfläche amtlich, Nutzung, Adressen, Fassaden je Himmelsrichtung, Trennwände, Dach, Solar grob, Rijksmonument, geschütztes Stadtbild, Wärmeinsel, Bäume; Pläne nur für dieses Haus | 3D BAG, BAG, RCE, RIVM, Baumregister | qa_cad |
| | Fläche: Kreis, Zeichnen, Ausschnitt — Kennzahlen | BGT, 3D BAG, Bäume | qa_lab_tools |
| Gestalten | Straße: Querschnitt Fassade zu Fassade, Umbau, Maßnahmen mit Kosten, Förderung, Regelwerk | BGT, 3D BAG, NWB, Rahmenwerk, Kanalerneuerung | qa_lab_tools |
| | Studio: Diagramme, Explosionszeichnung, Laserschnitt-ZIP | alle oben | qa_studio |
| | CAD: Lageplan 1:500/1:1000 (DXF + SVG: Höhen, Höhenlinien, Höhenpunkte, Straßennamen, Nordpfeil, Maßstab, Schriftfeld), Umgebungsplan 1:2500, Ansichten N/O/S/W mit Höhen, IFC4 georeferenziert mit Gelände, STL-3D-Druck; Rohdaten DXF/OBJ/GeoJSON/SVG | 3D BAG, BGT, AHN, NWB, Baumregister | qa_cad, qa_lab_tools |

## 3D-Spielstadt (aus Sonne und Befehlen)

| Modus | Inhalt | Daten |
|---|---|---|
| Licht | Sonnenuhr: Kompassring, Sonnenbogen mit Stunden, Auf-/Untergang, Strahl, Zeit- und Datumsregler, Augenhöhe | 3D BAG, AHN, Baumregister |
| Wasser | Wolkenbruch, Deichbruch (LIWO), Wasserstand | AHN, LIWO |
| Wind | Strömung zwischen Gebäuden, Richtung wählbar (Veranschaulichung) | Open-Meteo, 3D BAG |
| Unterwegs | Radverkehr, Fußgänger mit Schattensuche, selbst fahren | NWB |
| Zeitreise | Baujahre bis heute, dann im Bau / genehmigt / Abriss, Kanalerneuerung | BAG, Gemeente |

Prüfung: qa_more (Code-Merkmale), im Browser per `smoke-live.mjs` und Bildvergleich; jsdom kann kein WebGL.

## Querschnitt

Zwei Perspektiven Stadt | Straße ohne Überlagerung, Apple-HIG (rem-Schrift, Fokusring, Kontrastmodus, 44-px-Flächen), Hell/Dunkel nach System, tägliche Live-Prüfung der Quellen (`npm run check:live`), Apple-Regel-Check aller Oberflächen (`tests/hig-live.mjs`).
