# Albus – Dumbledores Porträt fürs iPad

Die eigene Web-App zum Porträt aus dem claude.ai-Artefakt. Bild, Animation, Charakter, Gedächtnis
und Wetter sind dieselben. Zusätzlich hört er auf dem iPad ohne Tippen auf „Albus“ und kann mit einer
ElevenLabs-Stimme sprechen.

## So ist sie aufgebaut

```
iPad (Safari) ──► Cloudflare Worker ──► Claude API          (Antworten)
   │                    │          └──► ElevenLabs          (Stimme, optional)
   │                    ├──► KV-Speicher                    (Gedächtnis, Bild, Wetter)
   │                    └──► Bright Sky / DWD                (Wetter, 2× täglich)
   └─ Spracherkennung von Safari: lauscht auf „Albus“
```

- `public/index.html` wird aus `scripts/portrait.html` (dem Artefakt) erzeugt: `python3 scripts/build_page.py`
- `public/app-shim.js` verbindet die Seite mit dem eigenen Server statt mit claude.ai
- `src/worker.js` ist der Server. Er hält alle Schlüssel geheim, das iPad sieht sie nie.

## Was du brauchst

| Was | Wofür | Kosten |
|---|---|---|
| Anthropic-API-Schlüssel ([console.anthropic.com](https://console.anthropic.com)) | Dumbledores Antworten | nach Verbrauch, bei 20 Gesprächsminuten am Tag grob 10–20 € im Monat mit Claude Opus 5.5 |
| Cloudflare-Konto ([dash.cloudflare.com](https://dash.cloudflare.com)) | Hosting | kostenloser Tarif reicht |
| ElevenLabs-Schlüssel und Stimmen-ID (optional) | gute Stimme | je nach Tarif; ohne spricht die iPad-Stimme |
| Ein selbst gewählter Zugangsschlüssel (`APP_TOKEN`) | damit niemand sonst deinen Albus benutzt | – |

## Einrichten (ohne Terminal, im Browser)

1. Bei Cloudflare anmelden → **Workers & Pages** → **Erstellen** → **Repository importieren**.
2. GitHub verbinden, Repository `inspectornice` wählen, Branch `claude/dumbledore-portrait-messenger-q4grnw`,
   **Stammverzeichnis: `albus-app`**. Build-Befehl leer lassen, Deploy-Befehl `npx wrangler deploy`.
3. Nach dem ersten Deploy unter **Einstellungen → Variablen und Geheimnisse** als *Geheimnis* anlegen:
   - `APP_TOKEN` – ein langes Passwort deiner Wahl
   - `ANTHROPIC_API_KEY` – dein Claude-Schlüssel
   - optional `ELEVENLABS_API_KEY` und `ELEVENLABS_VOICE_ID` (die ID der Stimme aus der ElevenLabs-Bibliothek)
4. Erneut deployen. Die Adresse sieht so aus: `https://albus.<dein-name>.workers.dev`

Den KV-Speicher legt Wrangler beim ersten Deploy selbst an. Klappt das nicht, lege unter
**Speicher & Datenbanken → KV** einen Namespace „albus“ an und trage seine ID in `wrangler.jsonc`
bei `kv_namespaces` als `"id"` ein.

### Alternative mit Terminal

```bash
cd albus-app
npm install
npx wrangler login
npx wrangler deploy
npx wrangler secret put APP_TOKEN
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY      # optional
npx wrangler secret put ELEVENLABS_VOICE_ID     # optional
```

## Auf dem iPad

1. In **Safari** einmal `https://albus.<dein-name>.workers.dev/#t=DEIN_APP_TOKEN` öffnen.
   Der Schlüssel wird gespeichert und verschwindet aus der Adresse.
   Nicht „Zum Home-Bildschirm“ hinzufügen: Als installierte Web-App verliert Safari das Mikrofon.
2. Ins Bild tippen und das Mikrofon erlauben.
3. Einstellungen → **Ständig zuhören** einschalten. Danach reagiert er auf „Albus“.
4. **Wandmodus** und **Vollbild** antippen.
5. iPad-Einstellungen: *Anzeige & Helligkeit → Automatische Sperre → Nie*,
   *Bedienungshilfen → Geführter Zugriff* einschalten, damit Safari im Vordergrund bleibt.
6. Ohne ElevenLabs: unter *Bedienungshilfen → Gesprochene Inhalte → Stimmen → Deutsch* „Markus“ oder
   „Yannick“ (Premium) laden.

## Datenschutz

- Solange „Ständig zuhören“ an ist, geht alles, was im Raum gesprochen wird, an die Spracherkennung
  von Apple. Das ist die eingebaute Diktierfunktion von Safari.
- Was du Albus sagst, geht an deinen Worker und von dort an Claude. Die Stimme läuft über ElevenLabs.
- Gedächtnis und Bild liegen in deinem Cloudflare-KV-Speicher.

## Modell

Standard ist `claude-opus-5-5` (Variable `ALBUS_MODEL` in `wrangler.jsonc`). Wenn dir die Antworten zu
langsam sind, kannst du dort ein schnelleres Modell eintragen, etwa `claude-sonnet-5-5` oder
`claude-haiku-5-5`.
