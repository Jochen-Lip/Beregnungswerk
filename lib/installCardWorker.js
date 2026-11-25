'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const {
    ADAPTER_NAME,
    activeRepoNames,
    catalogEntryFromIoPack,
    enforceInstalledFromFile,
    findControllerCli,
    findIoBrokerRoot,
    isNpmInstalledFrom,
} = require('./adapterCatalog');

const packageDir = path.resolve(__dirname, '..');
const ioPackPath = path.join(packageDir, 'io-package.json');
const WAIT_MS = 90000;
const INTERVAL_MS = 500;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCliJson(text) {
    const source = String(text || '').trim();
    if (!source) {
        return undefined;
    }
    if (source === 'true') return true;
    if (source === 'false') return false;
    if (source === 'null') return null;
    if (/^-?\d+(?:\.\d+)?$/.test(source)) return Number(source);
    const starts = [];
    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        if (ch === '{' || ch === '[' || ch === '"') {
            starts.push(i);
        }
    }
    for (let i = starts.length - 1; i >= 0; i -= 1) {
        try {
            return JSON.parse(source.slice(starts[i]));
        } catch (e) {
            // davor nach dem nächsten JSON-Wert suchen
        }
    }
    return undefined;
}

function runCli(cli, root, args) {
    return spawnSync(process.execPath, [cli, ...args], {
        cwd: root,
        encoding: 'utf8',
        timeout: 30000,
        windowsHide: true,
    });
}

function getObject(cli, root, id, propPath) {
    const args = ['object', 'get', id];
    if (propPath) {
        args.push(propPath);
    }
    const result = runCli(cli, root, args);
    if (result.status !== 0) {
        return undefined;
    }
    return parseCliJson(result.stdout);
}

function extendObject(cli, root, id, value) {
    const result = runCli(cli, root, ['object', 'extend', id, JSON.stringify(value)]);
    return result.status === 0;
}

function catalogVersion(cli, root, repoName) {
    const entry = getObject(
        cli,
        root,
        'system.repositories',
        `native.repositories.${repoName}.json.${ADAPTER_NAME}`,
    );
    return entry && entry.version;
}

function catalogIsLoaded(cli, root, repoName) {
    const info = getObject(
        cli,
        root,
        'system.repositories',
        `native.repositories.${repoName}.json._repoInfo`,
    );
    return !!(info && typeof info === 'object');
}

async function correctAdapterCard() {
    const root = findIoBrokerRoot(packageDir);
    const cli = findControllerCli(root);
    const started = Date.now();
    let stable = 0;

    while (Date.now() - started < WAIT_MS) {
        let fileReady = false;
        let objectReady = !cli;
        let catalogReady = !cli;
        let fileState = null;

        try {
            fileState = enforceInstalledFromFile(ioPackPath);
            const current = fileState.ioPack && fileState.ioPack.common && fileState.ioPack.common.installedFrom;
            fileReady = fileState.changed || isNpmInstalledFrom(current);
        } catch (e) {
            fileState = null;
        }

        if (cli && fileState && fileState.ioPack) {
            const adapterObject = getObject(cli, root, `system.adapter.${ADAPTER_NAME}`);
            if (!adapterObject) {
                objectReady = false;
            } else if (isNpmInstalledFrom(adapterObject.common && adapterObject.common.installedFrom)) {
                objectReady = true;
            } else {
                objectReady = extendObject(cli, root, `system.adapter.${ADAPTER_NAME}`, {
                    common: { installedFrom: fileState.installedFrom },
                });
            }

            const active = activeRepoNames(getObject(cli, root, 'system.config', 'common.activeRepo'));
            const entry = catalogEntryFromIoPack(fileState.ioPack, fileState.version);
            catalogReady = active.length > 0;
            for (const repoName of active) {
                if (!catalogIsLoaded(cli, root, repoName)) {
                    catalogReady = false;
                    continue;
                }
                if (catalogVersion(cli, root, repoName) === entry.version) {
                    continue;
                }
                const patched = extendObject(cli, root, 'system.repositories', {
                    native: {
                        repositories: {
                            [repoName]: { json: { [ADAPTER_NAME]: entry } },
                        },
                    },
                });
                if (!patched) {
                    catalogReady = false;
                }
            }
        }

        if (fileReady && objectReady && catalogReady && Date.now() - started > 8000) {
            stable += 1;
            if (stable >= 2) {
                return;
            }
        } else {
            stable = 0;
        }
        await sleep(INTERVAL_MS);
    }
}

if (require.main === module) {
    correctAdapterCard()
        .catch(() => {})
        .then(() => process.exit(0));
}

module.exports = {
    parseCliJson,
    correctAdapterCard,
};
