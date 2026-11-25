'use strict';

const C = require('./constants');

/**
 * Schreibt Ventil-Konfiguration aus dem Admin-Modal in die Laufzeit-Datenpunkte
 * und spiegelt Bewässerungsdauer + Ausgang in native.events.
 */
async function saveVentilKonfigFromMessage(adapter, payload) {
    const rowIndex = Number(payload?.rowIndex);
    const nr = Number(payload?.nr);
    const patch = payload?.patch || {};

    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= C.VENTIL_ANZAHL) {
        throw new Error('Ungültige Ventilzeile');
    }
    if (!Number.isInteger(nr) || nr < 1 || nr > C.VENTIL_ANZAHL || nr !== rowIndex + 1) {
        throw new Error('Ungültige Ventilnummer');
    }

    const dauer = Number(patch.bewaesserungsdauer);
    const wieder = Number(patch.wiederholungen);
    if (!Number.isFinite(dauer) || dauer < 1 || dauer > 120) {
        throw new Error('Bewässerungsdauer: 1–120 Minuten');
    }
    if (!Number.isFinite(wieder) || wieder < 1 || wieder > 99) {
        throw new Error('Wiederholungen: 1–99');
    }

    const base = C.buildPaths(adapter.namespace).ventilBase(nr);
    const feucht = String(patch.feuchtigkeitSensor || '');
    const temp = String(patch.temperatursensor || '');
    const ausgang = String(patch.ausgang || '');

    await adapter.setStateAsync(`${base}.Konfig.Bewaesserungsdauer`, dauer, true);
    await adapter.setStateAsync(`${base}.Konfig.Wiederholungen`, wieder, true);
    await adapter.setStateAsync(`${base}.Konfig.FeuchtigkeitSensor`, feucht, true);
    await adapter.setStateAsync(`${base}.Konfig.Temperatursensor`, temp, true);
    await adapter.setStateAsync(`${base}.Konfig.Ventil${nr}Ausgang`, ausgang, true);

    const schwelle = patch.schwelle;
    if (schwelle && typeof schwelle === 'object') {
        const shw = `${base}.Schwelle`;
        if (schwelle.feuchtigkeitAktiv !== undefined) {
            await adapter.setStateAsync(`${shw}.FeuchtigkeitAktiv`, !!schwelle.feuchtigkeitAktiv, true);
        }
        if (schwelle.feuchtigkeitWert !== undefined) {
            await adapter.setStateAsync(`${shw}.FeuchtigkeitWert`, Number(schwelle.feuchtigkeitWert), true);
        }
        if (schwelle.temperaturAktiv !== undefined) {
            await adapter.setStateAsync(`${shw}.TemperaturAktiv`, !!schwelle.temperaturAktiv, true);
        }
        if (schwelle.temperaturWert !== undefined) {
            await adapter.setStateAsync(`${shw}.TemperaturWert`, Number(schwelle.temperaturWert), true);
        }
        if (schwelle.vergleich !== undefined) {
            await adapter.setStateAsync(`${shw}.Vergleich`, !!schwelle.vergleich, true);
        }
    }

    const objId = `system.adapter.${adapter.name}.${adapter.instance}`;
    const obj = await adapter.getObjectAsync(objId);
    if (obj && obj.native) {
        if (!Array.isArray(obj.native.events)) {
            obj.native.events = [];
        }
        while (obj.native.events.length <= rowIndex) {
            obj.native.events.push({});
        }
        const row = obj.native.events[rowIndex];
        row.wateringTime = dauer;
        row.wiederholungen = wieder;
        row.name = ausgang;
        row.feuchtigkeitSensor = feucht;
        row.temperatursensor = temp;
        if (schwelle && typeof schwelle === 'object') {
            row.schwelleFeuchtAktiv = !!schwelle.feuchtigkeitAktiv;
            row.schwelleFeuchtWert = Number(schwelle.feuchtigkeitWert);
            row.schwelleTempAktiv = !!schwelle.temperaturAktiv;
            row.schwelleTempWert = Number(schwelle.temperaturWert);
            row.schwelleVergleich = !!schwelle.vergleich;
        }
        await adapter.setObjectAsync(objId, obj);
    }

    adapter.log.info(`Ventil ${nr}: Konfiguration aus Admin-Modal gespeichert`);
    return { ok: true };
}

module.exports = { saveVentilKonfigFromMessage };
