'use strict';

const C = require('./constants');

/**
 * @param {object} [config]
 */
function countFromConfig(config) {
    const c = config || {};
    const events = Array.isArray(c.events) ? c.events : [];
    if (events.length > 0) {
        return events.length;
    }
    const ventile = Array.isArray(c.ventile) ? c.ventile : [];
    return ventile.length;
}

/**
 * @param {object} [config]
 * @param {number} [existingMax]
 */
function resolveVentilCount(config, existingMax) {
    const min = C.VENTIL_ANZAHL_MIN;
    const max = C.VENTIL_ANZAHL_MAX;
    const fallback = C.VENTIL_ANZAHL_DEFAULT;
    const configCount = countFromConfig(config);
    const count = configCount > 0
        ? Math.max(configCount, existingMax || 0)
        : Math.max(fallback, existingMax || 0);
    return Math.min(Math.max(count, min), max);
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function resolveVentilCountForAdapter(adapter) {
    const events = adapter.config?.events;
    if (Array.isArray(events) && events.length > 0) {
        return resolveVentilCount(adapter.config, 0);
    }

    let existingMax = 0;
    for (let nr = 1; nr <= C.VENTIL_ANZAHL_MAX; nr += 1) {
        try {
            const rel = await adapter.getObjectAsync(`Ventil${nr}.Konfig.Bewaesserungsdauer`);
            if (rel) {
                existingMax = nr;
            }
        } catch (e) {
            // kein Ventil-Kanal
        }
    }
    return resolveVentilCount(adapter.config, existingMax);
}

function buildAktuellesVentilStates(anzahl) {
    const states = { 0: '–' };
    for (let nr = 1; nr <= anzahl; nr += 1) {
        states[nr] = `Ventil${nr}`;
    }
    return states;
}

module.exports = {
    countFromConfig,
    resolveVentilCount,
    resolveVentilCountForAdapter,
    buildAktuellesVentilStates,
};
