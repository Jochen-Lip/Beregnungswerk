'use strict';

const DEFAULT_SEND_TO_TIMEOUT_MS = 8000;

/**
 * sendTo mit Timeout – verhindert Hänger wenn Ziel-Adapter (z. B. javascript.0) nicht antwortet.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {string} instance
 * @param {string} command
 * @param {unknown} message
 * @param {number} [timeoutMs]
 * @returns {Promise<object>}
 */
function sendToWithTimeout(adapter, instance, command, message, timeoutMs) {
    const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_SEND_TO_TIMEOUT_MS;
    const target = String(instance || '').trim();
    const cmd = String(command || '').trim();

    return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            resolve({
                error: `Timeout (${ms}ms) bei sendTo ${target}.${cmd}`,
            });
        }, ms);

        function finish(res) {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            resolve(res && typeof res === 'object' ? res : {});
        }

        try {
            adapter.sendTo(target, cmd, message, (res) => finish(res));
        } catch (e) {
            finish({ error: e.message || String(e) });
        }
    });
}

module.exports = {
    DEFAULT_SEND_TO_TIMEOUT_MS,
    sendToWithTimeout,
};
