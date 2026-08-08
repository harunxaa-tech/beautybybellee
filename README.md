# Digitaler Handwerker v9.2

## iPhone PWA Fix
- Scrollen im Home-Bildschirm-/Standalone-Modus repariert
- Onboarding nutzt 100dvh / -webkit-fill-available
- eigener vertikaler Scroll-Container
- iOS Momentum Scrolling aktiviert
- Safe-Area oben und unten berücksichtigt
- Touch-Gesten explizit auf vertikales Scrollen freigegeben
- zusätzlicher navigator.standalone-Fallback für iOS

Nach dem Upload alte Home-Screen-App einmal löschen und neu zum Home-Bildschirm hinzufügen, damit iOS Service Worker und PWA-Dateien sicher aktualisiert.
