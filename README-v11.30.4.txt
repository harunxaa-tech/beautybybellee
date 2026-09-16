AngebotsPilot v11.30.4 – Daten & Betriebssicherheit

Enthalten:
- data-safety.js  → neuer Betriebsexport, sichere Restore-Vorschau, nicht-destruktive Wiederherstellung, Archiv-Center
- service-worker.js → Cache v11.30.4 + lädt data-safety.js in der Web/PWA-Version

Installation im GitHub-Root:
1. ZIP entpacken.
2. data-safety.js neu hochladen.
3. service-worker.js ersetzen.
4. AngebotsPilot/Safari komplett schließen und wieder öffnen. Falls v11.30.4 noch nicht angezeigt wird, einmal neu laden und erneut öffnen, damit der neue Service Worker übernimmt.

Wichtig:
- Keine Geschäftsdaten werden durch dieses Update gelöscht.
- Bestehende Cloud-Daten werden beim Restore nicht still überschrieben oder entfernt.
- Stripe-, Mail-, OAuth-, Push- und Server-Secrets werden NICHT exportiert.
- Dokumentdateien selbst bleiben in privatem Cloud-Storage; ihre Metadaten/Storage-Pfade sind im Betriebsexport enthalten.
