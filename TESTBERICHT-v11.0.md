# Testbericht v11.0

Statische Prüfung:
- script.js Syntax: BESTANDEN
- data-repository.js Syntax: BESTANDEN
- cloud-config.js Syntax: BESTANDEN
- cloud-auth.js Syntax: BESTANDEN
- Supabase URL eingebunden: BESTANDEN
- nur Publishable Key im Browser: BESTANDEN
- Registrierung vorhanden: BESTANDEN
- Login vorhanden: BESTANDEN
- Firmenanlage per create_company RPC vorhanden: BESTANDEN
- lokale App/Cloud-Firma Verknüpfung vorhanden: BESTANDEN

Serverseitig bereits geprüft:
- Supabase Projektstatus: ACTIVE_HEALTHY
- initiales Datenbankschema: erfolgreich angelegt
- Sicherheitsprüfung nach Härtung: 0 Sicherheitswarnungen

Auf dem iPhone testen:
1. Mehr -> Konto & Cloud
2. Konto erstellen
3. ggf. E-Mail bestätigen
4. anmelden
5. Firmenname + Rolle werden angezeigt
6. „Lokale App verknüpfen“
7. App neu öffnen -> Anmeldung sollte bestehen bleiben
