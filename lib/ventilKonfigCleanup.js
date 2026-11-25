'use strict';

const C = require('./constants');

/** Test-DPs, die nicht in Ventil-Konfig-Feldern (Zusatz) stehen dürfen. */
function istUngueltigerVentilKonfigPfad(val, P) {
    const s = String(val || '').trim();
    if (!s) {
        return false;
    }
    const blocklist = [
        P.TANK_DP_UNTEN_TEST,
        P.TANK_DP_OBEN_TEST,
        P.TANK_ISTWERT_SENSOR_DEFAULT,
        P.TANK_DP_PUMPE,
        P.GARTENPUMPE_AUSGANG_DEFAULT,
        P.FEUCHT_SENSOR_DEFAULT,
        P.TEMP_SENSOR_DEFAULT,
    ];
    if (blocklist.includes(s)) {
        return true;
    }
    if (/DatenPunkte_Bew[aä]sserung_\(TEST\)\.Tank-/i.test(s)) {
        return true;
    }
    return false;
}

async function bereinigeVentilKonfigTestDps(adapter) {
    const P = C.buildPaths(adapter.namespace);
    let stateCount = 0;

    for (let nr = 1; nr <= C.VENTIL_ANZAHL; nr += 1) {
        const base = P.ventilBase(nr);
        const stateIds = [
            `${base}.Konfig.FeuchtigkeitSensor`,
            `${base}.Konfig.Temperatursensor`,
            `${base}.Konfig.Ventil${nr}Ausgang`,
        ];
        for (const stateId of stateIds) {
            const st = await adapter.getStateAsync(stateId);
            const val = String(st?.val ?? '').trim();
            if (!istUngueltigerVentilKonfigPfad(val, P)) {
                continue;
            }
            await adapter.setStateAsync(stateId, '', true);
            stateCount += 1;
            adapter.log.info(`Ventil ${nr}: Test-DP aus Konfig entfernt (${val})`);
        }
    }

    const objId = `system.adapter.${adapter.name}.${adapter.instance}`;
    const obj = await adapter.getObjectAsync(objId);
    if (!obj?.native?.events || !Array.isArray(obj.native.events)) {
        return stateCount;
    }

    let eventsChanged = false;
    for (const row of obj.native.events) {
        if (!row || typeof row !== 'object') {
            continue;
        }
        for (const field of ['feuchtigkeitSensor', 'temperatursensor', 'name']) {
            if (istUngueltigerVentilKonfigPfad(row[field], P)) {
                adapter.log.info(`Admin events: Test-DP entfernt (${field}: ${row[field]})`);
                row[field] = '';
                eventsChanged = true;
            }
        }
    }

    if (eventsChanged) {
        await adapter.setObjectAsync(objId, obj);
    }

    return stateCount;
}

module.exports = { istUngueltigerVentilKonfigPfad, bereinigeVentilKonfigTestDps };
