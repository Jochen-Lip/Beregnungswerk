# Beregnungswerk

Automatische Gartenbewässerung für ioBroker: bis zu vier Ventile, Zeit- und Astro-Schaltzeiten, Wetterdaten, Tank, Gartenpumpe und Nachrichten.

## Installation von GitHub

Im ioBroker-Admin unter **Befehl ausführen** diese Zeile eintragen. `beregnungswerk` muss kleingeschrieben sein, sonst bricht die Installation mit Code 25 ab:

```
url https://github.com/Jochen-Lip/beregnungswerk/tarball/main --host iobroker --debug
```

Dieselbe Adresse gilt, wenn das Feld nur eine URL erwartet:

```
https://github.com/Jochen-Lip/beregnungswerk/tarball/main
```

Danach eine Instanz anlegen. Der Adapter heißt `beregnungswerk`, die Instanz `beregnungswerk.0`.

Voraussetzungen: js-controller ab 5.7.3, Admin ab 6 und der JavaScript-Adapter ab 5.

## Lizenz

MIT
