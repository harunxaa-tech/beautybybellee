# Funktionstest AngebotsPilot v10.6

Automatischer Browser-/Logik-Smoke-Test: **50 von 50 Prüfungen bestanden**.

Geprüft wurden unter anderem:
- App startet ohne JavaScript-Laufzeitfehler.
- Kunde direkt während der Angebotserstellung anlegen und automatisch auswählen.
- Angebot speichern.
- Angebot abschließen und optional Rechnungsentwurf erzeugen.
- Wiederholter Angebotsabschluss erzeugt keine zweite Rechnung.
- Angebotsreferenz bleibt beim weiteren Speichern der Rechnung erhalten.
- Baustelle mit Angebot verknüpfen.
- Baustellenabschluss erkennt eine schon vorhandene Rechnung und erzeugt kein Duplikat.
- Baustelle erzeugt/aktualisiert den verknüpften Kalendereintrag.
- Kundenadresse wird in Baustelle und Termin übernommen.
- Termindauer in Stunden wird korrekt intern in Minuten gespeichert.
- Entwurfsrechnung ist bearbeitbar.
- Rechnung ausstellen/finalisieren und danach gegen Inhaltsänderungen sperren.
- Manipulationsversuch an finalisierter Rechnung wird blockiert.
- Korrekturentwurf erhält neue Rechnungsnummer und bleibt bearbeitbar.
- Stornoentwurf bildet den Gegenbetrag korrekt ab.
- Finalisiertes Storno markiert die Originalrechnung als storniert.
- Alle 9 Branchenkataloge enthalten jeweils Leistungen und Materialien.
- Alle 9 Branchenkataloge zeigen nur Positionen des gewählten Gewerks.
- Elektro enthält keine Gartenpositionen; Standard-Elektromaterial ist vorhanden.
- Aufgaben lassen sich speichern.
- Kundenakte öffnet; Galerie- und Dokument-Upload-Steuerelemente sind vorhanden.
- Keine doppelten HTML-IDs.
- Keine fehlenden Funktionen in Inline-Buttons/Steuerelementen.
- Keine nativen alert/prompt/confirm-Dialoge im JavaScript.
- JavaScript-Syntaxprüfung mit Node bestanden.

## Noch nicht vollständig automatisierbar in diesem Test
- echte iPhone-Fotomediathek/Dateiauswahl und persistenter IndexedDB-Speicher auf einem realen iOS-Gerät
- Home-Screen-PWA-Installation und Service-Worker-Cache auf iOS
- echte Übergabe an Telefon, Mail, Maps, WhatsApp, Apple/Google Kalender
- Druck-/PDF-Dialog des jeweiligen Geräts
- Netzwerkwetter unter realen Datenschutz-/Netzwerkbedingungen

Diese Punkte sollten weiterhin auf dem echten iPhone getestet werden.
