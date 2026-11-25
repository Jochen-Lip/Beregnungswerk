'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');
const {
    plainVersion,
    npmInstalledFrom,
    catalogEntryFromIoPack,
    catalogNeedsPatch,
    catalogPatches,
    enforceInstalledFromFile,
    isInstalledPackageDir,
    publishAdapterCatalog,
} = require('./adapterCatalog');
const { parseCliJson } = require('./installCardWorker');

describe('adapterCatalog', () => {
    it('entfernt den GitHub-Zusatz aus der Version', () => {
        expect(plainVersion('0.2.0+main')).to.equal('0.2.0');
        expect(npmInstalledFrom('0.2.0+main')).to.equal('iobroker.beregnungswerk@0.2.0');
    });

    it('trägt nur einen echten Katalog nach, und nur wenn die Version fehlt', () => {
        const entry = catalogEntryFromIoPack({ common: { version: '0.2.0', news: {} } }, '0.2.0');
        expect(entry.version).to.equal('0.2.0');
        expect(catalogNeedsPatch(null, entry)).to.equal(false);
        expect(catalogNeedsPatch({ beregnungswerk: { version: '0.1.0' } }, entry)).to.equal(false);
        const catalog = { _repoInfo: { name: 'stable' }, admin: { version: '7.0.0' } };
        expect(catalogNeedsPatch(catalog, entry)).to.equal(true);
        catalog.beregnungswerk = { version: '0.2.0' };
        expect(catalogNeedsPatch(catalog, entry)).to.equal(false);
    });

    it('setzt die Kartenanzeige auf die normale Version', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-catalog-'));
        fs.writeFileSync(path.join(root, 'io-package.json'), `${JSON.stringify({
            common: {
                name: 'beregnungswerk',
                version: '0.2.0',
                installedFrom: 'Jochen-Lip/beregnungswerk#main',
                news: { '0.2.0': { de: 'Test' } },
            },
        }, null, 2)}\n`);
        const calls = [];
        const adapter = {
            name: 'beregnungswerk',
            version: '0.2.0+main',
            log: { info() {}, warn() {}, debug() {} },
            getForeignObjectAsync: async (id) => {
                if (id === 'system.adapter.beregnungswerk') {
                    return { common: { installedFrom: 'Jochen-Lip/beregnungswerk#main', version: '0.2.0' } };
                }
                if (id === 'system.config') {
                    return { common: { activeRepo: ['stable'] } };
                }
                if (id === 'system.repositories') {
                    return {
                        native: {
                            repositories: {
                                stable: { json: { _repoInfo: { name: 'stable' }, admin: { version: '7.0.0' } } },
                            },
                        },
                    };
                }
                return null;
            },
            extendForeignObjectAsync: async (id, patch) => {
                calls.push({ id, patch });
            },
            getObjectViewAsync: async () => ({ rows: [] }),
        };

        await publishAdapterCatalog(adapter, { packageRoot: root });

        const written = JSON.parse(fs.readFileSync(path.join(root, 'io-package.json'), 'utf8'));
        expect(written.common.installedFrom).to.equal('iobroker.beregnungswerk@0.2.0');
        expect(calls.some((call) => call.id === 'system.adapter.beregnungswerk'
            && call.patch.common.installedFrom === 'iobroker.beregnungswerk@0.2.0')).to.equal(true);
        const repoCall = calls.find((call) => call.id === 'system.repositories');
        expect(repoCall.patch.native.repositories.stable.json.beregnungswerk.version).to.equal('0.2.0');
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('ersetzt die GitHub-Quelle in io-package, sobald der Installer sie geschrieben hat', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-card-'));
        const ioPackPath = path.join(root, 'io-package.json');
        fs.writeFileSync(ioPackPath, `${JSON.stringify({
            common: {
                name: 'beregnungswerk',
                version: '0.2.0',
                installedFrom: 'Jochen-Lip/beregnungswerk#main',
            },
        }, null, 2)}\n`);
        const result = enforceInstalledFromFile(ioPackPath);
        const written = JSON.parse(fs.readFileSync(ioPackPath, 'utf8'));
        expect(result.changed).to.equal(true);
        expect(written.common.installedFrom).to.equal('iobroker.beregnungswerk@0.2.0');
        expect(enforceInstalledFromFile(ioPackPath).changed).to.equal(false);
        expect(isInstalledPackageDir(path.join(root, 'node_modules', 'iobroker.beregnungswerk'))).to.equal(true);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('trägt die Version nur in einen vorhandenen Katalog ein', () => {
        const entry = catalogEntryFromIoPack({ common: { version: '0.2.0' } }, '0.2.0');
        const repositories = {
            stable: { json: { _repoInfo: { name: 'stable' }, admin: { version: '7.0.0' } } },
            latest: { json: null },
        };
        const patch = catalogPatches(repositories, ['stable', 'latest'], entry);
        expect(Object.keys(patch)).to.deep.equal(['stable']);
        expect(patch.stable.json.beregnungswerk.version).to.equal('0.2.0');
        expect(parseCliJson('Hinweis\n{"common":{"activeRepo":["stable"]}}\n')).to.deep.equal({
            common: { activeRepo: ['stable'] },
        });
    });
});
