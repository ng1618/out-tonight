# Entscheidungen — out-tonight

> Je Entscheidung fünf Zeilen: Frage, Wahl, Grund, verworfene Alternative, Datum.
> Neueste oben. Bei Widerspruch zu anderen Dokumenten gilt diese Datei.

---

## Erfassung

### Keine Modell-Extraktion aus Fotos
- **Frage:** Werden Fotos von einem Sprachmodell gelesen oder mit lokaler OCR plus Regeln?
- **Wahl:** **Lokale OCR (`ppu-paddle-ocr`, PP-OCRv6) plus eigene deutsche Regeln.** Kein API-Schlüssel, keine Kosten, offline.
- **Grund:** Für den tatsächlichen Anwendungsfall ist ein Modell mit Kanonen auf Spatzen geschossen. Die Messung stützt das: Programmseiten liefern 33 Termine bei Konfidenz 0,86–0,93 rein regelbasiert (`ERGEBNISSE.md`). Dazu deterministisch, nachvollziehbar und debugbar — ein falsches Ergebnis lässt sich auf eine Regel zurückführen statt auf einen Prompt.
- **Verworfen:** Claude Opus 5 mit Bildverstehen. Der Code dafür war gebaut und lief nie — ohne Schlüssel keine einzige echte Extraktion, also auch kein Beleg, dass es besser gewesen wäre.
- **Preis dafür:** Vier von zehn Fotos (gestaltete Einzelplakate) liefern gar nichts, Preise werden nie erkannt, Titel bleiben Handarbeit.
- **Datum:** 02.08.2026

### Bildvorverarbeitung: raten statt erkennen
- **Frage:** Wie wird mit gedrehten und kontrastarmen Fotos umgegangen?
- **Wahl:** **Alle vier Drehungen × (roh / kontrastverstärkt) durchprobieren** und die beste Variante nach `Zeichenzahl × Konfidenz` wählen.
- **Grund:** Ersetzt eine Orientierungserkennung vollständig und kostet nur ~5 s je Foto. Bei 5 von 10 Fotos gewann nicht das Original; ein Foto ging von **0 Zeilen auf Konfidenz 0,99**.
- **Verworfen:** Drehwinkel über Hough-Transformation bestimmen (Aufwand ohne Mehrwert); EXIF auswerten (die Testfotos haben keine EXIF-Orientierung, und bei einem ist die *Seite im Bild* gedreht, nicht das Bild).
- **Datum:** 02.08.2026

### Kleines OCR-Modell statt großem
- **Frage:** Welche Modellgröße — `V6_TINY` (6 MB), `V6_SMALL` (30 MB) oder `V6_MEDIUM` (139 MB)?
- **Wahl:** **`V6_TINY`**, das Standardmodell.
- **Grund:** Gemessen, nicht angenommen: `V6_MEDIUM` verschlechterte die KREA-Seite von **1257 Zeichen / 16 Terminen auf 629 Zeichen / 5 Termine**. Auch 2×-Hochskalieren verschlechterte das Ergebnis.
- **Verworfen:** „Größer ist besser" — hätte ohne Messung zu einer Halbierung der Trefferquote geführt, die niemandem aufgefallen wäre.
- **Datum:** 02.08.2026

### Wochentag bestimmt das Jahr
- **Frage:** Wie wird das fehlende Jahr bei „SA 04.07." aufgelöst?
- **Wahl:** **Über den gedruckten Wochentag.** Nur das Jahr, dessen Wochentag zum Datum passt, wird genommen; ohne Wochentag Rückfall auf „nächstes Vorkommen".
- **Grund:** Ein im August fotografiertes Juli-Datum würde sonst auf 2027 gesetzt. 04.07.2026 ist ein Samstag, 04.07.2027 ein Sonntag — eindeutig auflösbar. Auf der KREA-Seite hat das **8 Termine** korrekt datiert.
- **Verworfen:** Nur aus dem Kontextdatum ableiten und die Abweichung bloß melden.
- **Datum:** 02.08.2026

### Ist ein Foto gleich ein Event?
- **Frage:** Kann die Erfassung aus einem Foto genau ein Event ableiten?
- **Wahl:** Nein. Die Erfassung liefert eine **Liste von Kandidaten**, aus der bestätigt wird.
- **Grund:** Test mit acht echten Fotos (STUZ-Sommerheft): *jedes* Bild enthielt mehrere unabhängige Veranstaltungen — die Anzeige selbst, angrenzende Spalten anderer Häuser, Tageslisten und Fließtext. Ein einzelnes extrahiertes Event wäre in den meisten Fällen das falsche.
- **Verworfen:** „Ein Foto → ein Event", weil das bei Zeitschriftenseiten und Programmspalten strukturell nicht stimmt.
- **Datum:** 02.08.2026

### Was passiert bei fehlender Jahreszahl?
- **Frage:** Wie wird ein Datum ohne Jahr behandelt („22.08.", „02.10. FR")?
- **Wahl:** Jahr wird **nicht geraten**. Feld bleibt offen und wird zur Bestätigung markiert; Vorschlag darf aus Heft-/Aufnahmedatum kommen.
- **Grund:** Fehlendes Jahr ist der Normalfall, nicht die Ausnahme — Schlachthof-Spalte, After-Work Shipping, GOT BAG und KUZ drucken alle kein Jahr. Nur große Festivalplakate tun es.
- **Verworfen:** „Immer aktuelles Jahr annehmen" — erzeugt stillschweigend falsche Termine, die erst auffallen, wenn der Abend vorbei ist.
- **Datum:** 02.08.2026

### Wie wird ein gelesenes Datum geprüft?
- **Frage:** Gibt es eine Plausibilitätsprüfung ohne externe Quelle?
- **Wahl:** **Wochentag gegen Datum** prüfen, wenn beides gedruckt ist („SA 04.07.", „Sa, 22.8.2026").
- **Grund:** Kostet nichts und fängt genau die zwei häufigsten Fehler: falsch geratenes Jahr und OCR-Zahlendreher. Stichprobe bestätigt: 22.08.2026 und 18.07.2026 sind tatsächlich Samstage.
- **Verworfen:** Nur auf die Ziffern vertrauen.
- **Datum:** 02.08.2026

### Kein automatisiertes Auslesen von Instagram
- **Frage:** Dürfen Instagram-Inhalte automatisiert abgegriffen werden?
- **Wahl:** Nein. Nur **manuelles Teilen** durch die nutzende Person.
- **Grund:** Automatisiertes Abgreifen verstößt gegen die Nutzungsbedingungen. Die Grenze gehört festgeschrieben, sonst verrutscht sie im Lauf der Entwicklung.
- **Verworfen:** Scraping der Instagram-Webansicht.
- **Datum:** 02.08.2026

---

## Datenmodell

### Trennung in drei Schichten
- **Frage:** Wie werden Extraktionsfehler korrigierbar, ohne Daten zu verlieren?
- **Wahl:** **Rohquelle** (nie veränderbar) → **Extraktion** (neu erzeugbar) → **Event** (trägt manuelle Korrekturen).
- **Grund:** Erlaubt Neuverarbeitung mit besserer Extraktion, ohne Korrekturen zu überschreiben. Praxisbeleg: „18 JULI 26" auf dem Hauswald-Plakat ist für sich genommen mehrdeutig (18. Juli 2026 oder 18. & 26. Juli); erst die KREA-Spalte („SA 18.07.") löst es auf. Ohne erhaltene Rohquelle wäre die Korrektur später nicht nachvollziehbar.
- **Verworfen:** Nur das fertige Event speichern.
- **Datum:** 02.08.2026

### Kategorien nicht selbst erfinden
- **Frage:** Woher kommt die Kategorie-Taxonomie?
- **Wahl:** Das im STUZ bereits gedruckte Schema übernehmen: KONZERT, PARTY, LESUNG, KARAOKE, FESTIVAL, JAM, MARKT, COMEDY, BÜHNE, KLASSIK & OPER, KINDER & JUGEND, KUNST & AUSSTELLUNG, BILDUNG & VORTRÄGE, SPORT & GAMING, MESSE & MÄRKTE, KINO & FILM, SONSTIGES.
- **Grund:** Die lokalen Quellen labeln selbst schon so. Übernahme spart Zuordnungsarbeit und passt zu dem, was tatsächlich auf den Seiten steht.
- **Verworfen:** Eigene Taxonomie entwerfen.
- **Datum:** 02.08.2026

---

## Orte

### Veranstalter ist nicht Veranstaltungsort
- **Frage:** Findet jede Veranstaltung auf einer Venue-Seite auch in dieser Venue statt?
- **Wahl:** Nein. Der im Untertitel genannte Raum entscheidet; abweichende Orte werden als **externer Ort** gespeichert und **erben die Koordinaten der Quelle nicht**.
- **Grund:** Echter Fehler, gefunden über ein Foto: „GIANT ROOKS (JAHRHUNDERTHALLE FFM)" stand mit Schlachthof-Koordinaten in der Datenbank, findet aber in Frankfurt statt. Betrifft 8 von 170 Einträgen (Jahrhunderthalle/Festhalle Frankfurt, Kurhaus, Ringkirche, Kreativfabrik, Murnau-Filmtheater).
- **Verworfen:** „Alles auf schlachthof-wiesbaden.de ist im Schlachthof."
- **Datum:** 02.08.2026

### Unbekannter Raum gilt als extern
- **Frage:** Wie wird ein Raumname behandelt, der nicht in der Liste eigener Räume steht?
- **Wahl:** Als **externer Ort** — die Liste eigener Räume ist die Allowlist (KESSELHAUS, HALLE, KULTURPARK, BACKYARD).
- **Grund:** Die Fehlerrichtung ist asymmetrisch. Ein extern eingestufter eigener Raum lässt sich nicht geokodieren → Ort bleibt leer → Event wird trotzdem angezeigt. Ein fälschlich als „eigener Raum" eingestufter fremder Ort bekommt stillschweigend falsche Koordinaten und rutscht durch den Umkreisfilter.
- **Verworfen:** Unbekanntes als eigenen Raum annehmen.
- **Datum:** 02.08.2026

### Raumnamen wortweise vergleichen, nie als Teilstring
- **Frage:** Wie wird geprüft, ob ein Ortsname ein eigener Raum ist?
- **Wahl:** **Wortgenauer** Vergleich.
- **Grund:** „JAHRHUNDERTHALLE FRANKFURT" enthält „HALLE". Ein Teilstring-Vergleich stufte Frankfurter Konzerte als Schlachthof-Halle ein — also exakt der Fehler, der behoben werden sollte. Beim ersten Fix-Versuch tatsächlich passiert und erst durch Nachmessen aufgefallen.
- **Verworfen:** `includes()` auf dem ganzen Ortsnamen.
- **Datum:** 02.08.2026

### Umkreis als Luftlinie, nicht als Fahrzeit
- **Frage:** Wie wird „ca. 30 Minuten mit dem Auto" abgebildet?
- **Wahl:** **Luftlinie**, Radius je Heimatort (Wiesbaden, Mainz, Frankfurt, je 25 km). Ein Event zählt, wenn es im Radius *irgendeines* Heimatorts liegt.
- **Grund:** Ohne Zusatzdienst, sofort rechenbar, für den Rhein-Main-Kern ausreichend. `in_range` wird bei der Aufnahme einmal berechnet, nicht bei jeder Abfrage.
- **Verworfen:** Isochrone (z. B. OpenRouteService) — genauer entlang der Autobahnen, aber zusätzliche Abhängigkeit; nachrüstbar, falls die Kreise real 30 Minuten entfernte Orte abschneiden.
- **Datum:** 02.08.2026

---

## Technik

### Quellen ohne strukturierte Daten
- **Frage:** Wie werden Venue-Seiten ohne JSON-LD/OpenGraph erfasst?
- **Wahl:** **Ein Parser pro Site**, per Hostname registriert (`src/lib/site-scrapers/`), mit generischem JSON-LD-Scraper als Standardfall.
- **Grund:** schlachthof-wiesbaden.de hat *kein* JSON-LD, *kein* OpenGraph und auf jeder Unterseite denselben `<title>`. Der generische Weg fand null Events; der eigene Parser findet 170.
- **Verworfen:** Nur generisch scrapen (findet nichts) oder alles manuell erfassen (zu viel Aufwand für Stammlocations).
- **Risiko:** Bricht **stillschweigend** bei jedem Redesign — Symptom ist `found: 0`, keine Fehlermeldung.
- **Datum:** 02.08.2026

### Eventbrite/Meetup als automatische Quelle
- **Frage:** Können Eventbrite und Meetup regelmäßig nach Events in der Umgebung abgefragt werden?
- **Wahl:** Nein, entfällt.
- **Grund:** Beide haben ihre öffentlichen Umkreissuchen für Dritte geschlossen (Eventbrite `/events/search/` 2020; Meetup hinter Pro-/Organizer-OAuth). Es gibt keine verfügbare API, gegen die sich das bauen ließe.
- **Verworfen:** Cron-Job gegen beide APIs — war ursprünglich geplant.
- **Ersatz:** Einzelne Event-Seiten dieser Portale funktionieren weiterhin über Teilen/Einfügen, da sie meist JSON-LD mitliefern.
- **Datum:** 02.08.2026

### Passwortschutz abschaltbar statt entfernt
- **Frage:** Wie wird der Passwortschutz beim lokalen Testen umgangen?
- **Wahl:** Gate greift **nur wenn `APP_PASSWORD` gesetzt ist**. Ohne Variable ist die App offen.
- **Grund:** Beim Testen stört die Anmeldung, beim Deployment ist sie Pflicht. Eine Variable schaltet um, ohne Code zu löschen und später neu zu schreiben.
- **Verworfen:** Auth-Code entfernen und vor dem Deployment neu bauen.
- **Achtung:** Vor jedem Deployment auf eine öffentliche URL `APP_PASSWORD` setzen.
- **Datum:** 02.08.2026

---

## Offen

- Verhältnis dieser laufenden App zum Dezember-Plan: Wegwerf-Prototyp oder Grundlage für Phase A? (siehe Arbeitsdokument Abschnitt 14)
- Mehrdeutige einwortige Ortsnamen („Ringkirche", „Kreativfabrik") werden ohne Stadtzusatz geokodiert — bisher hat Nominatim sie korrekt aufgelöst, verlässlich ist das nicht.
- Uhrzeiten fehlen bei allen Schlachthof-Einträgen (die Übersichtsseite nennt nur Tagesdaten).
