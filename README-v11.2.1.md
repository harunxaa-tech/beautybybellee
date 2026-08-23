# AngebotsPilot v11.2.1 – Kontotrennung & Rechnung teilen

## Kritischer Fix: neue Konten starten leer
Behoben wurde ein Mandantentrennungsfehler beim Anlegen eines zweiten Betriebs auf demselben Gerät.

Vorher:
- alter lokaler Arbeitsstand konnte beim neuen Firmenkonto noch aktiv sein
- dadurch konnten alte Kunden/Angebote/Rechnungen in den neuen Cloud-Betrieb synchronisiert werden
- Registrierungsfelder konnten alte Firmendaten vorbefüllen

Jetzt:
- „Neues Konto erstellen“ startet ohne Firmendaten des vorherigen Kontos
- Recovery verwendet lokale Firmendaten nur, wenn authUserId exakt passt
- nach dem Erstellen einer neuen companyId wird vor dem ersten Sync zwingend ein frischer Workspace erstellt
- alte Daten werden unter ihrem eigenen userId/companyId Workspace gesichert
- CloudSync blockiert jeden Upload, wenn lokale userId/companyId nicht exakt zur aktiven Session passen

Wichtig:
Bereits zuvor in einem Testbetrieb gespeicherte Daten werden aus Sicherheitsgründen nicht automatisch gelöscht.

## Rechnung teilen
Ausgestellte Rechnungen haben jetzt:
- „📤 Teilen“ direkt in der Rechnungsliste
- „📤 WhatsApp / Mail“ in der Rechnungsvorschau

Auf iPhone/Safari:
- AngebotsPilot erzeugt lokal eine echte PDF-Datei
- öffnet den nativen iOS Share Sheet
- PDF kann direkt an WhatsApp, Mail, AirDrop usw. übergeben werden

Entwürfe können absichtlich nicht geteilt werden. Sie müssen zuerst ausgestellt werden.

Die PDF-Erzeugung benötigt keine externe Bibliothek und keine API.
