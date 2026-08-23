# Testbericht v11.2.1

Statisch geprüft:
- script.js Syntax: BESTANDEN
- cloud-auth.js Syntax: BESTANDEN
- cloud-sync.js Syntax: BESTANDEN
- team.js Syntax: BESTANDEN
- neue Registrierung nutzt keine alten Firmeneinstellungen: BESTANDEN
- forceFresh Workspace beim neuen Betrieb: BESTANDEN
- CloudSync userId/companyId Sicherheitsstopp: BESTANDEN
- Rechnung teilen nur nach Ausstellen: BESTANDEN
- native PDF Blob Erzeugung vorhanden: BESTANDEN
- Web Share API mit PDF-Datei vorhanden: BESTANDEN
- Browser-Fallback vorhanden: BESTANDEN

Praxis-Test iPhone:
1. Facility&Care abmelden.
2. Neues Testkonto erstellen.
3. Prüfen: keine Facility&Care-Daten / keine alte Rechnung.
4. Testrechnung erstellen und ausstellen.
5. „📤 Teilen“ drücken.
6. WhatsApp bzw. Mail wählen und prüfen, dass eine PDF angehängt ist.
