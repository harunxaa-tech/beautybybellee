# Was nach v10.9 passiert

1. Cloud-Datenbank auswählen und Projekt anlegen.
2. Tabellen aus `backend-schema.json` anlegen.
3. Registrierung und Login anschließen.
4. `AppRepository.setCloudAdapter(...)` mit dem echten Backend verbinden.
5. Chef/Büro/Mitarbeiter serverseitig absichern.
6. Fotos und Dokumente in Object Storage verschieben.
7. Mehrgeräte-Synchronisierung und Konfliktregeln testen.
8. Erst danach finaler Design-Polish und geschlossene Beta.

Wichtig: v10.9 benutzt weiterhin ausschließlich den lokalen Speicher. Es entstehen noch keine Cloud-/API-Kosten.
