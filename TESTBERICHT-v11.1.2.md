# Testbericht v11.1.2

Statische Tests:
- script.js Syntax: BESTANDEN
- cloud-auth.js Syntax: BESTANDEN
- cloud-sync.js Syntax: BESTANDEN
- Firmenadress-Parser vorhanden: BESTANDEN
- PLZ+Ort Fallback vorhanden: BESTANDEN
- Wetter wartet auf vorhandene Firmenadresse: BESTANDEN
- Cloud-Login triggert Wetter nach Identitätsübernahme: BESTANDEN
- Cloud-Pull triggert Wetter nach Firmenadress-Übernahme: BESTANDEN
- Gerätestandort mit getrennten iOS-Fehlermeldungen: BESTANDEN
- Wetter-Consent auch bei Standortabfrage: BESTANDEN

Auf iPhone testen:
1. Neues Konto mit vollständiger Firmenadresse → Heute → Wetter.
2. Wetter-Seite → nur Ortsname eingeben.
3. Wetter-Seite → PLZ + Ort eingeben.
4. „Mein Standort“ → Safari/iOS-Berechtigung erlauben.
