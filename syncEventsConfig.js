'use strict';

const C = require('./constants');

/**
 * Überträgt native.events (Ventilauswahl-Admin) auf die Laufzeit-Datenpunkte.
 * Zuordnung pro Zeile i (0-basiert), Ventil nr = i + 1:
 *   enabled      → Ventil{nr}.Konfig.Aktiviert (+ SchleifenSteuerung.Ventil{nr} parallel)
 *   name         → Ventil{nr}.Konfig.Ventil{nr}Ausgang
 *   wateringTime → Ventil{nr}.Konfig.Bewaesserungsdauer
 */
async function syncEventsFromConfig(adapter) {
    const events = adapter.config?.events;
    if (!Array.isArray(events) || events.length === 0) {
        return 0;
    }

    const P = C.buildPaths(adapter.namespace);
    let count = 0;

    for (let i = 0; i < events.length && i < C.VENTIL_ANZAHL; i++) {
        const row = events[i] || {};
        const nr = i + 1;
        const base = P.ventilBase(nr);

        if (typeof row.enabled === 'boolean') {
            await adapter.setStateAsync(`${base}.Konfig.Aktiviert`, row.enabled, true);
            await adapter.setStateAsync(`${P.SCHLEIFE_BASE}.Ventil${nr}`, row.enabled, true);
            count += 2;
        }

        if (row.name !== undefined && row.name !== null) {
            await adapter.setStateAsync(`${base}.Konfig.Ventil${nr}Ausgang`, String(row.name), true);
            count++;
        }

        const dauer = row.wateringTime;
        if (dauer !== undefined && dauer !== null && dauer !== '') {
            const min = Number(dauer);
            if (!Number.isNaN(min) && min > 0) {
                await adapter.setStateAsync(`${base}.Konfig.Bewaesserungsdauer`, min, true);
                count++;
            }
        }
    }

    if (count > 0) {
        adapter.log.info(`Ventilauswahl: ${count} Werte aus Admin-Konfiguration in Datenpunkte übernommen`);
    }
    return count;
}

module.exports = { syncEventsFromConfig };
