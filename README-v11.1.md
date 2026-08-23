# AngebotsPilot v11.1 – Login & Cloud Sync

## Neuer Startablauf
1. Beim allerersten Start: kurze Produkterklärung.
2. Danach ist Anmeldung/Konto verpflichtend.
3. Konto erstellen oder vorhandenes Konto anmelden.
4. Betrieb wird angelegt bzw. geladen.
5. Danach direkt in die App.
6. Bei späteren Starts mit gültiger Session kein erneutes Onboarding/Login.

## Echte Cloud-Synchronisierung
Synchronisiert werden:
- Betriebseinstellungen
- Kunden
- Material & Leistungen / Preisliste
- Angebote + Positionen
- Baustellen
- Kalendertermine
- Aufgaben
- Rechnungen + Positionen, Korrektur-/Storno-Beziehungen

Noch lokal:
- Baustellenfotos
- hochgeladene Kunden-Dokumente

## Sicherheit beim ersten Umzug
Vor der ersten Cloud-Migration wird automatisch eine lokale Sicherheitskopie unter
`angebotspilot_precloud_backup_v11_1`
im Browser gespeichert.

## Dublettenschutz
Jeder Datensatz besitzt in Supabase eine `local_id`.
Pro Betrieb ist diese ID eindeutig. Wiederholtes Synchronisieren aktualisiert denselben Datensatz statt eine Kopie anzulegen.

## Löschungen
Gelöschte Kerndatensätze werden über Tombstones (`deleted_at`) weitergegeben, statt sofort physisch aus der Cloud entfernt zu werden.
