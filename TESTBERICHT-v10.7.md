# AngebotsPilot v10.7 – Implementierungsprüfung

Ergebnis der statischen Prüfung:
- JavaScript Syntax: BESTANDEN
- Angebot -> Kalender-Verknüpfung vorhanden
- Angebots-Kalendereintrag wird über offerId dedupliziert
- Manuell verschobenes Kalenderdatum bleibt erhalten
- Mitarbeiter × Stunden -> Gesamtstunden vorhanden
- Auto-Speichern Angebot beim Schließen vorhanden
- Auto-Speichern Rechnungsentwurf beim Schließen vorhanden
- Gesperrte Rechnung wird durch Auto-Save nicht überschrieben
- Professioneller Kundenpicker in Rechnung vorhanden
- Professionelles Rechnungs-Template vorhanden

Geräteabhängig weiter auf iPhone testen:
- iOS Tastatur/Focus
- visuelles Verhalten des Kunden-Pickers
- Druck/PDF-Seitenumbruch bei sehr langen Rechnungen
- Kalenderdarstellung bei vielen Terminen am selben Tag
