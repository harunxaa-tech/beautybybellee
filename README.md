# AngebotsPilot v11.0 – Konto & Cloud

## Was jetzt echt ist
- Supabase-Projekt „AngebotsPilot“ in Frankfurt (eu-central-1)
- Registrierung per E-Mail + Passwort
- Anmeldung mit dauerhaft gespeicherter Session
- Firmenkonto wird serverseitig erstellt
- erste echte Rolle: owner / Chef
- Row Level Security (RLS) ist in der Datenbank aktiv
- lokale App kann mit der Cloud-Firma verknüpft werden
- Firmenprofil kann aus den lokalen Betriebseinstellungen in die Cloud übernommen werden

## Was bewusst NOCH lokal bleibt
- Kunden
- Angebote
- Baustellen
- Termine
- Aufgaben
- Rechnungen
- Fotos und Dokumente

Das ist Absicht: v11.0 trennt Konto/Firma sauber von der Geschäftsdaten-Migration. In v11.1 übertragen wir die bestehenden lokalen Daten kontrolliert und mit ID-Zuordnung.

## Sicherheit
Im Browser liegt ausschließlich der öffentliche Supabase Publishable Key. Der geheime Service-Role-Key ist NICHT in der App.
Die Datenbank verwendet RLS, damit jeder angemeldete Benutzer nur Daten seiner Firma lesen darf.
