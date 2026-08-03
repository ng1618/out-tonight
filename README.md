# out-tonight

Sammelt Veranstaltungen an einem Ort: abfotografierte Plakate und Programmseiten,
geteilte Links, Venue-Programme. Später die Frage „was läuft heute Abend?"

**Mobile-first.** Das Telefon hält alle Daten; der Server speichert nichts.

---

## Starten

```bash
npm install
npm run dev
```

Dann `http://localhost:3001` (oder den Port, den `next dev` meldet). Für eine
realistische Ansicht: F12 → Strg+Umschalt+M → Gerät wählen.

Es gibt **keine Datenbank einzurichten** und **keinen API-Schlüssel**. Beim ersten
Start lädt die OCR ein ~6 MB großes Modell nach und legt es im Browser-Cache ab.

---

## Architektur

| | Läuft wo | Hält |
|---|---|---|
| **Telefon (PWA)** | IndexedDB | **Alles** — Events, Likes, Venues, Serien, Fotos, OCR-Läufe, Kandidaten |
| **Server** | Zwei Endpunkte | **Nichts** |

Der Server beantwortet nur die zwei Fragen, die ein Browser nicht selbst stellen
kann:

- `POST /api/fetch-parse` — Seite abrufen und parsen (CORS verbietet das im Browser)
- `GET /api/geocode` — Nominatim (verlangt einen User-Agent, den `fetch` nicht setzen darf)

Weil serverseitig nichts persistiert wird, läuft das auf kostenlosem
Static-Hosting. Ohne Verbindung funktioniert alles außer *Link einfügen* und
*Venue aktualisieren*.

---

## Wie ein Foto zu einem Event wird

1. **Zuschneiden** — Ecken auf das Plakat ziehen. Wichtigster Einzelschritt:
   auf der KREA-Seite stiegen die korrekten Titel dadurch von 4/10 auf 9/10
   (`ERGEBNISSE.md`).
2. **Vorverarbeitung** — vier Drehungen × (roh / kontrastverstärkt); die Variante
   mit der besten `Zeichen × Konfidenz` gewinnt.
3. **OCR** — PaddleOCR (PP-OCRv6) im Browser, WebGPU wenn vorhanden.
4. **Regeln** — deutsche Datums-, Zeit- und Preisformate; Kategorie vom
   gedruckten Label, sonst als Vorschlag.
5. **Prüfen** — Kandidaten korrigieren und bestätigen. Nichts landet ungefragt
   im Feed.

Das Foto bleibt unverändert gespeichert, ein Zuschnitt lässt sich jederzeit
wiederholen.

---

## Dokumente

| Datei | Inhalt |
|---|---|
| `ENTSCHEIDUNGEN.md` | Entscheidungslog — bei Widerspruch gilt diese Datei |
| `ERGEBNISSE.md` | Gemessene Extraktionsqualität, widerlegte Annahmen |
| `LEARNINGS.md` | Übertragbare Konzepte in Frageform |
| `NOTIZEN.md` | Testdatensatz, geprüfte Bibliotheken, offene Beobachtungen |

Das Arbeitsdokument mit dem Terminplan liegt außerhalb des Repos (gitignored).

---

## Stand

Läuft lokal, noch nicht auf dem Telefon. Nächster Schritt: `adb reverse` für
einen ersten Geschwindigkeitstest auf dem Gerät, dann Feldtest mit
JSON-Export der Logs.

**Bekannte Grenzen:** gestaltete Einzelplakate scheitern häufig (offenes
Forschungsproblem, keine Bibliothek löst das), Preise werden aus echten Fotos
praktisch nie gelesen, Titel bleiben Handarbeit — dafür gibt es das Antippen
der erkannten Textkästen.
