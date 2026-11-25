'use strict';

const C = require('./constants');
const { getStateDefinitions } = require('./stateDefinitions');
const { buildDp } = require('./dpMap');
const { buildVentile } = require('./ventilRegistry');
const { resolveVentilCountForAdapter } = require('./resolveVentilCount');
const { buildStateGroups } = require('./stateGroups');
const { createScriptShim } = require('./scriptShim');
const runEngine = require('./engineCore');

/**
 * Baut Laufzeit-Kontext: aktive Pfade unter beregnungswerk.0, Legacy nur für Migration.
 */
function buildGlobals(adapter, shim, ventilAnzahl) {
    const namespace = adapter.namespace;
    const P = C.buildPaths(namespace);
    const EIGENE_STATES = getStateDefinitions(namespace);
    const groups = buildStateGroups(EIGENE_STATES, P);
    const count = ventilAnzahl || C.VENTIL_ANZAHL_DEFAULT;
    const DP = buildDp(P, count);
    const VENTILE = buildVentile(P, EIGENE_STATES, count);

    return {
        ...P,
        TEST_DP_BASE: P.TEST_BASE,
        LEGACY_DP_BASE: C.LEGACY_DP_BASE,
        ALT_DP_BASE: C.ALT_DP_BASE,
        LEGACY_TEST_DP_BASE: C.LEGACY_TEST_DP_BASE,
        VERALTETES_DP_BASIS: C.VERALTETES_DP_BASIS,
        V1: `${P.DP_BASE}.Ventil1`,
        VENTIL_ANZAHL: count,
        WETTERDATEN_TYPEN: C.WETTERDATEN_TYPEN,
        WETTER_ANBIETER_DEFAULT: C.WETTER_ANBIETER_DEFAULT,
        ANBIETER_SPEICHER_ID: P.ANBIETER_SPEICHER_ID,
        OPEN_METEO_ORT_DEFAULT: C.OPEN_METEO_ORT_DEFAULT,
        FEUCHT_SENSOR_DEFAULT: P.FEUCHT_SENSOR_DEFAULT,
        TEMP_SENSOR_DEFAULT: P.TEMP_SENSOR_DEFAULT,
        GARTENPUMPE_AUSGANG_DEFAULT: P.GARTENPUMPE_AUSGANG_DEFAULT,
        NACHTRUHE_VON_DEFAULT: C.NACHTRUHE_VON_DEFAULT,
        NACHTRUHE_BIS_DEFAULT: C.NACHTRUHE_BIS_DEFAULT,
        WHATSAPP_ADAPTER_NAMEN: C.WHATSAPP_ADAPTER_NAMEN,
        TELEGRAM_ADAPTER_NAME: C.TELEGRAM_ADAPTER_NAME,
        WHATSAPP_INSTANZ_DEFAULT: C.WHATSAPP_INSTANZ_DEFAULT,
        TELEGRAM_INSTANZ_DEFAULT: C.TELEGRAM_INSTANZ_DEFAULT,
        KONFIG_DAUER_DEFAULT: C.KONFIG_DAUER_DEFAULT,
        KONFIG_WIEDERHOLUNGEN_DEFAULT: C.KONFIG_WIEDERHOLUNGEN_DEFAULT,
        FARBE: C.FARBE,
        TANK_WERT_AKTUEL_BESCHREIBUNG: C.TANK_WERT_AKTUEL_BESCHREIBUNG,
        DP,
        VENTILE,
        EIGENE_STATES,
        ...groups,
        ...shim,
    };
}

async function startEngine(adapter) {
    const shim = await createScriptShim(adapter);
    const ventilAnzahl = await resolveVentilCountForAdapter(adapter);
    const g = buildGlobals(adapter, shim, ventilAnzahl);
    const { initScript } = runEngine(g);
    initScript();
    adapter.log.info(
        `Bewässerungslogik aktiv unter ${adapter.namespace} (${ventilAnzahl} Ventile, Test: ${g.TEST_DP_BASE})`,
    );
}

module.exports = { startEngine };
