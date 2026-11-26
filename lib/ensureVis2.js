'use strict';

const fs = require('fs');
const path = require('path');

const VIS_INSTANZ = 'vis-2.0';
const PROJEKT = 'beregnungswerk';
const VIS_VERSION = 1;
/** Editor dieser Installation: Web-Adapter der gleichen ioBroker-Instanz, Projekt und Seite der Ansicht. */
const EDITOR_LINK = '%web_protocol%://%ip%:%web_port%/vis-2/edit.html?beregnungswerk#Uebersicht';
const ADMIN = path.join(__dirname, '..', 'admin');

const BILDER = [
    'sprinkler-weiss.gif',
    'sprinkler-still.png',
    'sprinkler-aus.png',
    'kreuz.png',
    'schalter-ein.png',
    'schalter-aus.png',
    'regen.png',
    'sonnenaufgang.png',
    'sonnenuntergang.png',
    'temperatur.png',
    'feuchtigkeit.png',
    'brunnenpumpe.png',
    'kies.png',
];

function dateiLesen(adapter, rel) {
    return new Promise((resolve, reject) => {
        adapter.readFile(VIS_INSTANZ, rel, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

function dateiSchreiben(adapter, rel, inhalt) {
    return new Promise((resolve, reject) => {
        adapter.writeFile(VIS_INSTANZ, rel, inhalt, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function visProjekt() {
    const seite = 'Uebersicht';
    return {
        ___settings: {
            scripts: '',
            folders: [],
            openedViews: [seite],
            beregnungswerkVis: String(VIS_VERSION),
        },
        [seite]: {
            name: seite,
            filterList: [],
            activeWidgets: [],
            settings: {
                style: { background_class: '', background: 'black' },
                theme: 'dark-hive',
                sizex: '',
                sizey: '',
                gridSize: '',
                snapType: null,
                useBackground: true,
                alwaysRender: false,
                navigationBar: false,
                navigation: false,
                navigationHideEntry: true,
                useAsDefault: true,
            },
            widgets: {
                w00001: {
                    tpl: 'tplHtml',
                    widgetSet: 'basic',
                    style: {
                        left: '0',
                        top: '0',
                        width: '100%',
                        height: '100%',
                        'z-index': '1',
                        position: 'absolute',
                        background: 'black',
                    },
                    data: {
                        name: 'Beregnungswerk',
                        'lc-font-size': '12px',
                        html: `<iframe src="/vis-2.0/${PROJEKT}/ansicht.html?v=${VIS_VERSION}" style="width:100%;height:100%;border:0;background:#000"></iframe>`,
                    },
                },
            },
        },
    };
}

async function markerLesen(adapter) {
    try {
        const roh = await dateiLesen(adapter, `${PROJEKT}/vis-meta.json`);
        const text = Buffer.isBuffer(roh) ? roh.toString('utf8') : String(roh || '');
        return JSON.parse(text);
    } catch (e) {
        return null;
    }
}

/**
 * Legt die Vis-2-Ansicht mit vier Ventilen an und bindet sie an beregnungswerk.0.
 * Eine schon vorhandene fremde Ansicht gleichen Namens bleibt unangetastet.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function ensureEditorLink(adapter) {
    const id = `system.adapter.${adapter.namespace}`;
    const obj = await adapter.getForeignObjectAsync(id).catch(() => null);
    const aktuell = obj && obj.common && obj.common.localLinks && obj.common.localLinks._default;
    if (aktuell && aktuell.link === EDITOR_LINK) return;
    await adapter.extendForeignObjectAsync(id, {
        common: {
            localLinks: {
                _default: {
                    link: EDITOR_LINK,
                    name: {
                        en: 'VIS-2 editor',
                        de: 'Vis-2 Editor',
                    },
                },
            },
        },
    });
    adapter.log.info('Instanz-Button öffnet den Vis-2-Editor dieser Installation');
}

async function ensureVis2Project(adapter) {
    await ensureEditorLink(adapter).catch((e) =>
        adapter.log.warn(`Vis-2-Editor-Link: ${e.message || e}`),
    );

    const vis = await adapter.getForeignObjectAsync(`system.adapter.${VIS_INSTANZ}`).catch(() => null);
    if (!vis) {
        adapter.log.info('Vis-2 ist nicht installiert – die Ansicht bleibt im Reiter Visualisierung');
        return { geschrieben: false, grund: 'kein-vis-2' };
    }

    const marker = await markerLesen(adapter);
    if (marker && Number(marker.version) >= VIS_VERSION) {
        adapter.log.debug('Vis-2-Ansicht ist bereits angebunden');
        return { geschrieben: false, grund: 'aktuell' };
    }

    if (!marker) {
        try {
            const vorhanden = await dateiLesen(adapter, `${PROJEKT}/vis-views.json`);
            const text = Buffer.isBuffer(vorhanden) ? vorhanden.toString('utf8') : String(vorhanden || '');
            if (text && text.indexOf('beregnungswerkVis') === -1) {
                adapter.log.warn(
                    `Vis-2-Projekt „${PROJEKT}“ existiert bereits und wird nicht überschrieben`,
                );
                return { geschrieben: false, grund: 'fremd' };
            }
        } catch (e) {
            // Projekt fehlt noch
        }
    }

    const ansicht = fs.readFileSync(path.join(ADMIN, 'vis-ansicht.html'));
    await dateiSchreiben(adapter, `${PROJEKT}/ansicht.html`, ansicht);
    for (let i = 0; i < BILDER.length; i += 1) {
        const name = BILDER[i];
        const inhalt = fs.readFileSync(path.join(ADMIN, 'vis-bilder', name));
        await dateiSchreiben(adapter, `${PROJEKT}/vis-bilder/${name}`, inhalt);
    }
    await dateiSchreiben(
        adapter,
        `${PROJEKT}/vis-views.json`,
        JSON.stringify(visProjekt()),
    );
    await dateiSchreiben(
        adapter,
        `${PROJEKT}/vis-user.css`,
        '',
    );
    await dateiSchreiben(
        adapter,
        `${PROJEKT}/vis-meta.json`,
        JSON.stringify({ version: VIS_VERSION, projekt: PROJEKT, ventile: 4 }),
    );
    adapter.log.info(
        'Vis-2-Ansicht angelegt: Projekt beregnungswerk, Seite Übersicht, vier Ventile, passt sich der Auflösung an',
    );
    return { geschrieben: true, grund: 'neu' };
}

module.exports = {
    ensureVis2Project,
    visProjekt,
    VIS_VERSION,
    PROJEKT,
};
