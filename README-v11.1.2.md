# AngebotsPilot v11.1.2 – Wetter & Standort Fix

Behoben:
- Ein neues Konto hatte zwar eine Firmenadresse, aber keinen separaten Wetter-Ort.
- Open-Meteo Geocoding findet vollständige Straßenadressen nicht zuverlässig.
- AngebotsPilot erkennt nun aus Firmenadressen automatisch PLZ/Ort bzw. den Ortsnamen.
- Wetter startet nicht mehr zu früh vor dem Laden des Cloud-Betriebs.
- Nach Login/Cloud-Pull wird Wetter erneut angestoßen, sobald die Firmenadresse vorhanden ist.
- „Mein Standort“ fragt Wetter- und Standort-Einwilligung sauber ab.
- iPhone-Standortfehler unterscheiden jetzt: verweigert / nicht verfügbar / Timeout.
- Standort-Wetter wird ebenfalls gecacht.

Beispiel:
`Tannenstraße 10a, 85579 Neubiberg` → Wettersuche probiert zuerst `Neubiberg`, dann `85579 Neubiberg`.
