'use strict';

const { sendToWithTimeout } = require('./sendToTimeout');

const SCRIPT_SUFFIX = 'script.js.common.Beregnungswerk';
const ADMIN_SEND_TO_TIMEOUT_MS = 10000;

function waitMs(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * Prüft, ob eine JavaScript-Instanz (z. B. javascript.0) im Objektbaum existiert.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {string} instance
 * @returns {Promise<boolean>}
 */
async function isJavascriptInstancePresent(adapter, instance) {
    const inst = String(instance || '').trim();
    if (!/^javascript\.\d+$/.test(inst)) {
        return false;
    }
    try {
        const obj = await adapter.getObjectAsync(`system.adapter.${inst}`);
        return !!(obj && obj.type === 'instance');
    } catch (e) {
        return false;
    }
}

/** @deprecated Alias – prüft Instanz-Existenz, nicht Paket-Neuinstallation */
async function isJavascriptInstalled(adapter, instance) {
    return isJavascriptInstancePresent(adapter, instance);
}

async function tryStartJavascriptInstance(adapter, instance) {
    const res = await sendToWithTimeout(adapter, 'admin.0', 'startInstance', instance, ADMIN_SEND_TO_TIMEOUT_MS);
    if (res && res.error) {
        adapter.log.debug(`JavaScript-Instanz starten (${instance}): ${res.error}`);
    } else {
        adapter.log.info(`JavaScript-Instanz ${instance} gestartet (admin.0)`);
    }
}

async function tryEnableJavascriptInstance(adapter, instance) {
    const res = await sendToWithTimeout(adapter, 'admin.0', 'enableInstance', instance, ADMIN_SEND_TO_TIMEOUT_MS);
    if (res && res.error) {
        adapter.log.debug(`JavaScript-Instanz aktivieren (${instance}): ${res.error}`);
    }
}

async function tryInstallJavascript(adapter) {
    const res = await sendToWithTimeout(
        adapter,
        'admin.0',
        'installAdapter',
        { name: 'javascript' },
        ADMIN_SEND_TO_TIMEOUT_MS,
    );
    if (res && res.error) {
        adapter.log.warn(`JavaScript-Adapter Installation: ${res.error}`);
        return false;
    }
    adapter.log.info('JavaScript-Adapter Installation angestoßen (admin.0)');
    return true;
}

async function findJavascriptInstance(adapter, preferred) {
    const pref = String(preferred || 'javascript.0').trim() || 'javascript.0';
    if (await isJavascriptInstancePresent(adapter, pref)) {
        return pref;
    }

    try {
        const view = await adapter.getObjectViewAsync('system', 'instance', {
            startkey: 'system.adapter.javascript.',
            endkey: 'system.adapter.javascript.\uFFFF',
        });
        const rows = view && view.rows ? view.rows : [];
        for (let i = 0; i < rows.length; i++) {
            const id = rows[i]?.id || '';
            const inst = id.replace('system.adapter.', '');
            if (/^javascript\.\d+$/.test(inst)) {
                return inst;
            }
        }
    } catch (e) {
        adapter.log.debug(`JavaScript-Instanz-Suche: ${e.message || e}`);
    }

    return null;
}

/**
 * Stellt sicher, dass der JavaScript-Adapter installiert ist (optional automatisch).
 * Installiert nur, wenn noch keine Instanz (z. B. javascript.0) existiert.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {string} instance z. B. javascript.0
 * @param {boolean} autoInstall
 * @returns {Promise<string|null>} gefundene Instanz oder null
 */
async function ensureJavascriptAdapter(adapter, instance, autoInstall) {
    const preferred = String(instance || 'javascript.0').trim() || 'javascript.0';
    let resolved = await findJavascriptInstance(adapter, preferred);

    if (resolved) {
        if (resolved !== preferred) {
            adapter.log.warn(
                `JavaScript-Instanz "${preferred}" fehlt – nutze "${resolved}" ` +
                `(Adapter-Einstellung „JavaScript-Instanz“ anpassen)`,
            );
        } else {
            adapter.log.info(`JavaScript-Instanz ${resolved} vorhanden – keine Installation.`);
        }
        await tryEnableJavascriptInstance(adapter, resolved);
        await tryStartJavascriptInstance(adapter, resolved);
        return resolved;
    }

    if (autoInstall === false) {
        adapter.log.warn(`JavaScript-Instanz "${preferred}" ist nicht vorhanden.`);
        throw new Error(
            `JavaScript-Instanz "${preferred}" fehlt. Bitte im ioBroker Admin unter „Adapter“ den JavaScript-Adapter installieren ` +
            `und Instanz starten – ohne ihn reagiert Beregnungswerk.js nicht auf Schalter/Taster.`,
        );
    }

    adapter.log.info(
        `Keine JavaScript-Instanz gefunden – automatische Installation wird angestoßen…`,
    );

    await tryInstallJavascript(adapter);

    for (let i = 0; i < 6; i++) {
        await waitMs(3000);
        resolved = await findJavascriptInstance(adapter, preferred);
        if (resolved) {
            adapter.log.info(`JavaScript-Instanz "${resolved}" ist jetzt verfügbar.`);
            await tryEnableJavascriptInstance(adapter, resolved);
            await tryStartJavascriptInstance(adapter, resolved);
            await waitMs(1500);
            return resolved;
        }
        adapter.log.info(`Warte auf JavaScript-Instanz … (${(i + 1) * 3}s)`);
    }

    throw new Error(
        `JavaScript-Instanz "${preferred}" konnte nicht automatisch angelegt werden. Bitte manuell installieren und Adapter neu starten.`,
    );
}

async function enableScriptObject(adapter, instance, autoEnable) {
    if (autoEnable === false) return;
    const scriptId = `${instance}.${SCRIPT_SUFFIX}`;
    const obj = await adapter.getObjectAsync(scriptId);
    if (!obj) {
        adapter.log.info(`Skript-Objekt ${scriptId} noch nicht vorhanden – nach Reload prüfen`);
        return;
    }
    if (obj.common && obj.common.enabled === true) return;
    await adapter.extendObjectAsync(scriptId, { common: { enabled: true } });
    adapter.log.info(`Skript aktiviert: ${scriptId}`);
}

module.exports = {
    ensureJavascriptAdapter,
    enableScriptObject,
    isJavascriptInstalled,
    isJavascriptInstancePresent,
    findJavascriptInstance,
};
