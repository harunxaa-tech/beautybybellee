# AngebotsPilot v9.8.3 – Runtime Fix

## Kritischer Fix
In v9.8.2 fehlten grundlegende JavaScript-Definitionen. Dadurch brach das Script beim ersten `renderAll()` ab, bevor die Tour-Buttons registriert wurden.

Wiederhergestellt:
- onboardingStep
- onboardingTrade
- onboardingTax
- catalogFilter
- TRADE_CATALOGS
- shouldShowOnboarding()

Zusätzlich bleiben enthalten:
- echte Event-Listener für beide Einführung-Buttons
- iOS/PWA-Fallback
- Angebots-Guide
- App-eigene Dialoge statt Browser-Popups

Sichtbare Versionsanzeige unter „App-Einführung“: 9.8.3
