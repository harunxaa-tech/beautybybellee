# AngebotsPilot v10.5 – Doppelrechnungsschutz

Neu:
- Vor dem Erstellen einer Rechnung wird immer geprüft, ob bereits eine Rechnung zum Angebot existiert.
- Prüfung erfolgt über:
  1. Angebots-ID
  2. Angebotsnummer
  3. Verknüpfte Baustelle
- Rechnungsnummern werden zusätzlich auf Dubletten geprüft.
- Automatisch erzeugte Rechnungsnummern werden so lange weitergezählt, bis eine freie Nummer gefunden ist.
- Eine Rechnung speichert zusätzlich die ursprüngliche Angebotsnummer als Referenz.
- Wird eine vorhandene Rechnung erkannt, wird keine zweite erstellt; die bestehende kann stattdessen geöffnet werden.

Version: 10.5
