'use strict';

const fs = require('fs');
const path = require('path');

const ADAPTER_NAME = 'beregnungswerk';

function plainVersion(version) {
    const text = String(version || '').trim();
    const plus = text.indexOf('+');
    const plain = plus === -1 ? text : text.slice(0, plus);
    return plain || '0.0.0';
}

function npmInstalledFrom(version) {
    return `iobroker.${ADAPTER_NAME}@${plainVersion(version)}`;
}

function isNpmInstalledFrom(installedFrom) {
    return String(installedFrom || '').startsWith(`iobroker.${ADAPTER_NAME}@`);
}

function activeRepoNames(activeRepo) {
    if (Array.isArray(activeRepo)) {
        return activeRepo.filter(Boolean);
    }
    if (typeof activeRepo === 'string' && activeRepo) {
        return [activeRepo];
    }
    return ['stable'];
}

function catalogEntryFromIoPack(ioPack, version) {
    const common = (ioPack && ioPack.common) || {};
    const ver = plainVersion(version || common.version);
    const license = (common.licenseInformation && common.licenseInformation.license) || 'MIT';
    return {
        name: ADAPTER_NAME,
        version: ver,
        title: common.title || 'Beregnungswerk',
        titleLang: common.titleLang || { en: 'Beregnungswerk', de: 'Beregnungswerk' },
        desc: common.desc || {},
        news: common.news || {},
        authors: common.authors || [],
        keywords: common.keywords || [],
        license,
        licenseInformation: common.licenseInformation || { license: 'MIT', type: 'free' },
        platform: common.platform || 'Javascript/Node.js',
        icon: common.icon,
        extIcon: common.extIcon,
        readme: common.readme,
        type: common.type || 'garden',
        mode: common.mode || 'daemon',
        compact: common.compact === true,
        connectionType: common.connectionType || 'local',
        dataSource: common.dataSource || 'push',
        tier: common.tier,
        published: common.published || '2026-11-25T00:00:00.000Z',
    };
}

function isRealCatalog(json) {
    return !!(json && typeof json === 'object' && !Array.isArray(json) && (json._repoInfo || json.admin || json['js-controller']));
}

function catalogNeedsPatch(json, entry) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
        return false;
    }
    const current = json[ADAPTER_NAME];
    if (current) {
        return current.version !== entry.version;
    }
    return isRealCatalog(json);
}

function readIoPack(ioPackPath) {
    return JSON.parse(fs.readFileSync(ioPackPath, 'utf8'));
}

function writeNpmInstalledFrom(ioPackPath, ioPack, installedFrom) {
    if (!ioPack || !ioPack.common || !ioPack.common.installedFrom) {
        return false;
    }
    if (isNpmInstalledFrom(ioPack.common.installedFrom)) {
        return false;
    }
    const raw = fs.readFileSync(ioPackPath, 'utf8');
    const current = JSON.stringify(ioPack.common.installedFrom);
    const next = JSON.stringify(installedFrom);
    const key = `"installedFrom": ${current}`;
    if (raw.includes(key)) {
        fs.writeFileSync(ioPackPath, raw.replace(key, `"installedFrom": ${next}`));
    } else {
        ioPack.common.installedFrom = installedFrom;
        fs.writeFileSync(ioPackPath, `${JSON.stringify(ioPack, null, 2)}\n`);
    }
    return true;
}

function enforceInstalledFromFile(ioPackPath) {
    if (!ioPackPath || !fs.existsSync(ioPackPath)) {
        return { changed: false, installedFrom: '', version: '' };
    }
    const ioPack = readIoPack(ioPackPath);
    const version = plainVersion(ioPack && ioPack.common && ioPack.common.version);
    const installedFrom = npmInstalledFrom(version);
    const changed = writeNpmInstalledFrom(ioPackPath, ioPack, installedFrom);
    return { changed, installedFrom, version, ioPack };
}

function isInstalledPackageDir(packageDir) {
    return path.basename(path.dirname(path.resolve(packageDir))) === 'node_modules';
}

function findIoBrokerRoot(packageDir) {
    const root = path.resolve(packageDir, '..', '..');
    const marker = path.join(root, 'node_modules', 'iobroker.js-controller', 'package.json');
    if (fs.existsSync(marker) || fs.existsSync(path.join(root, 'iobroker.js'))) {
        return root;
    }
    return '';
}

function findControllerCli(root) {
    if (!root) {
        return '';
    }
    const candidates = [
        path.join(root, 'node_modules', 'iobroker.js-controller', 'iobroker.js'),
        path.join(root, 'iobroker.js'),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return '';
}

function catalogPatches(repositories, activeRepo, entry) {
    const patch = {};
    if (!repositories || typeof repositories !== 'object') {
        return patch;
    }
    for (const name of activeRepoNames(activeRepo)) {
        const repo = repositories[name];
        if (!repo || typeof repo === 'string' || !catalogNeedsPatch(repo.json, entry)) {
            continue;
        }
        patch[name] = { json: { [ADAPTER_NAME]: entry } };
    }
    return patch;
}

async function normalizeInstalledFrom(adapter, installedFrom, ioPackPath) {
    const adapterId = `system.adapter.${adapter.name || ADAPTER_NAME}`;
    const meta = await adapter.getForeignObjectAsync(adapterId);
    if (meta && meta.common && !isNpmInstalledFrom(meta.common.installedFrom)) {
        await adapter.extendForeignObjectAsync(adapterId, { common: { installedFrom } });
        adapter.log.info(`Installierte Version ohne GitHub-Zusatz: ${plainVersion(adapter.version)}`);
    }

    if (typeof adapter.getObjectViewAsync === 'function') {
        const view = await adapter.getObjectViewAsync('system', 'instance', {
            startkey: `${adapterId}.`,
            endkey: `${adapterId}.\u9999`,
        });
        for (const row of (view && view.rows) || []) {
            const inst = row && row.value;
            if (!inst || !inst._id || !inst.common || isNpmInstalledFrom(inst.common.installedFrom)) {
                continue;
            }
            await adapter.extendForeignObjectAsync(inst._id, { common: { installedFrom } });
        }
    }

    if (ioPackPath && fs.existsSync(ioPackPath)) {
        writeNpmInstalledFrom(ioPackPath, readIoPack(ioPackPath), installedFrom);
    }
}

async function registerInActiveRepositories(adapter, entry) {
    const config = await adapter.getForeignObjectAsync('system.config');
    const reposObj = await adapter.getForeignObjectAsync('system.repositories');
    const repositories = reposObj && reposObj.native && reposObj.native.repositories;
    if (!repositories) {
        return false;
    }
    const patch = catalogPatches(
        repositories,
        config && config.common && config.common.activeRepo,
        entry,
    );
    if (!Object.keys(patch).length) {
        return false;
    }
    await adapter.extendForeignObjectAsync('system.repositories', {
        native: { repositories: patch },
    });
    adapter.log.info(`Verfügbare Version ${entry.version} eingetragen`);
    return true;
}

let publishing = false;
let publishAgain = false;

async function publishAdapterCatalog(adapter, options) {
    if (publishing) {
        publishAgain = true;
        return;
    }
    publishing = true;
    try {
        do {
            publishAgain = false;
            const version = plainVersion(adapter && adapter.version);
            const installedFrom = npmInstalledFrom(version);
            const root = (options && options.packageRoot) || path.join(__dirname, '..');
            const ioPackPath = path.join(root, 'io-package.json');
            let ioPack = null;
            if (fs.existsSync(ioPackPath)) {
                ioPack = readIoPack(ioPackPath);
            }
            await normalizeInstalledFrom(adapter, installedFrom, ioPackPath);
            if (ioPack) {
                await registerInActiveRepositories(adapter, catalogEntryFromIoPack(ioPack, version));
            }
        } while (publishAgain);
    } finally {
        publishing = false;
    }
}

function watchAdapterCatalog(adapter) {
    if (!adapter || adapter._bwCatalogWatch) {
        return;
    }
    adapter._bwCatalogWatch = true;
    if (typeof adapter.subscribeForeignObjects === 'function') {
        adapter.subscribeForeignObjects('system.repositories');
    }
    adapter.on('objectChange', (id) => {
        if (id !== 'system.repositories') {
            return;
        }
        publishAdapterCatalog(adapter).catch((e) => {
            adapter.log.warn(`Adapterkarte: ${e.message || e}`);
        });
    });
}

module.exports = {
    ADAPTER_NAME,
    plainVersion,
    npmInstalledFrom,
    isNpmInstalledFrom,
    activeRepoNames,
    catalogEntryFromIoPack,
    catalogNeedsPatch,
    writeNpmInstalledFrom,
    enforceInstalledFromFile,
    isInstalledPackageDir,
    findIoBrokerRoot,
    findControllerCli,
    catalogPatches,
    publishAdapterCatalog,
    watchAdapterCatalog,
};
