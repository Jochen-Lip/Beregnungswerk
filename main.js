'use strict';

/* Beregnungswerk – ioBroker Adapter (Datenpunkte unter beregnungswerk.0) */

const fs = require('fs');
const path = require('path');
const utils = require('@iobroker/adapter-core');
const {
    syncConfigToAdapter,
    readVentilConfigFromDp,
    syncVentilTableFromDp,
    syncTimeTableFromDp,
    pruneOrphanVentilDpsFromConfig,
    pruneOrphanSchaltzeitDpsFromConfig,
    ensureVentilsFromConfigEvents,
    purgeLegacyFactorySchaltzeitZeit,
    ensureSchaltzeitenFromConfigTimeEvents,
    afterTimeRowDelete,
} = require('./lib/configSync');
const { ensureJavascriptAdapter, enableScriptObject } = require('./lib/ensureJavascript');
const { ensureAdapterStates, ensureVentilByNr, ensurePumpeByNr, deleteVentilByNr, ensureSchaltzeitByNr, deleteSchaltzeitByNr } = require('./lib/ensureAdapterStates');
const { startEngine } = require('./lib/engine');
const { sendToWithTimeout } = require('./lib/sendToTimeout');
const { preferBuiltinEngineStartup } = require('./lib/startupEnv');
const { publishAdapterCatalog, watchAdapterCatalog } = require('./lib/adapterCatalog');
const { ensureVis2Project } = require('./lib/ensureVis2');

const SCRIPT_FILE = 'Beregnungswerk.js';
const JS_RELOAD_TIMEOUT_MS = 8000;

/** @type {import('@iobroker/adapter-core').Adapter | undefined} */
let adapter;

async function onMessage(obj) {
    if (!obj || !obj.command) {
        return false;
    }

    if (obj.command === 'readVentilConfigFromDp') {
        try {
            const ventilNative = await readVentilConfigFromDp(adapter);
            adapter.log.debug('readVentilConfigFromDp: Ventilwerte aus Datenpunkten geladen');
            if (typeof obj.callback === 'function') {
                obj.callback({ native: ventilNative });
            }
        } catch (e) {
            adapter.log.error(`readVentilConfigFromDp: ${e.message || e}`);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: e.message || String(e) });
            }
        }
        return true;
    }

    if (obj.command === 'syncVentilTableFromDp') {
        try {
            adapter.log.info('syncVentilTableFromDp angefordert');
            const stats = await syncVentilTableFromDp(adapter);
            if (typeof obj.callback === 'function') {
                obj.callback({
                    error: null,
                    native: { events: stats.events, ventile: stats.ventile },
                    stats,
                });
            }
        } catch (e) {
            adapter.log.error(`syncVentilTableFromDp: ${e.message || e}`);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: e.message || String(e) });
            }
        }
        return true;
    }

    if (obj.command === 'ensurePumpe') {
        const nr = obj.message && obj.message.nr;
        try {
            adapter.log.info(`ensurePumpe angefordert für Pumpe${nr}`);
            const stats = await ensurePumpeByNr(adapter, nr);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: null, stats });
            }
        } catch (e) {
            adapter.log.error(`ensurePumpe: ${e.message || e}`);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: e.message || String(e) });
            }
        }
        return true;
    }

    if (obj.command === 'ensureVentil') {
        const nr = obj.message && obj.message.nr;
        try {
            adapter.log.info(`ensureVentil angefordert für Ventil${nr}`);
            const stats = await ensureVentilByNr(adapter, nr);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: null, stats });
            }
        } catch (e) {
            adapter.log.error(`ensureVentil: ${e.message || e}`);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: e.message || String(e) });
            }
        }
        return true;
    }

    if (obj.command === 'deleteVentil') {
        const raw = obj.message;
        const nr = raw && typeof raw === 'object' ? raw.nr : raw;
        try {
            adapter.log.info(`deleteVentil angefordert für Ventil${nr}`);
            const stats = await deleteVentilByNr(adapter, nr);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: null, stats });
            }
        } catch (e) {
            adapter.log.error(`deleteVentil: ${e.message || e}`);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: e.message || String(e) });
            }
        }
        return true;
    }

    if (obj.command === 'ensureSchaltzeit') {
        const nr = obj.message && obj.message.nr;
        try {
            adapter.log.info(`ensureSchaltzeit angefordert für Schaltzeit${nr}`);
            const stats = await ensureSchaltzeitByNr(adapter, nr);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: null, stats });
            }
        } catch (e) {
            adapter.log.error(`ensureSchaltzeit: ${e.message || e}`);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: e.message || String(e) });
            }
        }
        return true;
    }

    if (obj.command === 'deleteSchaltzeit') {
        const raw = obj.message;
        const nr = raw && typeof raw === 'object' ? raw.nr : raw;
        try {
            adapter.log.info(`deleteSchaltzeit angefordert für Schaltzeit${nr}`);
            const stats = await deleteSchaltzeitByNr(adapter, nr);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: null, stats });
            }
        } catch (e) {
            adapter.log.error(`deleteSchaltzeit: ${e.message || e}`);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: e.message || String(e) });
            }
        }
        return true;
    }

    if (obj.command === 'afterTimeRowDelete') {
        const raw = obj.message && typeof obj.message === 'object' ? obj.message : {};
        const rowCount = raw.rowCount;
        try {
            adapter.log.info(`afterTimeRowDelete: ${rowCount} Tab-Zeile(n)`);
            const stats = await afterTimeRowDelete(adapter, rowCount);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: null, stats });
            }
        } catch (e) {
            adapter.log.error(`afterTimeRowDelete: ${e.message || e}`);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: e.message || String(e) });
            }
        }
        return true;
    }

    if (obj.command === 'syncTimeTableFromDp') {
        try {
            adapter.log.info('syncTimeTableFromDp angefordert');
            const stats = await syncTimeTableFromDp(adapter);
            if (typeof obj.callback === 'function') {
                obj.callback({
                    error: null,
                    native: { timeEvents: stats.timeEvents },
                    stats,
                });
            }
        } catch (e) {
            adapter.log.error(`syncTimeTableFromDp: ${e.message || e}`);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: e.message || String(e) });
            }
        }
        return true;
    }

    if (obj.command === 'ensureStates') {
        try {
            adapter.log.info('ensureStates angefordert (z. B. vom JavaScript-Skript)');
            const stats = await ensureAdapterStates(adapter);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: null, stats });
            }
        } catch (e) {
            adapter.log.error(`ensureStates: ${e.message || e}`);
            if (typeof obj.callback === 'function') {
                obj.callback({ error: e.message || String(e) });
            }
        }
        return true;
    }

    return false;
}

function startAdapter(options) {
    return (adapter = utils.adapter(Object.assign({}, options, {
        name: 'beregnungswerk',
        ready: main,
        message: onMessage,
        unload: (callback) => {
            try {
                adapter.log.info('Beregnungswerk-Adapter beendet.');
                callback();
            } catch (e) {
                callback();
            }
        },
    })));
}

function getJavascriptInstance() {
    const inst = String(adapter.config.javascriptInstance || 'javascript.0').trim();
    return inst || 'javascript.0';
}

function getJavascriptDataDir(instance) {
    const baseDir =
        typeof utils.getAbsoluteDefaultDataDir === 'function'
            ? utils.getAbsoluteDefaultDataDir()
            : path.join(process.cwd(), 'iobroker-data');
    return path.join(baseDir, instance);
}

function readPackagedScript() {
    const src = path.join(__dirname, 'lib', SCRIPT_FILE);
    if (!fs.existsSync(src)) {
        throw new Error(`Paket-Skript fehlt: ${src}`);
    }
    const banner = `// Beregnungswerk – bereitgestellt durch ioBroker.beregnungswerk@${adapter.version}\n`;
    let source = fs.readFileSync(src, 'utf8');
    source = source.replace(
        /const DP_BASE = 'beregnungswerk\.0'/,
        `const DP_BASE = '${adapter.namespace}'`,
    );
    if (!source.includes('bereitgestellt durch ioBroker.beregnungswerk@')) {
        source = banner + source;
    } else {
        source = source.replace(
            /^\/\/ Beregnungswerk – bereitgestellt durch ioBroker\.beregnungswerk@[^\n]*\n/,
            banner,
        );
    }
    return source;
}

async function reloadJavascriptInstance(instance) {
    const res = await sendToWithTimeout(adapter, instance, 'reload', null, JS_RELOAD_TIMEOUT_MS);
    if (res && res.error) {
        adapter.log.warn(`JavaScript reload (${instance}): ${res.error}`);
        return false;
    }
    adapter.log.info(`JavaScript-Adapter ${instance}: Skripte neu geladen`);
    return true;
}

async function runVentilConfigSync() {
    await pruneOrphanVentilDpsFromConfig(adapter).catch((e) =>
        adapter.log.warn(`Ventil-DP-Bereinigung (Tab): ${e.message || e}`),
    );

    await pruneOrphanSchaltzeitDpsFromConfig(adapter).catch((e) =>
        adapter.log.warn(`Schaltzeit-DP-Bereinigung (Tab): ${e.message || e}`),
    );

    await purgeLegacyFactorySchaltzeitZeit(adapter, { persist: true }).catch((e) =>
        adapter.log.warn(`Legacy-Schaltzeit bereinigen: ${e.message || e}`),
    );

    await ensureVentilsFromConfigEvents(adapter).catch((e) =>
        adapter.log.warn(`Ventil-DPs aus Tab-Zeilen: ${e.message || e}`),
    );

    await ensureSchaltzeitenFromConfigTimeEvents(adapter).catch((e) =>
        adapter.log.warn(`Schaltzeit-DPs aus Tab-Zeilen: ${e.message || e}`),
    );

    const cfgEvents = adapter.config && adapter.config.events;
    if (!Array.isArray(cfgEvents) || cfgEvents.length < 1) {
        await syncVentilTableFromDp(adapter).catch((e) =>
            adapter.log.warn(`Ventil-Tabelle aus DPs: ${e.message || e}`),
        );
    } else {
        adapter.log.info(
            `Ventil-Tabelle unverändert (${cfgEvents.length} Zeile(n)) – kein DP-Sync beim Start`,
        );
    }

    await syncConfigToAdapter(adapter).catch((e) => adapter.log.warn(`Config-Sync: ${e.message || e}`));
}

async function checkStates() {
    await adapter.setObjectNotExistsAsync('info.setupError', {
        type: 'state',
        common: {
            name: 'Setup-Fehler',
            type: 'string',
            role: 'text',
            read: true,
            write: false,
            def: '',
        },
        native: {},
    });
    await adapter.setStateAsync('info.scriptDeployed', false, true);
    await adapter.setStateAsync('info.scriptPath', '', true);
    await adapter.setStateAsync('info.scriptVersion', String(adapter.version || ''), true);
    await adapter.setStateAsync('info.dataNamespace', adapter.namespace, true);
    await adapter.setStateAsync('info.statesTotal', 0, true);
    await adapter.setStateAsync('info.statesCreated', 0, true);
}

async function deployScript(instance) {
    const destDir = getJavascriptDataDir(instance);
    const dest = path.join(destDir, SCRIPT_FILE);
    const source = readPackagedScript();

    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    let write = !fs.existsSync(dest);
    if (!write && adapter.config.overwriteScript !== false) {
        write = fs.readFileSync(dest, 'utf8') !== source;
    }

    if (write) {
        fs.writeFileSync(dest, source, 'utf8');
        adapter.log.info(`Skript geschrieben: ${dest}`);
    } else {
        adapter.log.info(`Skript unverändert: ${dest}`);
    }

    const reloaded = await reloadJavascriptInstance(instance);
    if (!reloaded) {
        return false;
    }

    await new Promise((r) => setTimeout(r, 800));
    await enableScriptObject(adapter, instance, adapter.config.autoEnableScript !== false);

    await adapter.setStateAsync('info.scriptDeployed', true, true);
    await adapter.setStateAsync('info.scriptPath', dest, true);
    await adapter.setStateAsync('info.scriptVersion', String(adapter.version || ''), true);
    return true;
}

async function tryEnsureJavascript(instance) {
    try {
        const resolved = await ensureJavascriptAdapter(
            adapter,
            instance,
            adapter.config.autoInstallJavascript !== false,
        );
        return resolved || null;
    } catch (e) {
        adapter.log.warn(`${e.message || e}`);
        adapter.log.warn(
            'JavaScript-Adapter fehlt – Beregnungswerk.js wird nicht bereitgestellt; ' +
            'Fallback: eingebaute Engine im Adapter.',
        );
        return null;
    }
}

async function startBuiltinEngine() {
    await Promise.race([
        startEngine(adapter),
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Engine-Start Timeout (20s)')), 20000);
        }),
    ]);
    await adapter.setStateAsync('info.scriptDeployed', true, true);
    await adapter.setStateAsync('info.scriptPath', `${adapter.namespace} (Adapter-Engine)`, true);
    await adapter.setStateAsync('info.scriptVersion', String(adapter.version || ''), true);
}

async function startLogic(statesOk) {
    if (!statesOk) {
        adapter.log.error('Bewässerungslogik aus – zu wenige Datenpunkte');
        await adapter.setStateAsync('info.scriptDeployed', false, true);
        await adapter.setStateAsync('info.scriptPath', '', true);
        return { logicMode: 'none', jsInstance: null };
    }

    const devServer = preferBuiltinEngineStartup(adapter);
    if (devServer) {
        adapter.log.info('Engine-Modus beim Start (Dev-Server / preferBuiltinEngine) – ohne javascript.0-Deploy');
        await startBuiltinEngine();
        return { logicMode: 'engine', jsInstance: null };
    }

    const instanceCfg = getJavascriptInstance();
    const jsInstance = await tryEnsureJavascript(instanceCfg);
    if (jsInstance) {
        const scriptOk = await deployScript(jsInstance);
        if (scriptOk) {
            return { logicMode: 'javascript', jsInstance };
        }
        adapter.log.warn(
            `JavaScript-Skript auf ${jsInstance} nicht erreichbar – Fallback: eingebaute Engine`,
        );
    }

    await startBuiltinEngine();
    return { logicMode: 'engine', jsInstance: jsInstance || null };
}

async function main() {
    adapter.log.info(`Beregnungswerk-Adapter v${adapter.version} gestartet`);
    watchAdapterCatalog(adapter);
    await publishAdapterCatalog(adapter).catch((e) =>
        adapter.log.warn(`Adapterkarte: ${e.message || e}`),
    );

    adapter.on('reloadConfig', (config) => {
        adapter.config = config;
        purgeLegacyFactorySchaltzeitZeit(adapter, { persist: true })
            .then(() => pruneOrphanVentilDpsFromConfig(adapter))
            .then(() => pruneOrphanSchaltzeitDpsFromConfig(adapter))
            .then(() => ensureVentilsFromConfigEvents(adapter))
            .then(() => ensureSchaltzeitenFromConfigTimeEvents(adapter))
            .then(() => syncConfigToAdapter(adapter))
            .catch((e) =>
                adapter.log.warn(`Config-Sync nach Speichern: ${e.message || e}`),
            );
    });

    try {
        adapter.log.info('Start Phase 1/5: info-DPs …');
        await checkStates();

        adapter.log.info('Start Phase 2/5: Datenpunkt-Katalog …');
        const stats = await ensureAdapterStates(adapter);
        await adapter.setStateAsync('info.statesTotal', stats.total, true);
        await adapter.setStateAsync('info.statesCreated', stats.created, true);

        adapter.log.info('Start Phase 3/5: Ventil1 …');
        await ensureVentilByNr(adapter, 1).catch((e) =>
            adapter.log.warn(`Ventil1 sichern: ${e.message || e}`),
        );

        adapter.log.info('Start Phase 4/5: Ventil-Tabelle ↔ DPs …');
        await runVentilConfigSync();

        if (stats.created === 0 && stats.skipped === 0) {
            adapter.log.error(
                `KEINE Datenpunkte unter ${adapter.namespace} – ` +
                'Log nach „State-Katalog FEHLER“ oder „beregnungswerk.0.“ suchen',
            );
        }

        const statesOk = stats.total > 0 && (stats.created + stats.skipped) >= Math.min(50, stats.total);

        adapter.log.info('Start Phase 5/5: Bewässerungslogik …');
        const { logicMode, jsInstance } = await startLogic(statesOk);

        await ensureVis2Project(adapter).catch((e) =>
            adapter.log.warn(`Vis-2: ${e.message || e}`),
        );

        adapter.log.info(
            `Beregnungswerk bereit – ${stats.total} Definitionen, ` +
            `${stats.created + stats.skipped} unter ${adapter.namespace}` +
            (logicMode === 'javascript' ? `, Skript auf ${jsInstance} aktiv` :
                logicMode === 'engine' ? ', Engine aktiv' :
                    ' (Logik ausstehend)'),
        );
    } catch (err) {
        adapter.log.error(`Start fehlgeschlagen: ${err.message || err}`);
        if (err.stack) adapter.log.debug(err.stack);
        await adapter.setStateAsync('info.scriptDeployed', false, true);
        await adapter.setStateAsync('info.setupError', String(err.message || err), true).catch(() => {});
    }
}

if (process.argv.includes('--install')) {
    const { enforceInstalledFromFile } = require('./lib/adapterCatalog');
    try {
        enforceInstalledFromFile(path.join(__dirname, 'io-package.json'));
    } catch (e) {
        console.error(`Adapterkarte: ${e.message || e}`);
    }
    process.exit(0);
}

if (require.main !== module) {
    module.exports = startAdapter;
} else {
    startAdapter();
}
