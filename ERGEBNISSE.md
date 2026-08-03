# Ergebnisse — Extraktion aus Fotos

> Gemessen, nicht geschätzt. Jede Zahl hier stammt aus einem Lauf gegen die zehn
> echten Fotos in `NOTIZEN.md`, nicht aus einer Einschätzung.
> **Stand: 03.08.2026**

---

## 0. Kurzfassung (Stand 03.08.2026)

Seit der ersten Messung ist die OCR vom Node-Prozess in den Browser gewandert und
das Zuschneiden dazugekommen. Die beiden wichtigsten Zahlen:

| | Ohne Zuschnitt | Mit Zuschnitt auf die Spalte |
|---|---|---|
| Korrekte Titel (KREA-Seite) | 4/10 | **9/10** |
| Laufzeit | 12,0 s | **5,2 s** |

Alle Fehler ohne Zuschnitt stammten aus der Nachbarspalte („Momo l ab 5 Ja",
„Sonne, Sehnsuc", „Da Capo - Leipz"). Mit Zuschnitt wurden zusätzlich zwei
Termine gefunden, die vorher ganz fehlten.

**Im Browser statt in Node:** WebGPU ist verfügbar, die KREA-Seite braucht
11,1 s für acht Varianten und liefert 10 Kandidaten, 8 davon
wochentagsgeprüft. Das Modell (~6 MB) wird einmal geladen und gecacht.

**Layouts:** Programmseiten mit Zeilenlayout (KREA) und Rasterlayout (KUZ)
funktionieren beide, nachdem drei Fehler behoben waren — Spaltenzwischenraum,
mehrzeilige Titel, Kategorielabels als Titel. Gestaltete Einzelplakate bleiben
das Problem.

---

## 1. Aufbau

| | |
|---|---|
| Testmenge | 10 Fotos (STUZ-Sommerheft, Wiesbaden/Mainz), 1200×1600 bzw. 921×2048 |
| OCR | `ppu-paddle-ocr` (PP-OCRv6), lokal, ohne API-Schlüssel |
| Vorverarbeitung | 4 Rotationen × (roh / grau+normalisiert+geschärft) = 8 Varianten |
| Auswahl | beste Variante nach `Zeichenzahl × Konfidenz` |
| Datumsparser | eigene Regeln, deutsche Formate (siehe `src/lib/parseGerman.ts`) |
| Kontextdatum | 02.08.2026 |

---

## 2. Ergebnis je Foto

| Foto (Inhalt) | Gewählte Variante | Konfidenz | Zeilen | Daten | Wochentag geprüft |
|---|---|---|---|---|---|
| KREA-Programm | 0° | **0,93** | 89 | **13** | **8 ✓** |
| Schlachthof-Spalte | 0° | 0,91 | 71 | **14** | 1 ⚠ Abweichung |
| KUZ-Programm | 0° verstärkt | 0,86 | 40 | **6** (alle korrekt) | — |
| Staatstheater (gedreht) | **90° verstärkt** | **0,99** | 8 | 1 | **1 ✓** |
| Flörsheimer Open Air | 0° | 0,88 | 104 | 3 (davon 1 Müll) | — |
| Theaterfest | 0° | 0,89 | 54 | 1 | — |
| Volk im Schloss | 270° | 0,97 | 2 | 0 | — |
| Hauswald Open Air | 0° verstärkt | 0,66 | 10 | 0 | — |
| Riverside Stomp | 0° verstärkt | 0,71 | 50 | 0 | — |
| weiteres Plakat | 0° verstärkt | 0,60 | 27 | 0 | — |

**Zusammenfassung:** 6 von 10 Fotos liefern verwertbare Daten. Die drei
Programmseiten (KREA, Schlachthof, KUZ) liefern zusammen **33 Termine** bei
Konfidenz 0,86–0,93. Die vier Fehlschläge sind durchweg gestaltete Einzelplakate.

---

## 3. Was die Vorverarbeitung bringt

Bei **5 von 10** Fotos gewann *nicht* die unveränderte Variante.

| Foto | ohne Vorverarbeitung | mit Variantenauswahl |
|---|---|---|
| Staatstheater | **0 Zeilen, Konfidenz 0,00** | 8 Zeilen, **0,99**, Datum wochentagsgeprüft |
| Volk im Schloss | 0 Zeilen, 0,00 | 2 Zeilen, 0,97 (270°) |
| Plakat #10 | 18 Zeilen, 144 Zeichen | 27 Zeilen, **273 Zeichen** (+90 %) |

**Erkenntnis:** Rotation *raten statt erkennen* funktioniert. Alle vier Drehungen
durchzuprobieren und die Konfidenz entscheiden zu lassen kostet ~5 s pro Foto und
ersetzt eine Orientierungserkennung (Hough-Transformation o. ä.) vollständig.

Kontrastverstärkung wirkt **uneinheitlich**: bei einem Foto +90 % Text, bei einem
anderen zerstörte sie ein sonst brauchbares Ergebnis. Deshalb als Variante
mitlaufen lassen, nicht pauschal anwenden.

---

## 4. Widerlegte Annahmen

Drei naheliegende Verbesserungen wurden getestet — **zwei verschlechterten das Ergebnis.**

| Annahme | Ergebnis |
|---|---|
| Größeres Modell ist besser | **Falsch.** `V6_MEDIUM` (139 MB) gegen `V6_TINY` (6 MB): KREA fiel von **1257 Zeichen / 16 Terminen auf 629 Zeichen / 5 Termine** — weniger als die Hälfte |
| Hochskalieren hilft kleinem Text | **Falsch.** 2× (Lanczos) verschlechterte KREA auf 562 Zeichen. Fachliteratur: Super-Resolution lohnt unter 200 dpi; Handyfotos liegen darüber, das Skalieren verstärkt nur JPEG-Artefakte |
| Feineinstellungen (`minimumConfidence`, `per-box`, `maxSideLength`) | **Unklar.** Fünf Konfigurationen lieferten byteidentische Ergebnisse → die Optionen wurden nicht angewendet (Fehler in der Aufrufform, nicht Beleg gegen die Idee). Offen |

Ohne Messung wäre das große Modell eingebaut worden — eine Verschlechterung um
mehr als die Hälfte, die niemandem aufgefallen wäre.

---

## 5. Datumsparser

Alle zwölf Testfälle korrekt (`src/lib/parseGerman.ts`):

| Eingabe | Ergebnis |
|---|---|
| `SA 04.07.` | 2026-07-04, Wochentag ✓ |
| `MI 29.07.` | 2026-07-29, Wochentag ✓ |
| `02.10.` (ohne Wochentag) | 2026-10-02, Jahr abgeleitet |
| `Sa, 22.8.2026 einlass:15.00, ak:20€` | 2026-08-22 ✓, **15:00 [Einlass]**, **AK 20 €** |
| `17 bis 19. Juli 2026` | 2026-07-17 → 2026-07-19 |
| `21.-23. AUGUST 2026` | 2026-08-21 → 2026-08-23 |
| `Sa 22 08 2026` (OCR verliert Punkte) | 2026-08-22 ✓ |
| `22.08. 11-17 UHR` | 2026-08-22, 11:00 [11:00–17:00] |
| `18 JULI 26` | 2026-07-18, Jahr **gedruckt** |
| `Ab 14.00 Uhr` | 14:00 [ab] |
| `MO 04.07.2026` (falscher Wochentag) | ⚠ Abweichung erkannt |

### Der wichtigste Einzelfund: Wochentag bestimmt das Jahr

`SA 04.07.` ohne Jahresangabe, fotografiert im August: die Ableitung „nächstes
Vorkommen" ergibt **2027** — falsch, das Heft ist von Juli 2026. Der gedruckte
Wochentag löst es eindeutig auf: 04.07.2026 ist ein Samstag, 04.07.2027 ein
Sonntag. Also 2026.

Auf der KREA-Seite hat das **8 Termine** korrekt datiert, die sonst ein Jahr
zu spät gestanden hätten. Zwei weitere Termine blieben falsch (2027), weil die
OCR sie von ihrem Wochentag getrennt hat — dort fehlt der Prüfwert.

---

## 6. Offene Schwächen

- **Vier von zehn Fotos liefern keine Termine.** Durchweg gestaltete
  Einzelplakate. Das ist ein offenes Forschungsproblem (Stichwort
  „WordArt-oriented scene text recognition"), kein Bibliotheksproblem — keine
  npm-Bibliothek löst das derzeit.
- **Kein einziger Preis wurde aus einem echten Foto gelesen**, obwohl der Parser
  `ak:20€` auf sauberem Text korrekt erkennt. Die OCR löst dieses Kleingedruckte
  nicht auf.
- **Titel sind grob:** `AWAITINGDAWI+SPORT` statt „Awaiting Dawn + Support",
  `LFTOFFXFREQUENZ` statt „Lift Off X Frequenz". Titel bleiben Handarbeit.
- **Ein Müll-Datum** (`2011-07-12`) aus OCR-Rauschen.
- Die Spalten einer Zeitschriftenseite laufen im Fließtext ineinander
  (`SMD407 SOMMERFE FLINTA*OPEN STAGE`). Lösbar über die Bounding-Boxen
  (x-Position trennt Spalten) — **noch nicht umgesetzt**.

**Die Fehlschläge sind laut, nicht leise:** 0 Zeilen / Konfidenz 0,00 ist ein
eindeutiges „hier bitte selbst tippen". Das ist besser als ein Modell, das
selbstbewusst ein falsches Datum erfindet.

---

## 7. Kosten

| Weg | Kosten je Foto | Bemerkung |
|---|---|---|
| **Lokale OCR (eingesetzt)** | **0 €** | Offline, kein Schlüssel, ~5 s je Foto |
| Azure AI Document Intelligence – Read | ~0,0015 $ | 1,50 $ / 1000 Seiten; Gratisstufe 500 Seiten/Monat |
| Azure – Layout | ~0,01 $ | 10 $ / 1000 Seiten, mit Struktur-/Tabellenerkennung |
| Claude Opus 5 (Bildverstehen) | ~0,05–0,10 $ | ~30–60× teurer als Azure Read |

---

## 7b. Layout-Fehler, gefunden durch Draufschauen (03.08.2026)

Erst der Blick auf mehrere Fotos nebeneinander zeigte, dass „die Titel sind
kaputt" in Wahrheit „Rasterlayouts sind kaputt" hieß. Die KREA-Seite lieferte
längst 14 von 14 korrekten Titeln.

| Symptom (KUZ-Seite) | Ursache | Behebung |
|---|---|---|
| `"14.08."` als Titel | Zeilennachbarn wurden unabhängig von der Entfernung genommen; im Raster steht dort die *andere Spalte* | Abstand > 3 Zeilenhöhen zählt nicht mehr als dieselbe Zeile |
| `"DIES & DAS-"` abgeschnitten | Nur eine Zeile wurde Titel; Rastertitel laufen über drei | Titel absorbiert direkt darunterliegende Zeilen **gleicher Schriftgröße** |
| `"KONZERT: POP"` als Titel | Ein Kategorielabel war als Name zugelassen | Reine Kategorielabels sind keine Titel mehr |
| Zweizeilige Titel im Zeilenlayout | Ein Titel, der neben dem Datum beginnt und darunter weiterläuft, lag außerhalb der Zeile — dem einzigen Ort, an dem gesucht wurde | Zeile **und** darunter sind zulässig |

Beim Plakat kam derselbe Denkfehler in anderer Form vor: der Titel steht
**über** dem Datum, gesucht wurde nur rechts und darunter. Ergebnis war
`"Binfritt Frei"` — die verlesene Preiszeile. Seitdem unterscheidet der Code
Plakat (ein bis zwei Daten, Titel ist der größte Text irgendwo) von
Programmseite (viele Daten, Titel bleibt in seiner Zeile).

**Offene Schwäche dieser Unterscheidung:** Sie zählt schlicht Datumszeilen
(≤ 2 = Plakat). Ein Plakat mit drei Terminen oder ein Zuschnitt, der zwei
Zeilen erwischt, wählt den falschen Modus. Auf allen zehn Testfotos hielt die
Regel; sie ist trotzdem der wahrscheinlichste Kandidat für einen Fehlgriff im
Feld.

## 7c. Was die Konfidenz *nicht* leistet

Die Vorschlagsliste sollte um OCR-Müll bereinigt werden. Gemessen auf einer
unzugeschnittenen Seite filtert die Konfidenzschwelle **4 von 48 Zeilen**.

Der Rest ist kein Rauschen, sondern am Bildrand abgeschnittene Fragmente
echten Textes — `rt.Ist`, `EC X`, `oufd`, `hle` — und die bewertet die OCR
genauso hoch wie einen echten kurzen Titel („LOTTE"). Konfidenz sortiert
deshalb die Liste, statt sie zu filtern.

Ein Wörterbuchabgleich wäre hier das falsche Werkzeug: er verwirft KREAOKE,
CH'AHOM, Vulvodynia und FLINTA*. Der wirksame Hebel bleibt der Zuschnitt — die
48 Zeilen enthielten eine Tastatur und zwei Nachbarartikel.

## 8. Nächste Schritte

1. ~~Zeilen über Bounding-Boxen gruppieren~~ — erledigt, siehe 7b
2. ~~Titel aus der Box-Höhe schätzen~~ — erledigt, jetzt seitenweit statt je Zeile
3. **Geschwindigkeit auf dem S24 FE messen** (`adb reverse`, Telefon per USB am
   Dev-Server). Die Desktop-Zahl von 11,1 s sagt darüber nichts.
4. Feldtest mit JSON-Export; die Korrekturen sind der Eval-Satz
5. Feineinstellungen der OCR erneut testen — diesmal über den Konstruktor, der
   frühere Versuch über die Aufrufoptionen wurde nicht angewendet
6. Ab Block 2: Azure Read als zweiter Durchgang für Fotos, an denen die lokale
   OCR scheitert. Das gespeicherte Original erlaubt das ohne erneutes
   Fotografieren. **F0-Freikontingent: 500 Seiten/Monat**, ein Foto = eine
   Seite; Grenzen sind 4 MB je Anfrage und ein Abkühlfenster bei Stoßlast.
