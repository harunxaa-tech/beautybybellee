# KI-Kostenschutz – Freigabeblock
Stand 25.11.2026. KI bleibt deaktiviert. Keine kostenpflichtigen Provideraufrufe in Tests.

Migration voice_api_atomic_request_budget wurde auf Supabase angewendet. Die private Tabelle und die nur für service_role ausführbare RPC reserve_voice_api_request reservieren vor externen KI-Aufrufen gemeinsam: 6 Anfragen/Minute pro Benutzer, 120/UTC-Tag pro Benutzer, 500/UTC-Tag pro Betrieb, 2000/UTC-Tag insgesamt. Dies sind bewusst konservative technische Startgrenzen, keine gekauften Tarifkontingente und kein garantiertes Euro-Kostenlimit. Jede akzeptierte Aktion kann bis zu zwei externe Anfragen auslösen. Alte Zähler werden beim ersten akzeptierten Tagesaufruf bereinigt. Die Provider- und Plattform-Ausgabenlimits sowie Alarme müssen separat gesetzt und geprüft werden.

Die Datei scripts/patch-voice-api.mjs enthält die reproduzierbare Änderung für voice-ai Version 8; sie erfordert exakte Ausgangsanker und bricht bei Abweichungen ab. Nicht blind auf spätere Versionen anwenden. Ergänzt Body-Limit, Eingabe-/Ausgabetoken-Grenze, Provider-Timeout, atomare Request-Reservierung und Ablehnung bereits reservierter Audiovorgänge.

Noch vor Aktivierung: tatsächliche serverseitig ermittelte Audiodauer statt Client-Angabe, stabile Idempotenzschlüssel auch bei freien Diktaten, Wiederversuch und faire Abrechnung nach Providerfehler, Abo-Berechtigung für Übersetzungen, Lösch-/Pfadprüfung von Chat/Voice-Dateien, atomare Firmen-Speicherquoten bei parallelen Uploads, Lasttest und echte Provider-Modellkompatibilität. Rate-Limits sind keine Kostenobergrenze für alle Supabase-Aufrufe.

Quellen: https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/ ; https://supabase.com/docs/guides/functions/examples/rate-limiting ; https://supabase.com/docs/guides/platform/billing-on-supabase .
