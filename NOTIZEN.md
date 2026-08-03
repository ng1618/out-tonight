# Notizen — out-tonight

<!-- Geparkte Links, Ideen, Beobachtungen. Datum davor. Nichts hier ist entschieden. -->

## 02.08.2026 — Testdatensatz Plakate

Acht Fotos aus dem STUZ-Sommerheft (Wiesbaden/Mainz) durchgetestet. Die Bilder sind
der Anfang des Eval-Satzes für Phase E (Arbeitsdokument Abschnitt 11 verlangt 30–50).
Bisher gesammelt:

| Quelle | Wofür der Fall gut ist |
|---|---|
| Schlachthof-Spalte (STUZ) | Liste ohne Jahr; ein Eintrag mit abweichendem Ort in Klammern |
| After-Work Shipping (Primus-Linie) | Zwei Termine für dieselbe Reihe in einer Anzeige; Ort ist ein Schiff |
| GOT BAG Bagyard Sale | Kein Konzert — Grenzfall „ist das ein Event?"; Uhrzeit als Spanne |
| KREA-Programm | 14 Einträge, Kategorien mitgedruckt, zwei Events am selben Tag |
| Flörsheimer Open Air | Mehrtägig (17.–19.7.), Eintritt frei |
| Volk im Schloss | Mehrtägig, Bild um 90° gedreht, langes Lineup |
| Staatstheater Theaterfest | Gedreht **und** unscharf, Finger im Bild, „ab 14:00" |
| Hauswald Open Air | „18 JULI 26" mehrdeutig; Dublette zur KREA-Spalte |
| Riverside Stomp | Einlasszeit ≠ Beginn, Abendkasse 20 € |
| Programm im KUZ | Sechs Einträge ohne Jahr, Kategorien mitgedruckt |

Ältere Plakate zum Vergleich (nicht aus dem Heft): Ritchie Blackmore's Rainbow 1976 —
sauberer Einzelfall trotz Wasserzeichen; zwei generische Vorlagen aus dem Netz, bei denen
schon unklar ist, ob es die Veranstaltung überhaupt gibt.

**Noch nicht im Datensatz, fehlt für Phase E:** Instagram-Screenshots (anderes Format,
anderer Textstil), Handzettel/Flyer, Kreidetafeln vor Läden.

## 02.08.2026 — OCR-Messung

Der Testdatensatz oben ist einmal komplett durch die lokale OCR gelaufen.
Zahlen, Modellvergleich und widerlegte Annahmen stehen in **`ERGEBNISSE.md`**.
Kurzfassung: 6 von 10 Fotos verwertbar, Programmseiten sehr gut (33 Termine),
gestaltete Einzelplakate gar nicht.

Geprüfte Bibliotheken (Stand 02.08.2026):

| Paket | Lizenz | Zuletzt aktualisiert | Bewertung |
|---|---|---|---|
| `ppu-paddle-ocr` | MIT | Jul 2026 | **eingesetzt** — PP-OCRv6, Boxen + Konfidenz, offline |
| `tesseract.js` | Apache-2.0 | Dez 2025 | gepflegt, aber scheitert an gestalteten Schriften |
| `@gutenye/ocr-node` | MIT | **Dez 2024** | PaddleOCR-basiert, aber ~20 Monate ohne Pflege |
| `scribe.js-ocr` | **AGPL-3.0** | Jul 2026 | meiden — Copyleft würde bei öffentlichem Repo die ganze App erfassen |

## 02.08.2026 — Offene Beobachtungen

- Die Systemuhr dieses Rechners und das Datum im Arbeitsdokument liefen auseinander
  (DB schrieb 15.07., Dokument sagt 02.08.). Relevant, sobald das Jahr aus dem
  Aufnahmedatum abgeleitet werden soll — dann ist eine falsche Uhr ein Datenfehler.
- Schlachthof liefert auf der Übersichtsseite **keine Uhrzeiten**, nur Tagesdaten.
  Uhrzeit stünde vermutlich auf den Einzelseiten — 170 Unterseiten abrufen ist aber
  weder nötig noch höflich. Vorerst offen lassen.
- Einwortige Ortsnamen („Ringkirche", „Kreativfabrik") werden ohne Stadtzusatz
  geokodiert. Nominatim hat sie zufällig richtig aufgelöst; verlassen sollte man sich
  darauf nicht.
- Kategorien werden im STUZ schon mitgeliefert (KONZERT, PARTY, LESUNG …). Falls später
  ein Modell klassifiziert: Diese Labels sind der Erwartungswert, nicht die Vorhersage.

## Geparkte Links

- MDN `share_target`: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target
- Nominatim Nutzungsregeln (1 Anfrage/Sekunde, User-Agent Pflicht):
  https://operations.osmfoundation.org/policies/nominatim/
- SQLite, Schemaänderungen jenseits von ADD COLUMN:
  https://www.sqlite.org/lang_altertable.html#otheralter
