# AngebotsPilot v11.2 – Team & Einladungen

## Chef
Mehr → Team:
- Name + E-Mail
- Rolle Mitarbeiter oder Büro
- Einmal-Link erzeugen
- Link über iOS Teilen / WhatsApp / Mail versenden
- Einladung 72 Stunden gültig
- Einladung zurückziehen
- Teammitglied deaktivieren/reaktivieren
- Rolle Mitarbeiter ↔ Büro ändern

## Eingeladene Person
Einladungslink öffnen:
- bestehendes Konto → anmelden
- neues Konto → nur Name, E-Mail, Passwort
- kein eigener Betrieb notwendig
- nach E-Mail-Bestätigung/Login wird die Person automatisch dem eingeladenen Betrieb zugeordnet

## Sicherheit
- Einladungstoken wird serverseitig nur gehasht gespeichert
- an E-Mail gebunden
- einmal verwendbar
- 72 Stunden gültig
- Chef vergibt/kennt kein Mitarbeiter-Passwort
- Mitarbeiter sehen serverseitig keine Preisliste, Angebote oder Rechnungen
- Mitarbeiter-Baustellen werden über Job-Zuweisungen abgesichert (Datenbank ist vorbereitet; Zuweisungs-UI folgt)
- Mitarbeiter können in v11.2 noch keine neuen Baustellen/Aufgaben anlegen und erzeugen beim Abschluss keine Rechnung
- Betriebseinstellungen können nur Chef/Inhaber ändern
- Rollen kommen aus Supabase, lokale Rollen-Vorschau entfernt

## Gerätewechsel/Kontowechsel
Lokale Arbeitsstände werden jetzt pro Cloud-Konto/Betrieb getrennt gesichert, damit z. B. ein Mitarbeiter auf demselben Browser keine lokalen Chef-Daten erbt.

- Teamliste läuft nach dem Security-Cleanup direkt über RLS; kein SECURITY-DEFINER-Verzeichnis-RPC mehr.
