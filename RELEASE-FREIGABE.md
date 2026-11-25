# AngebotsPilot – Freigabeprotokoll

Stand: 25.11.2026. Keine Veröffentlichung ohne belegte Freigabe. Der separate Release-Zweig dient als Prüfumgebung; die Live-App bleibt unverändert.

## Automatische Vorprüfung

`python3 tests/release_static.py` prüft Syntax, JSON, lokale HTML-Ressourcen, Vorschau-Indexierung, das native ZIP und die deaktivierte automatische Store-Einreichung. Das ersetzt keinen iOS-Build, keine Laufzeittests und keine Sicherheitsprüfung. Version und Bundle-ID sind bewusst explizite Prüfvorgaben; bei einem geplanten Versionswechsel aktualisieren.

## Manuelle Freigabekriterien (alle offen bis mit Nachweis bestätigt)

- [ ] Signierter iOS-Build mit von Apple akzeptiertem SDK, korrektes Profil, Bundle-ID und fortlaufende Buildnummer.
- [ ] TestFlight auf einem echten iPhone: Anmeldung, Logout, Wiederherstellung, Offlinebetrieb, Keyboard, sichere Datei-/Kamera-/Mikrofonberechtigungen, Deep Links, Update und Absturz.
- [ ] Zwei isolierte Testbetriebe und drei Rollen: fremde Daten, Storage, RPCs und Rollenwechsel müssen serverseitig korrekt abgesichert sein; keine Tests mit echten Kunden.
- [ ] Abo-Tests in Apple Sandbox: Kauf, Wiederherstellung, Erneuerung, Kündigung, Rückerstattung, ausstehender Kauf, doppelte Events, Kontowechsel; serverseitige Verifikation und Zuordnung zum richtigen Betrieb.
- [ ] Web- und Store-Preise, Kontingente und Kaufkanäle abgleichen; keine vorgetäuschte Kaufbereitschaft.
- [ ] Rechnungstests: Nummern parallel auf zwei Geräten, Rundung, Steuersätze, Kleinunternehmer, Storno, Wiederherstellung nach Abbruch, XRechnung/ZUGFeRD mit geeigneten Validatoren.
- [ ] Backup und Wiederherstellung in isolierter Testumgebung, Fehlerprotokolle ohne vertrauliche Inhalte.
- [ ] Kontolöschung von Antrag bis Abschluss, gesetzlich erforderliche Aufbewahrung und Auskunft/Export.
- [ ] Anbieterangaben, Impressum, Datenschutz, Vertragsbedingungen, AVV und tatsächliche Dienstleister durch Betreiber prüfen und rechtlich/steuerlich qualifiziert prüfen lassen; keine Platzhalter als fertige Rechtstexte.
- [ ] Apple Datenschutzdeklaration, Privacy Manifest und tatsächliche SDKs/Datenflüsse abgleichen; EU-Händlerstatus, Support-URL, Review-Zugang, Altersfreigabe, Screenshots und Store-Metadaten.
- [ ] SEO: finale Domain und kanonische URL festlegen, rechtliche Seiten fertigstellen, dann Vorschau-Sperre kontrolliert entfernen, Sitemap, robots.txt und Search Console prüfen. Keine Ranking-Garantien oder erfundenen Bewertungen.
- [ ] Erneute unabhängige Prüfung der Änderungen; Release-Commit, Testergebnisse, bekannte Risiken und Rollback dokumentieren.
- [ ] Manuelle Entscheidung zur Store-Einreichung durch den Betreiber.

## Nachweisformat

Datum / Commit / Buildnummer / Testumgebung / Testfall / erwartetes Ergebnis / tatsächliches Ergebnis / Status / Verantwortlicher. Keine Passwörter, Schlüssel oder Kundendaten in öffentlichen GitHub-Dateien.
