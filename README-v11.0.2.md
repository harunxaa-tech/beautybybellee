# AngebotsPilot v11.0.2 – Cloud State Fix

Behoben:
- zentrale `.hidden`-Klasse fehlte; dadurch wurden eigentlich versteckte Cloud-Elemente fälschlich angezeigt.
- „Betrieb ✓“ wird nur noch angezeigt, wenn im Backend wirklich ein Betrieb + aktive Mitgliedschaft existieren.
- „Verknüpft“ wird nur noch angezeigt, wenn lokale companyId und authUserId wirklich zur geladenen Cloud-Firma passen.
- Der Verknüpfen-Button zeigt drei eindeutige Zustände:
  1. Erst Betrieb einrichten
  2. Lokale App verknüpfen
  3. ✓ Lokale App ist verknüpft
- Betriebseinrichtung lädt Firma und Chefrolle nach dem Erstellen erneut vom Server.
- Cloud-Checklist ist jetzt dynamisch statt statisch grün.

Aktueller Backend-Stand vor diesem Fix:
- 1 bestätigter Benutzer
- 0 Betriebe
- 0 aktive Firmenmitgliedschaften

Daher muss nach dem Upload zuerst „Betrieb fertig einrichten“ ausgeführt werden.
