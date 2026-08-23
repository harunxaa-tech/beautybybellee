# AngebotsPilot v10.9 – Datenmodell einfach erklärt

## Firma
Jede Installation bekommt ab jetzt eine feste `companyId`. Später ist das die eindeutige ID des Handwerksbetriebs in der Cloud.

## Benutzer
Zusätzlich gibt es eine `currentUserId` und eine kleine `users`-Liste. Im lokalen Test ist das der Chef. Später kommen Büro und Mitarbeiter als weitere Benutzer dazu.

## Geschäftsdaten
Kunden, Angebote, Kalendertermine, Aufgaben, Baustellen, Rechnungen und Katalogpositionen bekommen automatisch:
- `companyId` – zu welchem Betrieb gehört der Datensatz?
- `createdBy` – welcher Benutzer hat ihn angelegt?
- `createdAt` – wann wurde er angelegt?
- `updatedAt` – wann wurde er geändert?
- `syncState` – derzeit `local`, später z. B. `pending` oder `synced`.

## Beziehungen
Die bisherigen Verknüpfungen bleiben bestehen: Ein Angebot kennt seine `customerId`; eine Baustelle kann `customerId`, `offerId` und `invoiceId` besitzen; ein Kalendereintrag kann zu Angebot oder Baustelle gehören.

## Dateien
Fotos und Dokumente bleiben in der Testversion in IndexedDB. Neue Dateien erhalten aber schon `companyId` und `createdBy`. Später laden wir den Binärinhalt in Cloud-Storage und speichern nur die Metadaten in der Datenbank.
