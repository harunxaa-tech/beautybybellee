# AngebotsPilot v11.1.1 – Einfacher Start

## Behoben
- Login war serverseitig erfolgreich, aber abgeschlossene Panels blieben sichtbar.
- Ursache: Es fehlte eine echte globale `.hidden`-Regel.
- Zusätzlich nutzen die Startschritte jetzt das native HTML-Attribut `hidden`.

## Neuer Ablauf
### Bestehendes Konto
Start → Anmelden → E-Mail + Passwort → Betrieb laden → Heute

### Neues Konto
Start → Neues Konto
1. Persönliche Daten
2. Betrieb & Gewerk
3. Firmenadresse & Steuer
→ Konto erstellen → E-Mail bestätigen → automatisch weiter

Es wird immer nur genau ein Schritt angezeigt.

## Bestehender Betrieb
Wenn eine gültige Session und ein aktiver Betrieb vorhanden sind, wird der gesamte Startassistent übersprungen.

## Cloud
Die v11.1 Cloud-Synchronisierung bleibt enthalten.
