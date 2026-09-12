# AngebotsPilot – Stripe Setup (Testmodus)

Stand: v11.30.1 · 12.09.2026

Die technische Integration ist bereits deployed. In GitHub oder im Frontend dürfen **keine Stripe Secret Keys** gespeichert werden.

## Bereits deployed

- Supabase Edge Function `stripe-billing` (JWT erforderlich, nur Inhaber):
  - Status / Konfigurationsprüfung
  - Stripe Customer anlegen
  - Stripe Checkout Session für Solo / Team / Pro
  - Stripe Customer Portal öffnen
- Supabase Edge Function `stripe-webhook` (öffentlich erreichbar, aber Stripe-Signatur zwingend):
  - Webhook-Signaturprüfung
  - Idempotenz / Event-Protokoll
  - Abo-Status synchronisieren
  - Zahlungsfehler → Kulanz / Restricted
  - Zahlung erfolgreich → automatische Reaktivierung
  - Stripe-Rechnungen in `subscription_invoices` spiegeln

## Webhook-URL

`https://haqztfpixbjqfiollazv.supabase.co/functions/v1/stripe-webhook`

## Benötigte Stripe Test-Events

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.finalized`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.voided`
- `invoice.marked_uncollectible`

## Benötigte serverseitige Umgebungsvariablen

- `STRIPE_SECRET_KEY` – Test Secret Key (`sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` – Signing Secret des Test-Webhooks (`whsec_...`)
- `STRIPE_PRICE_SOLO` – Price ID für Solo
- `STRIPE_PRICE_TEAM` – Price ID für Team
- `STRIPE_PRICE_PRO` – Price ID für Pro
- optional `APP_BASE_URL` – später finale Domain; aktuell GitHub Pages als Fallback

## Stripe Dashboard – nächster manueller Schritt

1. Stripe-Konto erstellen und **Testmodus** verwenden.
2. Drei Test-Produkte / wiederkehrende Testpreise für Solo, Team und Pro anlegen. Die finalen Verkaufspreise bleiben bis zum Beta-Feedback offen; für den technischen Test können vorläufige Testpreise verwendet werden.
3. Customer Portal aktivieren und mindestens Zahlungsmethode ändern, Rechnungen ansehen und Kündigung zum Periodenende erlauben.
4. Gewünschte Zahlungsmethoden für DACH im Testmodus aktivieren – zunächst Karte und, soweit im Konto verfügbar, SEPA-Lastschrift.
5. Webhook mit obiger URL und Eventliste anlegen.
6. Die fünf Werte oben ausschließlich als Supabase Edge-Function-Secrets hinterlegen.
7. Danach in AngebotsPilot → **Abo & Abrechnung** prüfen, bis „Stripe Testmodus vollständig verbunden“ erscheint.

## Sicherheitsregeln

- Niemals `sk_test_...`, `sk_live_...` oder `whsec_...` in GitHub, Browser-JavaScript, Screenshots oder Chat-Nachrichten veröffentlichen.
- Live Keys erst nach vollständigem Testlauf und finalen Preisen aktivieren.
- Test- und Live-Webhooks getrennt halten.
- Provider-IDs werden nur serverseitig geschrieben.
- Kundendaten werden bei Zahlungsverzug nie gelöscht.
