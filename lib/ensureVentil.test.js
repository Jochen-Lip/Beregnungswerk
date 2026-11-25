'use strict';

const { expect } = require('chai');
const C = require('./constants');
const { buildVentilBundle } = require('./stateDefinitions');
const { resolveVentilRows } = require('./configSync');
const { resolveVentilCount, buildAktuellesVentilStates } = require('./resolveVentilCount');

const { deleteVentilByNr } = require('./ensureAdapterStates');
const { buildVentilTableFromDp, discoverVentilNumbers, resolveInstallVentilNumbers } = require('./configSync');

describe('ensureVentil / buildVentilBundle', () => {
    it('buildVentilBundle liefert Konfig, Steuerung, Messwerte, Schwelle, Test und Schleife', () => {
        const P = C.buildPaths('beregnungswerk.0');
        const states = buildVentilBundle(P, 5);
        const ids = states.map((s) => s.id);

        expect(ids).to.include('beregnungswerk.0.Ventil5.Konfig.Bewaesserungsdauer');
        expect(ids).to.include('beregnungswerk.0.Ventil5.Steuerung.Ventil5_AusAn');
        expect(ids).to.include('beregnungswerk.0.Ventil5.Messwerte.FeuchtigkeitAnzeige');
        expect(ids).to.include('beregnungswerk.0.Ventil5.Schwelle.FeuchtigkeitAktiv');
        expect(ids).to.include('beregnungswerk.0.Test.Ventil5');
        expect(ids).to.include('beregnungswerk.0.SchleifenSteuerung.Ventil5');
        expect(states.length).to.equal(26);
    });

    it('resolveVentilCount nutzt events.length und existingMax', () => {
        expect(resolveVentilCount({ events: [{}, {}, {}, {}, {}] }, 3)).to.equal(5);
        expect(resolveVentilCount({ events: [{}] }, 0)).to.equal(1);
        expect(resolveVentilCount({ events: [{}, {}, {}, {}, {}, {}] }, 0)).to.equal(6);
        expect(resolveVentilCount({ events: [{}], ventile: [{}, {}, {}, {}] }, 0)).to.equal(1);
        expect(resolveVentilCount({}, 7)).to.equal(7);
        expect(resolveVentilCount({}, 0)).to.equal(C.VENTIL_ANZAHL_DEFAULT);
    });

    it('buildAktuellesVentilStates skaliert mit Anzahl', () => {
        expect(buildAktuellesVentilStates(5)).to.deep.equal({
            0: '–',
            1: 'Ventil1',
            2: 'Ventil2',
            3: 'Ventil3',
            4: 'Ventil4',
            5: 'Ventil5',
        });
    });

    it('resolveVentilRows begrenzt nicht mehr auf 4 Zeilen', () => {
        const rows = resolveVentilRows({
            events: [{ enabled: false }, {}, {}, {}, {}],
            ventile: [],
        });
        expect(rows.length).to.equal(5);
    });

    it('deleteVentilByNr entfernt Ventil-Kanal, Unterkanäle und zugehörige States', async () => {
        const deleted = [];
        const objects = {
            'Ventil3.Konfig.Bewaesserungsdauer': { type: 'state' },
            'Ventil3.Konfig.Ventil3Ausgang': { type: 'state' },
            'Ventil3.Konfig': { type: 'channel' },
            'Ventil3.Steuerung': { type: 'channel' },
            'Ventil3.Messwerte': { type: 'channel' },
            'Ventil3.Schwelle': { type: 'channel' },
            'Ventil3': { type: 'channel' },
            'SchleifenSteuerung.Ventil3': { type: 'state' },
            'Test.Ventil3': { type: 'state' },
        };
        const deleteMockId = (id, opts) => {
            deleted.push(id);
            delete objects[id];
            if (opts && opts.children) {
                Object.keys(objects).slice().forEach((key) => {
                    if (key === id || key.startsWith(`${id}.`)) {
                        deleted.push(key);
                        delete objects[key];
                    }
                });
            }
        };
        const adapter = {
            namespace: 'beregnungswerk.0',
            log: { info: () => {}, warn: () => {}, debug: () => {} },
            getObjectAsync: async (id) => objects[id] || null,
            delObjectAsync: async (id, opts) => {
                deleteMockId(id, opts);
            },
            delObject: (id, opts, cb) => {
                deleteMockId(id, opts);
                if (typeof cb === 'function') {
                    cb();
                }
            },
            getObjectListAsync: async () => Object.keys(objects),
        };

        const stats = await deleteVentilByNr(adapter, 3);

        expect(stats.deleted).to.be.greaterThan(0);
        expect(deleted).to.include('SchleifenSteuerung.Ventil3');
        expect(deleted).not.to.include('Test.Ventil3');
        expect(deleted).to.include('Ventil3');
        expect(objects['Ventil3']).to.equal(undefined);
        expect(objects['Ventil3.Konfig.Bewaesserungsdauer']).to.equal(undefined);
    });

    it('buildVentilTableFromDp erzeugt Zeilen Ventil1–4 aus vorhandenen Kanälen', async () => {
        const objects = {
            Ventil1: { type: 'channel' },
            Ventil2: { type: 'channel' },
            Ventil3: { type: 'channel' },
            Ventil4: { type: 'channel' },
            'Ventil2.Konfig.Ventil2Ausgang': { type: 'state' },
            'SchleifenSteuerung.Ventil2': { type: 'state' },
        };
        const states = {
            'Ventil2.Konfig.Ventil2Ausgang': { val: 'beregnungswerk.0.Ventil2' },
            'SchleifenSteuerung.Ventil2': { val: true },
        };
        const adapter = {
            namespace: 'beregnungswerk.0',
            getObjectAsync: async (id) => objects[id] || null,
            getStateAsync: async (id) => states[id] || { val: null },
            log: { debug: () => {} },
        };

        const numbers = await discoverVentilNumbers(adapter);
        expect(numbers).to.deep.equal([1, 2, 3, 4]);

        const built = await buildVentilTableFromDp(adapter);
        expect(built.events.length).to.equal(4);
        expect(built.events[0].sprinkleName).to.equal('Ventil1');
        expect(built.events[0].name).to.equal('beregnungswerk.0.Ventil1');
        expect(built.events[1].sprinkleName).to.equal('Ventil2');
        expect(built.events[1].name).to.equal('beregnungswerk.0.Ventil2');
        expect(built.events[1].enabled).to.equal(true);
    });

    it('buildVentilTableFromDp: Erstinstallation ohne Ventil-DPs → eine Zeile Ventil1', async () => {
        const adapter = {
            namespace: 'beregnungswerk.0',
            getObjectAsync: async () => null,
            getStateAsync: async () => ({ val: null }),
            log: { debug: () => {} },
        };

        expect(await resolveInstallVentilNumbers(adapter)).to.deep.equal([1]);

        const built = await buildVentilTableFromDp(adapter);
        expect(built.events.length).to.equal(1);
        expect(built.events[0].sprinkleName).to.equal('Ventil1');
        expect(built.events[0].name).to.equal('beregnungswerk.0.Ventil1');
    });
});
