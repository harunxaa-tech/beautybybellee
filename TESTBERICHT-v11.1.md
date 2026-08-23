# Testbericht v11.1

Statische Prüfung:
- script.js Syntax: BESTANDEN
- data-repository.js Syntax: BESTANDEN
- cloud-auth.js Syntax: BESTANDEN
- cloud-sync.js Syntax: BESTANDEN
- cloud-config.js Syntax: BESTANDEN
- Pflicht-Login-Gate vorhanden: BESTANDEN
- Intro führt zur Anmeldung: BESTANDEN
- Session kann Gate überspringen: implementiert
- Cloud-Sync Adapter: implementiert
- Lokale-ID Dublettenschutz: implementiert
- Lösch-Tombstones: implementiert
- Kunden / Katalog / Angebote / Baustellen / Kalender / Aufgaben / Rechnungen Mapper: vorhanden
- Angebots- und Rechnungspositionen: vorhanden
- lokales Pre-Cloud-Backup: vorhanden

Auf echtem iPhone noch testen:
1. bestehende Session -> App öffnet direkt
2. Mehr -> Konto & Cloud -> Sync-Status
3. bestehende lokale Kunden erscheinen nach erstem Sync weiter
4. neuer Kunde -> kurz warten -> manueller Sync -> Backend enthält ihn
5. App auf zweitem Browser/Gerät -> Login -> Cloud-Daten werden geladen
6. Fotos/Dokumente bleiben bewusst lokal

- First-Sync Race-Condition: korrigiert und Syntax erneut geprüft
