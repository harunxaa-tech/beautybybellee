# AngebotsPilot Native iOS Foundation

Dieser Ordner macht aus der bestehenden AngebotsPilot-Web-App eine native iPhone-App mit Capacitor 8.

## Architektur
- Die bestehenden Dateien im Repository-Root bleiben die einzige Web-Quelle.
- `npm run prepare:web` kopiert sie für einen Native-Build nach `native/www`.
- Der PWA-Service-Worker wird nur in der nativen Kopie deaktiviert.
- `npx cap add ios` erzeugt das Xcode-Projekt auf einem Mac/Cloud-Mac.
- `scripts/patch-ios.mjs` setzt Bundle-ID, iPhone-only, Version, App-Icon und Splash.

## Vorläufige Bundle-ID
`com.harunxaa.angebotspilot`

Die Bundle-ID muss vor dem ersten echten App-Store-/TestFlight-Record final bestätigt werden.

## Aktuelle Native-Version
0.1.0 – Foundation / Smoke Build

## Noch bewusst nicht aktiviert
Face ID, native Push-Nachrichten, Kamera/Scanner, Kontakte, natives Teilen/Dateien und native OAuth-Rücksprünge. Diese Funktionen kommen erst nach dem ersten erfolgreichen nativen Build, damit Fehler sauber getrennt werden können.
