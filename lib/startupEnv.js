'use strict';

/**
 * Eingebaute Engine beim Adapter-Start (schnell, kein javascript.0-Deploy).
 * Nur wenn preferBuiltinEngine explizit false ist → JavaScript-Skript-Pfad.
 * @param {import('@iobroker/adapter-core').Adapter} [adapter]
 */
function preferBuiltinEngineStartup(adapter) {
    return !(adapter && adapter.config && adapter.config.preferBuiltinEngine === false);
}

/** @deprecated Alias */
function isLocalDevServerHost(adapter) {
    return preferBuiltinEngineStartup(adapter);
}

module.exports = {
    isLocalDevServerHost,
    preferBuiltinEngineStartup,
};
