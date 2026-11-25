'use strict';

const C = require('./constants');

/**
 * Überträgt native.events (Ventilauswahl-Admin) auf die Laufzeit-Datenpunkte.
 * Ventil-Nr aus row.nr (bleibt beim Verschieben), Fallback: Zeilenindex + 1:
 *   enabled      → SchleifenSteuerung.Ventil{nr} (Konfig.Aktiviert spiegelt die Engine)
 *   name         → Ventil{nr}.Konfig.Ventil{nr}Ausgang
 *   wateringTime → Ventil{nr}.Konfig.Bewaesserungsdauer
 *   wiederholungen → Ventil{nr}.Konfig.Wiederholungen
 *   feuchtigkeitSensor → Ventil{nr}.Konfig.FeuchtigkeitSensor
 *   temperatursensor → Ventil{nr}.Konfig.Temperatursensor
 *   schwelleFeuchtWert / schwelleTempAktiv / schwelleTempWert / schwelleVergleich
 *     → Ventil{nr}.Schwelle.* (FeuchtigkeitAktiv automatisch bei Sensor+Wert)
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
        const parsedNr = parseInt(row.nr, 10);
        const nr = (!Number.isNaN(parsedNr) && parsedNr > 0 && parsedNr <= C.VENTIL_ANZAHL) ? parsedNr : (i + 1);
        const base = P.ventilBase(nr);

        if (typeof row.enabled === 'boolean') {
            await adapter.setStateAsync(`${P.SCHLEIFE_BASE}.Ventil${nr}`, row.enabled, true);
            count++;
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

        const wieder = row.wiederholungen;
        if (wieder !== undefined && wieder !== null && wieder !== '') {
            const n = Number(wieder);
            if (!Number.isNaN(n) && n > 0) {
                await adapter.setStateAsync(`${base}.Konfig.Wiederholungen`, n, true);
                count++;
            }
        }

        if (row.feuchtigkeitSensor !== undefined && row.feuchtigkeitSensor !== null) {
            await adapter.setStateAsync(`${base}.Konfig.FeuchtigkeitSensor`, String(row.feuchtigkeitSensor), true);
            count++;
        }

        if (row.temperatursensor !== undefined && row.temperatursensor !== null) {
            await adapter.setStateAsync(`${base}.Konfig.Temperatursensor`, String(row.temperatursensor), true);
            count++;
        }

        const shw = `${base}.Schwelle`;
        const feuchtSensor = String(row.feuchtigkeitSensor || '').trim();
        const feuchtWert = row.schwelleFeuchtWert;
        const feuchtAktiv = feuchtSensor.length > 0
            && feuchtWert !== undefined && feuchtWert !== null && feuchtWert !== '';
        await adapter.setStateAsync(`${shw}.FeuchtigkeitAktiv`, feuchtAktiv, true);
        if (feuchtAktiv) {
            count++;
        }
        if (feuchtWert !== undefined && feuchtWert !== null && feuchtWert !== '') {
            const fv = Number(feuchtWert);
            if (!Number.isNaN(fv)) {
                await adapter.setStateAsync(`${shw}.FeuchtigkeitWert`, fv, true);
                count++;
            }
        }
        if (typeof row.schwelleTempAktiv === 'boolean') {
            await adapter.setStateAsync(`${shw}.TemperaturAktiv`, row.schwelleTempAktiv, true);
            count++;
        }
        if (row.schwelleTempWert !== undefined && row.schwelleTempWert !== null && row.schwelleTempWert !== '') {
            const tv = Number(row.schwelleTempWert);
            if (!Number.isNaN(tv)) {
                await adapter.setStateAsync(`${shw}.TemperaturWert`, tv, true);
                count++;
            }
        }
        if (typeof row.schwelleVergleich === 'boolean') {
            await adapter.setStateAsync(`${shw}.Vergleich`, row.schwelleVergleich, true);
            count++;
        }
    }

    if (count > 0) {
        adapter.log.info(`Ventilauswahl: ${count} Werte aus Admin-Konfiguration in Datenpunkte übernommen`);
    }
    return count;
}

module.exports = { syncEventsFromConfig };
