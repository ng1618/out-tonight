# Learnings — out-tonight

> Übertragbare Konzepte in Frageform. Erst selbst beantworten, dann aufklappen.
> Gilt projektübergreifend, nicht nur für diese Codebasis.

---

## Datenerfassung aus unstrukturierten Quellen

**Warum ist „ein Bild → ein Datensatz" bei Erfassungsstrecken meist falsch?**

<details><summary>Antwort</summary>

Weil das Bild ein *Ausschnitt der Welt* ist, keine Datenbankzeile. Beim Test mit acht abfotografierten Zeitschriftenseiten enthielt jedes Bild mehrere unabhängige Veranstaltungen plus Fließtext, der gar keine war.

Die Erfassung muss deshalb **Kandidaten liefern und auswählen lassen**, nicht ein Ergebnis raten. Gilt genauso für Belege, Rechnungen, Screenshots — überall, wo der Ausschnitt vom Menschen und nicht vom Format bestimmt wird.
</details>

**Was ist der Unterschied zwischen „Feld fehlt" und „Feld ist unbekannt"?**

<details><summary>Antwort</summary>

„Fehlt" heißt: In der Quelle steht nichts. „Unbekannt" heißt: Das System weiß es nicht.

Nur der erste Fall ist eine Tatsache über die Quelle. Wer beide gleich behandelt, füllt am Ende Standardwerte ein und kann später nicht mehr unterscheiden, ob „2026" auf dem Plakat stand oder vom Parser stammt.

Praxis: Fehlende Jahreszahl ist bei Veranstaltungsplakaten der **Normalfall**. Raten erzeugt Termine, die erst auffallen, wenn der Abend vorbei ist.
</details>

**Welche Prüfung von Daten kostet nichts und fängt die häufigsten Fehler?**

<details><summary>Antwort</summary>

**Redundanz in der Quelle selbst gegeneinander prüfen.**

Steht „SA 04.07." da, sind Wochentag *und* Datum gedruckt. Stimmen sie nicht überein, ist entweder das Jahr falsch geraten oder eine Ziffer falsch gelesen. Kein externer Dienst nötig.

Allgemein: Enthält eine Quelle dieselbe Information doppelt (Prüfziffer, Wochentag, Summe unter einer Spalte), ist das ein geschenkter Validator.
</details>

**Warum muss die Rohquelle unverändert erhalten bleiben, auch wenn die Extraktion funktioniert?**

<details><summary>Antwort</summary>

Weil sich die Mehrdeutigkeit oft erst später auflöst.

Konkret: „18 JULI 26" in drei Kreisen liest sich gleich gut als *18. Juli 2026* wie als *18. und 26. Juli*. Erst eine andere Quelle (Programmspalte: „SA 18.07.") entschied es. Ohne erhaltene Rohquelle wäre die spätere Korrektur weder möglich noch nachvollziehbar.

Deshalb die Trennung: Rohquelle (nie ändern) → Extraktion (neu erzeugbar) → Datensatz (trägt manuelle Korrekturen).
</details>

---

## Scraping und Fremdquellen

**Was ist der Unterschied zwischen der Quelle einer Information und ihrem Gegenstand?**

<details><summary>Antwort</summary>

Eine Veranstalterseite listet auch Veranstaltungen, die **woanders** stattfinden.

Der Fehler in diesem Projekt: Alles auf `schlachthof-wiesbaden.de` bekam Schlachthof-Koordinaten — auch Konzerte in der Jahrhunderthalle Frankfurt. Der Umkreisfilter war damit für diese Einträge stillschweigend falsch.

Merksatz: **Wer etwas veröffentlicht, ist nicht automatisch das, worüber veröffentlicht wird.** Gilt auch für Shops (Händler ≠ Hersteller) und Presseportale (Verteiler ≠ Absender).
</details>

**Wenn eine Klassifizierung unsicher ist — in welche Richtung soll der Fehler gehen?**

<details><summary>Antwort</summary>

In die Richtung, deren Fehler **sichtbar** ist.

Hier: Unbekannter Raumname gilt als *externer Ort*, nicht als eigener. Falsch extern eingestuft → Geokodierung schlägt fehl → Ort bleibt leer → Eintrag wird trotzdem angezeigt, Fehler sichtbar. Falsch als eigener Raum eingestuft → falsche Koordinaten → Eintrag rutscht durch den Umkreisfilter, Fehler unsichtbar.

Beide Fehler sind gleich wahrscheinlich, aber nicht gleich teuer. Die Allowlist gehört immer auf die Seite, die man sicher kennt.
</details>

**Warum ist Teilstring-Vergleich bei Namen gefährlich?**

<details><summary>Antwort</summary>

Weil Namen einander enthalten, ohne verwandt zu sein.

`"JAHRHUNDERTHALLE FRANKFURT".includes("HALLE")` ist `true` — die Prüfung, die Frankfurter Konzerte als Wiesbadener Saal einstufte. Und zwar im *Fix* für genau diesen Fehler, der ohne Nachmessen durchgegangen wäre.

Bei Namen wortweise oder mit Wortgrenzen vergleichen. Klassiker derselben Familie: `"Österreich".includes("reich")`, `"Massachusetts".includes("USA")` (nein, aber `"Belarus".includes("Rus")` ja).
</details>

**Woran erkennt man, dass ein selbstgeschriebener Parser kaputt ist?**

<details><summary>Antwort</summary>

Meistens **gar nicht** — das ist das Problem.

Ein Parser auf HTML-Struktur wirft keine Ausnahme, wenn die Seite umgebaut wird. Er findet einfach nichts mehr: `found: 0`. Ohne Erwartungswert („diese Seite liefert normalerweise ~170 Einträge") sieht das aus wie „nichts Neues".

Konsequenz: Bei selbstgebauten Parsern gehört eine **Plausibilitätsschwelle** dazu, sonst versickert der Ausfall.
</details>

---

## Modelle, OCR und Messen

**Warum ist „das größere Modell nehmen" eine Vermutung und keine Entscheidung?**

<details><summary>Antwort</summary>

Weil Modellgröße auf *Durchschnitt über Benchmarks* optimiert ist, nicht auf deine Daten.

Gemessen an denselben Fotos: das 139-MB-Modell lieferte **weniger als die Hälfte** dessen, was das 6-MB-Standardmodell fand (1257 → 629 Zeichen, 16 → 5 Termine). Die naheliegende Verbesserung war eine Verschlechterung.

Das Tückische: Ohne Kontrollmessung wäre der Rückschritt unsichtbar geblieben — es kommen ja weiterhin *Ergebnisse*, nur weniger. Deshalb bei jedem Modell- oder Bibliothekswechsel **eine Kontrollprobe mitlaufen lassen, die vorher funktioniert hat.**
</details>

**Wann ist Durchprobieren besser als Erkennen?**

<details><summary>Antwort</summary>

Wenn der Suchraum klein und die Bewertung billig ist.

Die Orientierung eines Fotos zu *erkennen* braucht Kantenerkennung und eine Hough-Transformation. Alle vier Drehungen durchzuprobieren und die OCR-Konfidenz entscheiden zu lassen kostet vier Inferenzen (~5 s) und war in jedem Testfall korrekt.

Faustregel: Bei ≤ ~10 Möglichkeiten mit einer messbaren Gütefunktion ist Brute Force fast immer die bessere Wahl — weniger Code, weniger Annahmen, leichter zu begründen.
</details>

**Was ist der Unterschied zwischen Zeichen erkennen und Inhalt verstehen?**

<details><summary>Antwort</summary>

OCR liefert *Zeichen mit Koordinaten*. Sie entscheidet nicht, welche Zeile ein Titel und welche ein Ort ist, und zu welchem von fünfzehn Ereignissen einer Seite eine Zeile gehört.

Das war die eigentliche Erkenntnis am Testmaterial: Das schwierige Problem war nie das Lesen, sondern das **Segmentieren**. Der Fließtext einer dreispaltigen Zeitschriftenseite verschränkt die Spalten zu Brei — aber jede Zeile trägt eine Bounding-Box, und die x-Position trennt die Spalten rein rechnerisch.

Merksatz: Bevor man ein Modell für Verständnis einsetzt, prüfen, ob die Geometrie die Frage schon beantwortet.
</details>

**Woran erkennt man eine gute Fehlermeldung eines unzuverlässigen Verfahrens?**

<details><summary>Antwort</summary>

Daran, dass sie **laut** ist.

Die lokale OCR scheitert an gestalteten Plakaten mit „0 Zeilen, Konfidenz 0,00" — unübersehbar, und das richtige Signal für „hier bitte selbst tippen". Ein Sprachmodell hätte stattdessen ein plausibles, falsches Datum geliefert.

Für ein Verfahren, das systematisch an einem Teil der Eingaben scheitert, ist ein klar erkennbarer Fehlschlag **wertvoller als eine höhere Trefferquote mit stillen Fehlern.**
</details>

**Wenn eine Quelle dieselbe Angabe doppelt enthält — was fängt man damit an?**

<details><summary>Antwort</summary>

Man nutzt sie zum *Auflösen*, nicht nur zum Prüfen.

Deutsche Programmzeilen drucken „SA 04.07." — Wochentag **und** Datum. Ohne Jahr würde ein im August fotografiertes Juli-Datum auf 2027 gesetzt. Aber nur 2026 ist ein Samstag, also ist es 2026. Aus einem Prüfwert wird ein Bestimmungswert; auf einer Seite hat das acht Termine korrekt datiert.

Allgemein: Redundanz in den Daten (Prüfziffer, Wochentag, Zwischensumme) prüft nicht nur — sie kann fehlende Angaben rekonstruieren.
</details>

## Werkzeuge und Betrieb

**Warum kann ein `npm install` von gestern heute brechen, ohne dass sich Code geändert hat?**

<details><summary>Antwort</summary>

Native Module (hier `better-sqlite3`) werden gegen eine bestimmte **Node-ABI-Version** kompiliert (`NODE_MODULE_VERSION`). Ein Node-Upgrade von 20 auf 24 macht die kompilierte `.node`-Datei unbrauchbar — Fehler erst zur Laufzeit, nicht bei `npm install`.

Behebung: `npm rebuild <paket>`. Vorbeugung: Node-Version im Projekt festnageln (`.nvmrc`, `engines`), sonst tritt das bei jedem Rechnerwechsel auf.
</details>

**Was kann SQLite bei `ALTER TABLE` nicht — und was folgt daraus?**

<details><summary>Antwort</summary>

Spalten **hinzufügen** geht. Eine `NOT NULL`-Bedingung **entfernen**, eine Spalte umbenennen oder Typen ändern geht nicht.

Dafür ist der dokumentierte Umbau nötig: neue Tabelle anlegen → Daten kopieren → alte löschen → umbenennen. Wichtig dabei: `PRAGMA foreign_keys = OFF` **außerhalb** der Transaktion, sonst greift beim `DROP` das `ON DELETE`-Verhalten der referenzierenden Tabellen.

Merksatz: Migrationen kosten in SQLite mehr Sorgfalt als in Postgres — Schema früh richtig schneiden.
</details>

**Warum ist „Feature per Umgebungsvariable abschaltbar" besser als „Feature rauslöschen"?**

<details><summary>Antwort</summary>

Weil Rauslöschen bedeutet, es später neu zu schreiben — und beim Neuschreiben vergisst man Details (hier: Cookie-Signatur, ausgenommene Pfade, 401 für API vs. Redirect für Seiten).

Der Passwortschutz greift jetzt nur, wenn `APP_PASSWORD` gesetzt ist. Lokal leer = offen, Deployment gesetzt = geschützt. Der Code bleibt getestet und vorhanden.

Gegenprobe: Ein Schalter, der versehentlich in der falschen Stellung deployt wird, ist gefährlicher als gelöschter Code. Deshalb ist die **unsichere Stellung an den lokalen Standard gekoppelt** und muss für die Produktion aktiv gesetzt werden — nicht umgekehrt.
</details>
