# AngebotsPilot – SaaS / Launch Roadmap

Stand: 12.09.2026 · ab v11.30

Dieses Dokument ist die verbindliche Checkliste für die Punkte, die vor einer bezahlten öffentlichen Veröffentlichung noch umgesetzt oder final geprüft werden müssen. Fertige Funktionen werden nicht doppelt gebaut.

## 1. Bereits vorbereitet / umgesetzt

- Gemeinsame Codebasis für Web/PWA + Capacitor iOS; Android folgt aus demselben Core.
- iOS-Smoke-Build v0.2 erfolgreich mit Capacitor.
- Konto, Rollen und Mandantentrennung mit Supabase/RLS.
- Angebots-/Rechnungsnummern, Kunden, Angebote, Rechnungen, Baustellen, Kalender, Aufgaben, Team, Zeiterfassung, Dateien, Abnahmeprotokoll, Sekretariat, E-Mail, Push-Webbasis, Wetter, Onboarding, DE/AT/CH.
- Native v0.2: Biometrie/App-Lock-Basis, Kamera/Dokumentaufnahme, Kontakt-Picker, Files/Share/Backup.
- v11.30 SaaS-Basis: Tarifstatus je Betrieb, 14-Tage-Trial für neue Betriebe, Kulanz-/Restricted-Logik, serverseitige Schreibsperre ohne Datenverlust, Rechnungsprofil und Abo-Beleg-Archiv, sicherer Beta-Testmodus.

## 2. Preise & Tarifmodell – vor geschlossener Beta final entscheiden

Geplante Struktur: Solo / Team / Pro. Noch keine finalen Preise in den Code hart eintragen, bevor echte Beta-Betriebe Feedback gegeben haben.

Zu entscheiden:
- Monatspreis je Tarif.
- Optional Jahresabo mit Rabatt.
- Welche Teamgröße inklusive ist und ob zusätzliche Mitarbeiter kostenpflichtig sind.
- Welche Funktionen je Tarif enthalten sind. Module nicht still löschen; Tarifwechsel darf vorhandene Daten nie löschen.
- Testphase: aktuell technisch 14 Tage vorbereitet.
- Kündigung zum Periodenende und Reaktivierung.

## 3. Stripe / echtes Billing

Vor Live-Zahlungen:
- Stripe-Konto für AngebotsPilot/Firma erstellen und Geschäftskonto für Auszahlungen verifizieren.
- Stripe Products + Price IDs für Solo/Team/Pro anlegen.
- Checkout nur serverseitig vorbereiten; keine Secret Keys im Frontend.
- Stripe Customer pro AngebotsPilot-Betrieb.
- Zahlungsmethoden: zunächst Karte + SEPA-Lastschrift; weitere Methoden nur wenn für DACH sinnvoll.
- Stripe Customer Portal für Zahlungsmethode, Rechnungsanschrift und Kündigung.
- Webhook-Signatur zwingend prüfen.
- Idempotenz für alle Webhooks.
- Webhook-Ereignisse: Checkout/Subscription erstellt, geändert, gekündigt; Invoice bezahlt, Zahlung fehlgeschlagen, Erstattung/Gutschrift falls nötig.
- Provider-IDs nur serverseitig schreiben.
- Testmodus vollständig durchspielen, danach Live Keys getrennt aktivieren.

## 4. Zahlungsverzug & Sperrlogik

Gewünschter professioneller Ablauf:
1. Zahlung fehlgeschlagen → Status `past_due`, freundlicher Hinweis.
2. Automatische Wiederholungsversuche durch Zahlungsanbieter.
3. Kulanzfrist → `grace_period`, Betrieb bleibt arbeitsfähig.
4. Nach Frist → `restricted`.
5. Restricted bedeutet: vorhandene Daten lesen, herunterladen und exportieren bleibt möglich; neue betriebliche Änderungen werden serverseitig blockiert.
6. Zahlungsdaten ändern/bezahlen bleibt immer möglich.
7. Erfolgreiche Zahlung → sofort wieder `active`.
8. Niemals Kundendaten wegen Zahlungsverzug löschen.

Vor Livegang Dauer der Kulanzfrist final festlegen (technisch aktuell 7 Tage im Test vorbereitet).

## 5. AngebotsPilot-Abo-Rechnungen für Firmenkunden

Jede echte Abo-Zahlung soll automatisch einen Buchhaltungsbeleg erzeugen/übernehmen und im Bereich „Abo & Abrechnung“ dauerhaft auffindbar machen.

Noch umzusetzen/final zu prüfen:
- Fortlaufende Rechnungsnummern des AngebotsPilot-Verkäufers.
- Verkäuferdaten, Rechnungsanschrift des Kunden, Leistungszeitraum, Betrag, Zahlungsstatus.
- Aktuelle steuerliche Behandlung des Verkäufers zum jeweiligen Zeitpunkt (z. B. Kleinunternehmer vs. Regelbesteuerung) nicht statisch im Code festschreiben.
- DE/AT/CH und EU-B2B-USt-/Reverse-Charge-Fälle steuerlich prüfen.
- PDF/Beleg revisionssicher in privatem Storage archivieren, Hash/Snapshot speichern.
- Beleg im Kundenkonto laden und optional per E-Mail senden.
- Storno/Gutschrift/Erstattung sauber abbilden.
- Aufbewahrungs- und Datenschutzkonzept vor Livegang prüfen.

## 6. Apple App Store / Google Play Billing-Entscheidung

Vor Veröffentlichung aktuelle Store-Regeln erneut prüfen – nicht auf alten Annahmen aufbauen.

Aktueller Plan:
- Web-Abo zuerst als SaaS-Billing.
- iOS/Android App primär als Login-/Companion-App für bestehende Geschäftskunden, sofern die dann aktuellen Store-Regeln das erlauben.
- Keine externen Kauf-Links in der iOS-App einbauen, bevor die zu diesem Zeitpunkt gültigen Apple-Regeln geprüft sind.
- Falls In-App Purchase nötig/sinnvoll wird: Apple/Google Entitlements mit derselben `company_subscriptions`-Quelle synchronisieren.

## 7. Daten / Export / Archiv (v11.30 Folgeblock)

- Vollständiger Betriebsexport (Kunden, Angebote, Rechnungen, Baustellen, Aufgaben, Zeiten, Dokumentmetadaten).
- Verständliches ZIP/JSON/CSV-Exportpaket.
- Dokument-/Rechnungsarchiv.
- Backup-/Restore-Konzept mit Versionsprüfung, ohne bestehende Cloud-Daten still zu überschreiben.
- Datenexport muss auch im Restricted-Modus möglich bleiben.
- Löschung/Kündigung getrennt behandeln: Abo-Ende ist niemals automatische Datenlöschung.

## 8. Rechnungs-/Compliance-Finalisierung (v11.31)

- EN16931 prüfen.
- XRechnung final validieren.
- ZUGFeRD/PDF-A final entscheiden und umsetzen, sofern Zielkunden es benötigen.
- DE/AT/CH Pflichtangaben und Steuerfälle erneut mit aktuellen Regeln prüfen.
- Unveränderbarkeit finalisierter Rechnungen/Storno-/Korrekturablauf QA.
- E-Rechnungs-Validatoren in CI/QA integrieren.

## 9. Datenschutz / Recht (v11.32)

- Datenschutzerklärung, Impressum, AGB/Nutzungsbedingungen final durch Fachperson prüfen lassen.
- AVV/DPA für Firmenkunden vorbereiten.
- Unterauftragnehmer/Liste (z. B. Supabase, Stripe, Mailprovider) pflegen.
- Lösch-/Exportanfragen.
- Aufbewahrungsfristen und Löschkonzept.
- Cookie/Tracking nur falls tatsächlich benötigt; keine unnötigen Tracker.
- Security-/Incident-Prozess und Backup-Wiederherstellung dokumentieren.

## 10. Native App – noch offen

Nach Apple Developer Program / TestFlight:
- Echten iPhone-Build signieren und TestFlight installieren.
- Face ID/Touch ID auf echtem Gerät testen.
- Kamera, Dokumentaufnahme, Kontakte und Share Sheet auf echtem Gerät QA.
- Safe Areas, Tastatur, Statusbar, Datei-Downloads/Teilen und OAuth-Redirects testen.
- Native Push: APNs für iOS; FCM/Android später.
- Deep Links/Universal Links für relevante App-Aktionen.
- Store Icons/Screenshots/Privacy Manifest/Store-Datenschutzangaben final.

## 11. Baustellen-Chat – bewusst später zusammen mit Native Push

Nicht vergessen. Erst sinnvoll fertig bauen, wenn Push für iOS/Android steht.

Geplanter Umfang:
- Ein Chat pro Baustelle statt allgemeiner Messenger.
- Zugriff nur Chef/Büro + der Baustelle zugewiesene Mitarbeiter.
- Supabase Realtime mit company_id + job_id und sauberer RLS.
- Text, Fotos und wichtige Baustellenmeldungen.
- Lesestatus/Ungelesen-Zähler.
- Push bei neuen Nachrichten; Deep Link direkt zur Baustelle.
- Systemmeldungen für Zuweisung/Termin/Abnahme optional.
- Dateien/Fotos bleiben an der Baustelle/Kundenakte auffindbar.
- Moderation/Lösch-/Aufbewahrungsregeln für Firmenchat definieren.

## 12. Geschlossene Beta / Launch

Vor öffentlichem Verkauf:
- 5–10 echte kleine Betriebe testen lassen.
- Kritische Abläufe: Anmeldung → Kunde → Angebot → Antwort → Termin → Baustelle → Abnahme → Rechnung → Zahlung.
- Abo-Testfälle: Trial, aktive Zahlung, fehlgeschlagene Zahlung, Kulanz, Restricted, Reaktivierung, Kündigung.
- Security Advisor und RLS nach jeder relevanten Migration prüfen.
- Keine Service-Role-/Stripe-Secrets im Client/GitHub.
- Monitoring/Fehlerberichte ohne unnötige personenbezogene Daten.
- Support-Kanal und Statusseite/Notfallkontakt definieren.
- Finale Preise erst nach Beta-Feedback fixieren.

## Leitprinzip

**Im Hintergrund mächtig. Vorne extrem einfach.**

Ein Betrieb soll morgens öffnen und innerhalb weniger Sekunden wissen, was heute wichtig ist. Neue Profi-Funktionen dürfen die Oberfläche nicht unnötig komplizierter machen.
