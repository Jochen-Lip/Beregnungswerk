'use strict';

const C = require('./constants');

const ADAPTER_DP_BASE = 'beregnungswerk.0';

const TEST = `${ADAPTER_DP_BASE}.Test`;

const SCHALTZEIT_ZEIT_EMPTY = '--:--';

function normalizeSchaltzeitZeit(val) {
    if (val === true || val === false) {
        return '';
    }
    const s = String(val ?? '').trim();
    if (!s || s === 'true' || s === 'false' || s === SCHALTZEIT_ZEIT_EMPTY) {
        return '';
    }
    const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!m) {
        return '';
    }
    const h = Math.min(23, Math.max(0, parseInt(m[1], 10) || 0));
    const mi = Math.min(59, Math.max(0, parseInt(m[2], 10) || 0));
    return `${h < 10 ? '0' : ''}${h}:${mi < 10 ? '0' : ''}${mi}`;
}

function isValidSchaltzeitZeit(val) {
    return /^(\d{2}):(\d{2})$/.test(normalizeSchaltzeitZeit(val));
}

function schaltzeitZeitEmptyDpValue() {
    return SCHALTZEIT_ZEIT_EMPTY;
}

function needsSchaltzeitZeitEmptyDpWrite(val) {
    if (val === true || val === false) {
        return true;
    }
    const s = String(val ?? '').trim();
    if (!s || s === 'true' || s === 'false') {
        return true;
    }
    if (s === SCHALTZEIT_ZEIT_EMPTY) {
        return false;
    }
    return !isValidSchaltzeitZeit(val);
}

/** Alte Werksdefaults aus io-package.json – nicht zurück auf DP schreiben. */
const LEGACY_FACTORY_SCHALTZEIT_ZEIT = Object.freeze({ 1: '06:00', 2: '18:00' });

function legacyFactorySchaltzeitZeit(slot) {
    return LEGACY_FACTORY_SCHALTZEIT_ZEIT[parseInt(slot, 10)] || '';
}

function isLegacyFactorySchaltzeitZeit(slot, zeit) {
    const legacy = legacyFactorySchaltzeitZeit(slot);
    return !!legacy && normalizeSchaltzeitZeit(zeit) === legacy;
}

function defaultVentilSprinkleName(nr) {
    return `Ventil${nr}`;
}

function defaultVentilObjectId(ns, nr) {
    return `${ns || ADAPTER_DP_BASE}.Test.Ventil${nr}`;
}

function bereinigeAusgangId(ns, nr, ausgang) {
    const id = String(ausgang || '').trim();
    const kanal = `${ns || ADAPTER_DP_BASE}.Ventil${nr}`;
    if (!id || id === kanal) return defaultVentilObjectId(ns, nr);
    return id;
}

/** Relativ zu beregnungswerk.0 – Config → Adapter-State */
function buildFlatMap() {
    const p = (suffix) => suffix;
    return [
        ['schleifeAktiv', p('SchleifenSteuerung.Aktiv')],
        ['ventilModus', p('SchleifenSteuerung.Aktiv')],
        ['saisonSommerVon', p('Steuerung.Saison.SommerVon')],
        ['saisonSommerBis', p('Steuerung.Saison.SommerBis')],
        ['saisonWinterVon', p('Steuerung.Saison.WinterVon')],
        ['saisonWinterBis', p('Steuerung.Saison.WinterBis')],
        ['schleifePauseZwischenSek', p('SchleifenSteuerung.PauseZwischenSek')],
        ['schleifeGesamtzeitMaxMin', p('SchleifenSteuerung.GesamtzeitMaxMin')],
        ['schleifeBrunnenpumpePauseSek', p('SchleifenSteuerung.BrunnenpumpePauseSek')],
        ['schleifeVentil1', p('SchleifenSteuerung.Ventil1')],
        ['schleifeVentil2', p('SchleifenSteuerung.Ventil2')],
        ['schleifeVentil3', p('SchleifenSteuerung.Ventil3')],
        ['schleifeVentil4', p('SchleifenSteuerung.Ventil4')],
        ['zsSchaltzeit1', p('Steuerung.Zeitschaltuhr.Schaltzeit1.Zeit')],
        ['zsSchaltzeit1Aktiv', p('Steuerung.Zeitschaltuhr.Schaltzeit1.Aktiv')],
        ['zsSchaltzeit1Astro', p('Steuerung.Zeitschaltuhr.Schaltzeit1.Astro')],
        ['zsSchaltzeit1AstroTyp', p('Steuerung.Zeitschaltuhr.Schaltzeit1.AstroTyp')],
        ['zsSchaltzeit1AstroOffset', p('Steuerung.Zeitschaltuhr.Schaltzeit1.AstroOffset')],
        ['zsSchaltzeit2', p('Steuerung.Zeitschaltuhr.Schaltzeit2.Zeit')],
        ['zsSchaltzeit2Aktiv', p('Steuerung.Zeitschaltuhr.Schaltzeit2.Aktiv')],
        ['zsSchaltzeit2Astro', p('Steuerung.Zeitschaltuhr.Schaltzeit2.Astro')],
        ['zsSchaltzeit2AstroTyp', p('Steuerung.Zeitschaltuhr.Schaltzeit2.AstroTyp')],
        ['zsSchaltzeit2AstroOffset', p('Steuerung.Zeitschaltuhr.Schaltzeit2.AstroOffset')],
        ['wetterAnbieter', p('Steuerung.Wetterdaten.Konfig.Wetter_Anbieter')],
        ['wetterOpenMeteoOrt', p('Steuerung.Wetterdaten.Konfig.OpenMeteoOrt')],
        ['wetterQuellpfadTemperatur', p('Steuerung.Wetterdaten.Konfig.Quellpfad_Temperatur')],
        ['wetterQuellpfadLuftfeuchtigkeit', p('Steuerung.Wetterdaten.Konfig.Quellpfad_Luftfeuchtigkeit')],
        ['wetterQuellpfadNiederschlagHeute', p('Steuerung.Wetterdaten.Konfig.Quellpfad_Niederschlag_Heute')],
        ['wetterQuellpfadNiederschlagMorgen', p('Steuerung.Wetterdaten.Konfig.Quellpfad_Niederschlag_Morgen')],
        ['wetterQuellpfadStandort', p('Steuerung.Wetterdaten.Konfig.Quellpfad_Standort')],
        ['wetterSchwelleFeuchtAktiv', p('Steuerung.Wetterdaten.Schwelle.FeuchtigkeitAktiv')],
        ['wetterSchwelleFeuchtWert', p('Steuerung.Wetterdaten.Schwelle.FeuchtigkeitWert')],
        ['wetterSchwelleTempAktiv', p('Steuerung.Wetterdaten.Schwelle.TemperaturAktiv')],
        ['wetterSchwelleTempWert', p('Steuerung.Wetterdaten.Schwelle.TemperaturWert')],
        ['wetterSchwelleRegenHeuteAktiv', p('Steuerung.Wetterdaten.Schwelle.NiederschlagHeuteAktiv')],
        ['wetterSchwelleRegenHeuteWert', p('Steuerung.Wetterdaten.Schwelle.NiederschlagHeuteWert')],
        ['wetterSchwelleRegenMorgenAktiv', p('Steuerung.Wetterdaten.Schwelle.NiederschlagMorgenAktiv')],
        ['wetterSchwelleRegenMorgenWert', p('Steuerung.Wetterdaten.Schwelle.NiederschlagMorgenWert')],
        ['tankUntenSoll', p('WassertankSteuerung.Anzeigen.Tank_unten_Soll')],
        ['tankObenSoll', p('WassertankSteuerung.Anzeigen.Tank_oben_Soll')],
        ['tankManuellPumpe', p('WassertankSteuerung.Konfig.ManuellPumpe')],
        ['tankPfadUnten', p('WassertankSteuerung.Konfig.Tank_Untere_Schalter')],
        ['tankPfadOben', p('WassertankSteuerung.Konfig.Tank_Obene_Schalter')],
        ['tankPfadIstwert', p('WassertankSteuerung.Konfig.Tank_Wert_Aktuel')],
        ['tankBrunnenpumpe', p('WassertankSteuerung.Konfig.Brunnenpumpe')],
        ['nachrichtenWhatsAppAktiv', p('Nachrichten.Konfig.WhatsApp_Aktiv')],
        ['nachrichtenWhatsAppInstanz', p('Nachrichten.Konfig.WhatsApp_Instanz')],
        ['nachrichtenTelegramAktiv', p('Nachrichten.Konfig.Telegram_Aktiv')],
        ['nachrichtenTelegramInstanz', p('Nachrichten.Konfig.Telegram_Instanz')],
        ['nachrichtenTelegramUser', p('Nachrichten.Konfig.Telegram_User')],
        ['nachrichtenTelegramChatId', p('Nachrichten.Konfig.Telegram_ChatId')],
        ['nachrichtenEmailAktiv', p('Nachrichten.Konfig.Email_Aktiv')],
        ['nachrichtenEmailInstanz', p('Nachrichten.Konfig.Email_Instanz')],
        ['nachrichtenEmailAdresse', p('Nachrichten.Konfig.Email_Adresse')],
        ['nachrichtenPushoverAktiv', p('Nachrichten.Konfig.Pushover_Aktiv')],
        ['nachrichtenPushoverInstanz', p('Nachrichten.Konfig.Pushover_Instanz')],
        ['nachrichtenStil', p('Nachrichten.Konfig.Stil')],
        ['nachrichtenWartenSekunden', p('Nachrichten.Konfig.WartenSekunden')],
        ['nachrichtenStill', p('Nachrichten.Konfig.Still')],
        ['nachrichtenNurFehler', p('Nachrichten.Konfig.NurFehler')],
        ['nachrichtenAnzeigeNaechster', p('Nachrichten.Konfig.Anzeige_Naechster')],
        ['nachrichtenAnzeigeAktuell', p('Nachrichten.Konfig.Anzeige_Aktuell')],
        ['nachrichtenAnzeigeStart', p('Nachrichten.Konfig.Anzeige_Start')],
        ['nachrichtenAnzeigeStopp', p('Nachrichten.Konfig.Anzeige_Stopp')],
        ['nachrichtenAnzeigeUhrzeit', p('Nachrichten.Konfig.Anzeige_Uhrzeit')],
        ['nachrichtenAnzeigeTank', p('Nachrichten.Konfig.Anzeige_Tank')],
        ['nachrichtenAnzeigeVentil1', p('Nachrichten.Konfig.Anzeige_Ventil1')],
        ['nachrichtenAnzeigeVentil2', p('Nachrichten.Konfig.Anzeige_Ventil2')],
        ['nachrichtenAnzeigeVentil3', p('Nachrichten.Konfig.Anzeige_Ventil3')],
        ['nachrichtenAnzeigeVentil4', p('Nachrichten.Konfig.Anzeige_Ventil4')],
        ['nachrichtenAnzeigeDauer', p('Nachrichten.Konfig.Anzeige_Dauer')],
        ['nachrichtenAnzeigeWiederholungen', p('Nachrichten.Konfig.Anzeige_Wiederholungen')],
        ['nachrichtenAnzeigeTankanzeige', p('Nachrichten.Konfig.Anzeige_Tankanzeige')],
        ['nachrichtenAnzeigePumpe', p('Nachrichten.Konfig.Anzeige_Pumpe')],
        ['nachrichtenAnzeigePause', p('Nachrichten.Konfig.Anzeige_Pause')],
        ['nachrichtenAnzeigeVentil', p('Nachrichten.Konfig.Anzeige_Ventil')],
        ['nachrichtenAnzeigeAstro', p('Nachrichten.Konfig.Anzeige_Astro')],
        ['nachrichtenAnzeigeSchaltzeit', p('Nachrichten.Konfig.Anzeige_Schaltzeit')],
        ['nachrichtenAnzeigeWartung', p('Nachrichten.Konfig.Anzeige_Wartung')],
        ['nachrichtenAnzeigeFreiAktiv', p('Nachrichten.Konfig.Anzeige_Frei_Aktiv')],
        ['nachrichtenAnzeigeFrei', p('Nachrichten.Konfig.Anzeige_Frei')],
        ['gartenNachtruheVon', p('GartenpumpeSteuerung.Konfig.NachtruheVon')],
        ['gartenNachtruheBis', p('GartenpumpeSteuerung.Konfig.NachtruheBis')],
        ['gartenNachtruheAktiv', p('GartenpumpeSteuerung.Konfig.NachtruheAktiv')],
        ['gartenPumpeAusgang', p('GartenpumpeSteuerung.Konfig.GartenpumpeAusgang')],
    ];
}

const VENTIL_FIELD_MAP = [
    ['dauer', 'Bewaesserungsdauer'],
    ['wiederholungen', 'Wiederholungen'],
    ['ausgang', 'Ventil'],
    ['feuchtSensor', 'FeuchtigkeitSensor'],
    ['tempSensor', 'Temperatursensor'],
];

const SCHWELLE_FIELD_MAP = [
    ['schwelleVergleich', 'Vergleich'],
    ['schwelleFeuchtAktiv', 'FeuchtigkeitAktiv'],
    ['schwelleFeuchtWert', 'FeuchtigkeitWert'],
    ['schwelleTempAktiv', 'TemperaturAktiv'],
    ['schwelleTempWert', 'TemperaturWert'],
];

/** events[]-Attribute → ventile[]-Schlüssel */
const EVENT_TO_VENTIL_MAP = [
    ['wateringDuration', 'dauer'],
    ['repetitions', 'wiederholungen'],
    ['name', 'ausgang'],
    ['feuchtSensor', 'feuchtSensor'],
    ['tempSensor', 'tempSensor'],
    ['schwelleVergleich', 'schwelleVergleich'],
    ['schwelleFeuchtAktiv', 'schwelleFeuchtAktiv'],
    ['schwelleFeuchtWert', 'schwelleFeuchtWert'],
    ['schwelleTempAktiv', 'schwelleTempAktiv'],
    ['schwelleTempWert', 'schwelleTempWert'],
];

function ventilAusgangKey(nr) {
    return `Ventil${nr}Ausgang`;
}

function mergeEventIntoVentilRow(eventRow, ventilRow) {
    const out = ventilRow && typeof ventilRow === 'object' ? { ...ventilRow } : {};
    if (!eventRow || typeof eventRow !== 'object') {
        return out;
    }
    for (let i = 0; i < EVENT_TO_VENTIL_MAP.length; i++) {
        const evKey = EVENT_TO_VENTIL_MAP[i][0];
        const ventilKey = EVENT_TO_VENTIL_MAP[i][1];
        if (eventRow[evKey] !== undefined && eventRow[evKey] !== null && eventRow[evKey] !== '') {
            out[ventilKey] = eventRow[evKey];
        } else if (eventRow[evKey] === false || eventRow[evKey] === 0) {
            out[ventilKey] = eventRow[evKey];
        }
    }
    if (eventRow.enabled != null) {
        out.inSchleife = !!eventRow.enabled;
    }
    return out;
}

function resolveVentilRows(config) {
    const c = config || {};
    const events = Array.isArray(c.events) ? c.events : [];
    const ventile = Array.isArray(c.ventile) ? c.ventile : [];
    if (events.length > 0) {
        const rows = [];
        for (let i = 0; i < events.length; i += 1) {
            rows.push(mergeEventIntoVentilRow(events[i], ventile[i]));
        }
        return rows;
    }
    return ventile;
}

async function syncVentilRow(adapter, row, nr) {
    let count = 0;
    if (!row || typeof row !== 'object') {
        return count;
    }
    const base = `Ventil${nr}.Konfig`;

    if (row.inSchleife !== undefined) {
        try {
            await adapter.setStateAsync(`SchleifenSteuerung.Ventil${nr}`, !!row.inSchleife, true);
            count++;
        } catch (e) {
            adapter.log.warn(`Config-Sync Schleife Ventil${nr}: ${e.message || e}`);
        }
        try {
            await adapter.setStateAsync(`${base}.Aktiviert`, !!row.inSchleife, true);
            count++;
        } catch (e) {
            adapter.log.warn(`Config-Sync Ventil${nr}.Konfig.Aktiviert: ${e.message || e}`);
        }
    }

    // Ausgang aus Tabelle (events.name) – übrige Ventil-Konfig/Schwellen via Admin-state-Widgets direkt auf DPs
    if (row.ausgang !== undefined) {
        const relId = `${base}.${ventilAusgangKey(nr)}`;
        const ausgang = bereinigeAusgangId(adapter.namespace, nr, row.ausgang);
        try {
            await adapter.setStateAsync(relId, ausgang, true);
            count++;
        } catch (e) {
            adapter.log.warn(`Config-Sync ${relId}: ${e.message || e}`);
        }
    }

    return count;
}

async function readStateVal(adapter, relId) {
    try {
        const st = await adapter.getStateAsync(relId);
        if (st && st.val !== undefined && st.val !== null) {
            return st.val;
        }
    } catch (e) {
        adapter.log.debug(`readStateVal ${relId}: ${e.message || e}`);
    }
    return undefined;
}

/** Schaltzeit1/2.Zeit: Werksdefaults 06:00/18:00 nie aus Config auf DP schreiben. */
async function shouldWriteConfigZeitToDp(adapter, slot, configZeit) {
    if (!isValidSchaltzeitZeit(configZeit) || isLegacyFactorySchaltzeitZeit(slot, configZeit)) {
        return false;
    }
    const dpZeit = normalizeSchaltzeitZeit(
        await readStateVal(adapter, C.schaltzeitFieldRel(slot, 'Zeit')),
    );
    return dpZeit !== configZeit;
}

/**
 * Entfernt 06:00/18:00 aus Schaltzeit1/2-Zeit-DPs und adapter.config (timeEvents, zsSchaltzeit*).
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {{ persist?: boolean }} [options]
 * @returns {Promise<number>}
 */
async function purgeLegacyFactorySchaltzeitZeit(adapter, options) {
    const persist = !!(options && options.persist);
    let count = 0;

    for (let slot = 1; slot <= 2; slot += 1) {
        const legacy = legacyFactorySchaltzeitZeit(slot);
        if (!legacy) {
            continue;
        }

        const relId = C.schaltzeitFieldRel(slot, 'Zeit');
        const dpZeit = normalizeSchaltzeitZeit(await readStateVal(adapter, relId));
        if (dpZeit === legacy) {
            try {
                await adapter.setStateAsync(relId, '', true);
                count += 1;
            } catch (e) {
                adapter.log.warn(`Legacy-Schaltzeit${slot} DP leeren: ${e.message || e}`);
            }
        }

        if (!adapter.config) {
            continue;
        }

        const key = `zsSchaltzeit${slot}`;
        if (normalizeSchaltzeitZeit(adapter.config[key]) === legacy) {
            adapter.config[key] = '';
            count += 1;
        }

        const rows = adapter.config.timeEvents;
        if (Array.isArray(rows) && rows[slot - 1] && typeof rows[slot - 1] === 'object') {
            if (normalizeSchaltzeitZeit(rows[slot - 1].zeit) === legacy) {
                rows[slot - 1].zeit = '';
                count += 1;
            }
        }
    }

    if (count > 0) {
        adapter.log.info(
            `Schaltzeit1/2: Legacy-Uhrzeiten 06:00/18:00 entfernt (${count} Eintrag/Einträge)`,
        );
        if (persist) {
            await persistSchaltzeitNativeConfig(adapter).catch((e) =>
                adapter.log.warn(`Legacy-Schaltzeit native speichern: ${e.message || e}`),
            );
        }
    }

    return count;
}

/**
 * Ermittelt vorhandene Ventil-Kanäle unter der Adapter-Instanz (Ventil1 … VentilN).
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @returns {Promise<number[]>}
 */
async function discoverVentilNumbers(adapter) {
    const found = new Set();
    for (let nr = 1; nr <= C.VENTIL_ANZAHL_MAX; nr += 1) {
        try {
            const top = await adapter.getObjectAsync(`Ventil${nr}`);
            if (top && (top.type === 'channel' || top.type === 'device')) {
                found.add(nr);
                continue;
            }
        } catch (e) {
            // Kanal fehlt
        }
        try {
            const probe = await adapter.getObjectAsync(`Ventil${nr}.Konfig.Bewaesserungsdauer`);
            if (probe) {
                found.add(nr);
            }
        } catch (e2) {
            // kein Ventil-DP
        }
    }
    return [...found].sort((a, b) => a - b);
}

/**
 * Ventil-Nummern für Erstinstallation / DP-Sync: vorhandene VentilX-DPs, sonst nur Ventil1.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @returns {Promise<number[]>}
 */
async function resolveInstallVentilNumbers(adapter) {
    const numbers = await discoverVentilNumbers(adapter);
    if (numbers.length) {
        return numbers;
    }
    return [C.VENTIL_INSTALL_ROWS > 0 ? C.VENTIL_INSTALL_ROWS : 1];
}

/**
 * Liest eine Tabellenzeile aus den DPs zu Ventil{nr}.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {number} nr
 * @param {number} slot Schleifen-Slot (Zeilenposition, 1-basiert)
 * @param {object} eventRow
 * @param {object} ventilRow
 */
async function enrichVentilRowFromDp(adapter, nr, slot, eventRow, ventilRow) {
    const ns = adapter.namespace;
    const base = `Ventil${nr}.Konfig`;
    const schwelleBase = `Ventil${nr}.Schwelle`;
    const outEvent = eventRow && typeof eventRow === 'object' ? { ...eventRow } : {};
    const outVentil = ventilRow && typeof ventilRow === 'object' ? { ...ventilRow } : {};

    outEvent.sprinkleName = outEvent.sprinkleName || defaultVentilSprinkleName(nr);
    outEvent.name = outEvent.name || defaultVentilObjectId(ns, nr);
    outVentil.ausgang = outVentil.ausgang || defaultVentilObjectId(ns, nr);

    const dauer = await readStateVal(adapter, `${base}.Bewaesserungsdauer`);
    if (dauer !== undefined) {
        outEvent.wateringDuration = dauer;
        outVentil.dauer = dauer;
    }
    const wdh = await readStateVal(adapter, `${base}.Wiederholungen`);
    if (wdh !== undefined) {
        outEvent.repetitions = wdh;
        outVentil.wiederholungen = wdh;
    }
    const ausgang = await readStateVal(adapter, `${base}.${ventilAusgangKey(nr)}`);
    if (ausgang !== undefined && String(ausgang).trim()) {
        outEvent.name = String(ausgang).trim();
        outVentil.ausgang = outEvent.name;
    }
    const feucht = await readStateVal(adapter, `${base}.FeuchtigkeitSensor`);
    if (feucht !== undefined) {
        outEvent.feuchtSensor = feucht;
        outVentil.feuchtSensor = feucht;
    }
    const temp = await readStateVal(adapter, `${base}.Temperatursensor`);
    if (temp !== undefined) {
        outEvent.tempSensor = temp;
        outVentil.tempSensor = temp;
    }

    for (let s = 0; s < SCHWELLE_FIELD_MAP.length; s += 1) {
        const cfgKey = SCHWELLE_FIELD_MAP[s][0];
        const suffix = SCHWELLE_FIELD_MAP[s][1];
        const val = await readStateVal(adapter, `${schwelleBase}.${suffix}`);
        if (val !== undefined) {
            outEvent[cfgKey] = val;
            outVentil[cfgKey] = val;
        }
    }

    const inSchleife = await readStateVal(adapter, `SchleifenSteuerung.Ventil${slot}`);
    if (inSchleife !== undefined) {
        outVentil.inSchleife = !!inSchleife;
        outEvent.enabled = !!inSchleife;
    }

    return { eventRow: outEvent, ventilRow: outVentil };
}

/**
 * Baut events[]/ventile[] aus vorhandenen Ventil-DPs (Quelle der Wahrheit nach Neustart).
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function buildVentilTableFromDp(adapter) {
    const ns = adapter.namespace;
    let numbers = await resolveInstallVentilNumbers(adapter);
    if (!numbers.length) {
        numbers = [1];
    }
    if (numbers.indexOf(1) < 0) {
        numbers.unshift(1);
        numbers.sort(function (a, b) {
            return a - b;
        });
    }

    const defaults = defaultVentile();
    const events = [];
    const ventile = [];

    for (let i = 0; i < numbers.length; i += 1) {
        const nr = numbers[i];
        const slot = i + 1;
        const defVentil = defaults[Math.min(i, defaults.length - 1)] || {};
        const seedEvent = {
            sprinkleName: defaultVentilSprinkleName(nr),
            name: defaultVentilObjectId(ns, nr),
            enabled: false,
        };
        const seedVentil = {
            ...defVentil,
            ausgang: defaultVentilObjectId(ns, nr),
        };
        const enriched = await enrichVentilRowFromDp(adapter, nr, slot, seedEvent, seedVentil);
        events.push(enriched.eventRow);
        ventile.push(enriched.ventilRow);
    }

    return { events, ventile, numbers };
}

/**
 * Schreibt events[]/ventile[] in die Adapter-Instanz (Admin-Tabelle).
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {object[]} events
 * @param {object[]} ventile
 */
async function writeAdapterNativeVentilConfig(adapter, events, ventile) {
    const instId = `system.adapter.${adapter.name}.${adapter.instance}`;
    const cur = await adapter.getObjectAsync(instId);
    if (!cur) {
        adapter.log.warn(`Instanz-Objekt ${instId} nicht gefunden – Ventil-Tabelle nicht in Admin geschrieben`);
        return false;
    }
    const native = Object.assign({}, cur.native || {}, { events, ventile });
    await adapter.extendObjectAsync(instId, { native });
    adapter.config.events = events;
    adapter.config.ventile = ventile;
    return true;
}

/**
 * Nach Adapter-Start: alle Ventil-DPs → Admin-Tabelle (native events/ventile).
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function syncVentilTableFromDp(adapter) {
    const built = await buildVentilTableFromDp(adapter);
    await writeAdapterNativeVentilConfig(adapter, built.events, built.ventile);
    adapter.log.info(
        `Ventil-Tabelle aus DPs: ${built.events.length} Zeile(n)` +
        (built.numbers.length ? ` [Ventil ${built.numbers.join(', ')}]` : ''),
    );
    return {
        events: built.events,
        ventile: built.ventile,
        numbers: built.numbers,
        count: built.events.length,
    };
}

function parseVentilNrFromConfigName(name) {
    const s = String(name || '').trim();
    const m = s.match(/(?:^|\.)Ventil(\d+)$/i);
    if (m) {
        return parseInt(m[1], 10);
    }
    const bare = s.match(/^(\d+)$/);
    if (bare) {
        const n = parseInt(bare[1], 10);
        if (n >= 1 && n <= C.VENTIL_ANZAHL_MAX) {
            return n;
        }
    }
    return 0;
}

/**
 * Ventil-Nummern aus gespeicherter Admin-Tabelle (native.events).
 * Zeile 1 → Ventil1 bleibt immer erhalten.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @returns {Set<number>}
 */
function collectVentilNrsFromConfigEvents(adapter) {
    const events = Array.isArray(adapter.config?.events) ? adapter.config.events : [];
    const keep = new Set();
    for (let idx = 0; idx < events.length; idx += 1) {
        keep.add(idx + 1);
    }
    return keep;
}

/**
 * Aktive Ventil-Nummern: gespeicherte Tab-Zeilen (events[]) haben Vorrang, sonst vorhandene DPs.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @returns {Promise<number[]>}
 */
async function resolveVentilNumbersForAdapter(adapter) {
    const events = adapter.config?.events;
    if (Array.isArray(events) && events.length > 0) {
        return [...collectVentilNrsFromConfigEvents(adapter)].sort((a, b) => a - b);
    }
    return resolveInstallVentilNumbers(adapter);
}

/**
 * Legt für jede Tab-Zeile (events[]) den zugehörigen Ventil-DP-Kanal an.
 * Tab-Zeile N → VentilN (wie syncVentilRow).
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function ensureVentilsFromConfigEvents(adapter) {
    const { ensureVentilByNr } = require('./ensureAdapterStates');
    const keep = collectVentilNrsFromConfigEvents(adapter);
    const sorted = [...keep].sort((a, b) => a - b);
    let ensured = 0;

    for (let i = 0; i < sorted.length; i += 1) {
        const nr = sorted[i];
        try {
            await ensureVentilByNr(adapter, nr);
            ensured += 1;
        } catch (e) {
            adapter.log.warn(`ensureVentilsFromConfig Ventil${nr}: ${e.message || e}`);
        }
    }

    if (sorted.length > 0) {
        adapter.log.info(
            `Tab-Sync: ${sorted.length} Ventil-DP(s) für ${eventsCount(adapter)} Tab-Zeile(n) ` +
            `[Ventil ${sorted.join(', ')}]`,
        );
    }

    return { ensured, numbers: sorted };
}

function eventsCount(adapter) {
    const events = Array.isArray(adapter.config?.events) ? adapter.config.events : [];
    return events.length;
}

function timeEventsCount(adapter) {
    const rows = Array.isArray(adapter.config?.timeEvents) ? adapter.config.timeEvents : [];
    return rows.length;
}

/**
 * Schaltzeit-Nummern aus gespeicherter Admin-Tabelle (native.timeEvents).
 * Zeile N → SchaltzeitN.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @returns {Set<number>}
 */
function collectSchaltzeitNrsFromConfigTimeEvents(adapter) {
    const rows = Array.isArray(adapter.config?.timeEvents) ? adapter.config.timeEvents : [];
    const keep = new Set();
    for (let idx = 0; idx < rows.length; idx += 1) {
        keep.add(idx + 1);
    }
    return keep;
}

/**
 * Legt für jede Tab-2-Zeile (timeEvents[]) die Schaltzeit-DPs an.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function ensureSchaltzeitenFromConfigTimeEvents(adapter) {
    const { ensureSchaltzeitByNr } = require('./ensureAdapterStates');
    const keep = collectSchaltzeitNrsFromConfigTimeEvents(adapter);
    const sorted = [...keep].sort((a, b) => a - b);
    let ensured = 0;

    for (let i = 0; i < sorted.length; i += 1) {
        const nr = sorted[i];
        try {
            await ensureSchaltzeitByNr(adapter, nr);
            ensured += 1;
        } catch (e) {
            adapter.log.warn(`ensureSchaltzeiten Schaltzeit${nr}: ${e.message || e}`);
        }
    }

    if (sorted.length > 0) {
        adapter.log.info(
            `Tab-Sync: ${sorted.length} Schaltzeit-DP(s) für ${timeEventsCount(adapter)} Tab-Zeile(n) ` +
            `[Schaltzeit ${sorted.join(', ')}]`,
        );
    }

    return { ensured, numbers: sorted };
}

/**
 * Entfernt Schaltzeit-DPs, die in der gespeicherten Tab-2-Konfiguration (timeEvents[]) nicht mehr vorkommen.
 * Zeile N → SchaltzeitN; Schaltzeit1 bleibt solange mindestens eine Tab-Zeile existiert.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function pruneOrphanSchaltzeitDpsFromConfig(adapter) {
    const { deleteSchaltzeitByNr } = require('./ensureAdapterStates');
    const keep = collectSchaltzeitNrsFromConfigTimeEvents(adapter);
    const existing = await discoverSchaltzeitNumbers(adapter);
    let pruned = 0;
    const removed = [];

    for (let i = 0; i < existing.length; i += 1) {
        const nr = existing[i];
        if (keep.has(nr)) {
            continue;
        }
        try {
            await deleteSchaltzeitByNr(adapter, nr);
            pruned += 1;
            removed.push(nr);
        } catch (e) {
            adapter.log.warn(`pruneOrphanSchaltzeit Schaltzeit${nr}: ${e.message || e}`);
        }
    }

    if (pruned > 0) {
        adapter.log.info(
            `Tab-Sync: ${pruned} Schaltzeit-DP(s) entfernt [Schaltzeit ${removed.join(', ')}] – ` +
            `behalten: Schaltzeit ${[...keep].sort((a, b) => a - b).join(', ')}`,
        );
    }

    return { kept: [...keep], pruned, removed, existing };
}

/**
 * Kürzt native.ventile[] auf events[].length (verhindert Engine-Ventilanzahl > Tab-Zeilen).
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
function trimVentileConfigToEvents(adapter) {
    const events = adapter.config?.events;
    if (!Array.isArray(events) || !adapter.config) {
        return 0;
    }
    const ventile = Array.isArray(adapter.config.ventile) ? adapter.config.ventile : [];
    if (ventile.length <= events.length) {
        return 0;
    }
    adapter.config.ventile = ventile.slice(0, events.length);
    return ventile.length - events.length;
}

/**
 * Schreibt gekürztes native.ventile[] in die Instanz-Konfiguration (Admin-Anzeige).
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function persistTrimmedVentileConfig(adapter) {
    const trimmed = trimVentileConfigToEvents(adapter);
    if (trimmed <= 0) {
        return 0;
    }
    try {
        const instId = `system.adapter.${adapter.namespace}`;
        const inst = await adapter.getObjectAsync(instId);
        const native = { ...(inst?.common?.native || {}), ventile: adapter.config.ventile };
        await adapter.extendObjectAsync(instId, {
            common: {
                native,
            },
        });
        adapter.log.info(
            `Tab-Sync: native.ventile[] um ${trimmed} Eintrag/Einträge gekürzt (=${eventsCount(adapter)} Zeile(n))`,
        );
    } catch (e) {
        adapter.log.warn(`ventile[] speichern: ${e.message || e}`);
    }
    return trimmed;
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {number[]} removed
 */
async function clearOrphanNativeVentilFlags(adapter, removed) {
    if (!removed.length || !adapter.config) {
        return;
    }
    const instId = `system.adapter.${adapter.namespace}`;
    let instNative = null;
    let nativeChanged = false;

    for (let i = 0; i < removed.length; i += 1) {
        const nr = removed[i];
        const key = `schleifeVentil${nr}`;
        if (adapter.config[key] !== undefined) {
            adapter.config[key] = false;
            nativeChanged = true;
        }
        try {
            await adapter.setStateAsync(`SchleifenSteuerung.Ventil${nr}`, false, true);
        } catch (e) {
            adapter.log.debug(`SchleifenSteuerung.Ventil${nr} zurücksetzen: ${e.message || e}`);
        }
    }

    if (!nativeChanged) {
        return;
    }

    try {
        if (!instNative) {
            const inst = await adapter.getObjectAsync(instId);
            instNative = { ...(inst?.common?.native || {}) };
        }
        for (let j = 0; j < removed.length; j += 1) {
            const n = removed[j];
            const k = `schleifeVentil${n}`;
            if (instNative[k] !== undefined) {
                instNative[k] = false;
            }
        }
        await adapter.extendObjectAsync(instId, { common: { native: instNative } });
    } catch (e) {
        adapter.log.warn(`schleifeVentil-Flags speichern: ${e.message || e}`);
    }
}

/**
 * Entfernt Ventil-DPs, die in der gespeicherten Tab-Konfiguration nicht mehr vorkommen.
 * Ventil1 bleibt solange mindestens eine Tab-Zeile existiert.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function pruneOrphanVentilDpsFromConfig(adapter) {
    const { deleteVentilByNr } = require('./ensureAdapterStates');
    await persistTrimmedVentileConfig(adapter);
    const keep = collectVentilNrsFromConfigEvents(adapter);
    const existing = await discoverVentilNumbers(adapter);
    let pruned = 0;
    const removed = [];

    for (let i = 0; i < existing.length; i += 1) {
        const nr = existing[i];
        if (keep.has(nr)) {
            continue;
        }
        try {
            await deleteVentilByNr(adapter, nr);
            pruned += 1;
            removed.push(nr);
        } catch (e) {
            adapter.log.warn(`pruneOrphanVentil Ventil${nr}: ${e.message || e}`);
        }
    }

    if (pruned > 0) {
        adapter.log.info(
            `Tab-Sync: ${pruned} Ventil-DP(s) entfernt [Ventil ${removed.join(', ')}] – ` +
            `behalten: Ventil ${[...keep].sort((a, b) => a - b).join(', ')}`,
        );
        await clearOrphanNativeVentilFlags(adapter, removed);
    }

    return { kept: [...keep], pruned, removed, existing };
}

/** Liest Ventil-Konfiguration aus Datenpunkten → native events[]/ventile[] für Admin */
async function readVentilConfigFromDp(adapter) {
    const c = adapter.config || {};
    const events = Array.isArray(c.events) ? c.events.map((row) => ({ ...row })) : [];
    const ventile = Array.isArray(c.ventile) ? c.ventile.map((row) => ({ ...row })) : [];
    const rowCount = Math.max(events.length, ventile.length, 1);

    for (let i = 0; i < rowCount; i += 1) {
        const slotNr = i + 1;
        const nr = parseInt(events[i] && events[i]._nr, 10) || slotNr;
        if (nr < 1) {
            continue;
        }
        const base = `Ventil${nr}.Konfig`;
        const schwelleBase = `Ventil${nr}.Schwelle`;
        const eventRow = events[i] && typeof events[i] === 'object' ? events[i] : {};
        const ventilRow = ventile[i] && typeof ventile[i] === 'object' ? ventile[i] : {};

        const dauer = await readStateVal(adapter, `${base}.Bewaesserungsdauer`);
        if (dauer !== undefined) {
            eventRow.wateringDuration = dauer;
            ventilRow.dauer = dauer;
        }
        const wdh = await readStateVal(adapter, `${base}.Wiederholungen`);
        if (wdh !== undefined) {
            eventRow.repetitions = wdh;
            ventilRow.wiederholungen = wdh;
        }
        const ausgang = await readStateVal(adapter, `${base}.${ventilAusgangKey(nr)}`);
        if (ausgang !== undefined) {
            eventRow.name = ausgang;
            ventilRow.ausgang = ausgang;
        }
        const feucht = await readStateVal(adapter, `${base}.FeuchtigkeitSensor`);
        if (feucht !== undefined) {
            eventRow.feuchtSensor = feucht;
            ventilRow.feuchtSensor = feucht;
        }
        const temp = await readStateVal(adapter, `${base}.Temperatursensor`);
        if (temp !== undefined) {
            eventRow.tempSensor = temp;
            ventilRow.tempSensor = temp;
        }

        for (let s = 0; s < SCHWELLE_FIELD_MAP.length; s += 1) {
            const cfgKey = SCHWELLE_FIELD_MAP[s][0];
            const suffix = SCHWELLE_FIELD_MAP[s][1];
            const val = await readStateVal(adapter, `${schwelleBase}.${suffix}`);
            if (val !== undefined) {
                eventRow[cfgKey] = val;
                ventilRow[cfgKey] = val;
            }
        }

        const inSchleife = await readStateVal(adapter, `SchleifenSteuerung.Ventil${slotNr}`);
        if (inSchleife !== undefined) {
            ventilRow.inSchleife = !!inSchleife;
            eventRow.enabled = !!inSchleife;
        }

        events[i] = eventRow;
        ventile[i] = ventilRow;
    }

    return { events, ventile };
}

const ZS_TAG_SUFFIX = ['TagMo', 'TagDi', 'TagMi', 'TagDo', 'TagFr', 'TagSa', 'TagSo'];
const ZS_TAG_DEFAULTS = {
    TagMo: true,
    TagDi: true,
    TagMi: true,
    TagDo: true,
    TagFr: true,
    TagSa: false,
    TagSo: false,
};
const ZS_TAG_ALL_KEYS = [...ZS_TAG_SUFFIX, 'WeFeiertag'];

function defaultTimeEventWochentag(index) {
    const slot = Math.max(1, parseInt(index, 10) + 1 || 1);
    return `${ADAPTER_DP_BASE}.Steuerung.Zeitschaltuhr.Schaltzeit${slot}.TagMo`;
}

function parseTagKeyFromWochentagPath(path) {
    const m = String(path || '').match(/\.(Tag(Mo|Di|Mi|Do|Fr|Sa|So))$/);
    if (!m) {
        return null;
    }
    return `zs${m[1]}`;
}

function isSchaltzeitTimeRowIndex(index) {
    return index >= 0;
}

function timeEventsRowForSlot(adapter, nr) {
    const rows = Array.isArray(adapter.config?.timeEvents) ? adapter.config.timeEvents : [];
    const row = rows[nr - 1];
    if (!row || typeof row !== 'object') {
        return null;
    }
    return row;
}

async function schaltzeitZeitDpExists(adapter, nr) {
    const n = parseInt(nr, 10);
    if (!Number.isFinite(n) || n < 1) {
        return false;
    }
    try {
        const grouped = await adapter.getObjectAsync(C.schaltzeitFieldRel(n, 'Zeit'));
        if (grouped && grouped.type === 'state') {
            return true;
        }
    } catch (e) {
        // kein Schaltzeit-Zeit-DP
    }
    try {
        const legacy = await adapter.getObjectAsync(C.schaltzeitLegacyFlatRel(n, 'Zeit'));
        if (legacy && legacy.type === 'state') {
            return true;
        }
    } catch (e2) {
        // kein Legacy-Schaltzeit-Zeit-DP
    }
    return false;
}

async function schaltzeitSlotExists(adapter, nr) {
    const n = parseInt(nr, 10);
    if (!Number.isFinite(n) || n < 1) {
        return false;
    }
    if (await schaltzeitZeitDpExists(adapter, n)) {
        return true;
    }
    try {
        if (await adapter.getObjectAsync(C.schaltzeitChannelRel(n))) {
            return true;
        }
    } catch (e) {
        // kein Schaltzeit-Kanal
    }
    return false;
}

/**
 * Schaltzeit-Nummern, für die ein Zeit-DP (…SchaltzeitN.Zeit oder Legacy …SchaltzeitN) existiert.
 * Steuert Tab-2-Zeilenanzahl.
 */
async function discoverSchaltzeitZeitNumbers(adapter) {
    const found = new Set();
    for (let nr = 1; nr <= C.SCHALTZEIT_ANZAHL_MAX; nr += 1) {
        if (await schaltzeitZeitDpExists(adapter, nr)) {
            found.add(nr);
        }
    }
    return [...found].sort((a, b) => a - b);
}

/**
 * Liest SchaltzeitN.Zeit vom DP, wenn der Zeit-DP vorhanden ist.
 * @returns {Promise<string|undefined>} normalisierte Zeit, '' wenn leer, undefined wenn kein Zeit-DP
 */
async function readSchaltzeitZeitFromDp(adapter, slot) {
    const n = parseInt(slot, 10);
    if (!Number.isFinite(n) || n < 1) {
        return undefined;
    }
    if (!(await schaltzeitZeitDpExists(adapter, n))) {
        return undefined;
    }
    let raw = await readStateVal(adapter, C.schaltzeitFieldRel(n, 'Zeit'));
    if (raw === undefined) {
        raw = await readStateVal(adapter, C.schaltzeitLegacyFlatRel(n, 'Zeit'));
    }
    if (raw === undefined) {
        return '';
    }
    return normalizeSchaltzeitZeit(raw);
}

async function discoverSchaltzeitNumbers(adapter) {
    const found = new Set();
    for (let nr = 1; nr <= C.SCHALTZEIT_ANZAHL_MAX; nr += 1) {
        try {
            const channel = await adapter.getObjectAsync(C.schaltzeitChannelRel(nr));
            if (channel) {
                found.add(nr);
                continue;
            }
        } catch (e) {
            // kein Schaltzeit-Kanal
        }
        try {
            const grouped = await adapter.getObjectAsync(C.schaltzeitFieldRel(nr, 'Zeit'));
            if (grouped) {
                found.add(nr);
                continue;
            }
        } catch (e) {
            // kein Schaltzeit-DP
        }
        try {
            const legacy = await adapter.getObjectAsync(C.schaltzeitLegacyFlatRel(nr, 'Zeit'));
            if (legacy && legacy.type === 'state') {
                found.add(nr);
                continue;
            }
        } catch (e2) {
            // kein Schaltzeit-DP
        }
        try {
            const aktiv = await adapter.getObjectAsync(C.schaltzeitLegacyFlatRel(nr, 'Aktiv'));
            if (aktiv) {
                found.add(nr);
            }
        } catch (e3) {
            // kein Schaltzeit-DP
        }
    }
    return [...found].sort((a, b) => a - b);
}

async function syncTimeEventsToAdapter(adapter) {
    const { ensureSchaltzeitByNr } = require('./ensureAdapterStates');
    const c = adapter.config || {};
    const rows = Array.isArray(c.timeEvents) ? c.timeEvents : [];
    let count = 0;

    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (!row || typeof row !== 'object') {
            continue;
        }
        const slot = i + 1;
        if (isSchaltzeitTimeRowIndex(i)) {
            try {
                await ensureSchaltzeitByNr(adapter, slot);
            } catch (e) {
                adapter.log.warn(`Config-Sync ensure Schaltzeit${slot}: ${e.message || e}`);
            }
            if (row.enabled !== undefined) {
                try {
                    await adapter.setStateAsync(
                        C.schaltzeitFieldRel(slot, 'Aktiv'),
                        !!row.enabled,
                        true,
                    );
                    count += 1;
                } catch (e) {
                    adapter.log.warn(`Config-Sync Schaltzeit${slot}Aktiv: ${e.message || e}`);
                }
            }
            if (row.astroEin !== undefined) {
                try {
                    await adapter.setStateAsync(
                        C.schaltzeitFieldRel(slot, 'Astro'),
                        !!row.astroEin,
                        true,
                    );
                    count += 1;
                } catch (e) {
                    adapter.log.warn(`Config-Sync Schaltzeit${slot}Astro: ${e.message || e}`);
                }
            }
            if (row.astroTyp !== undefined && row.astroTyp !== null && row.astroTyp !== '') {
                try {
                    await adapter.setStateAsync(
                        C.schaltzeitFieldRel(slot, 'AstroTyp'),
                        normalizeZsSchaltzeitConfigValue('AstroTyp', row.astroTyp),
                        true,
                    );
                    count += 1;
                } catch (e) {
                    adapter.log.warn(`Config-Sync Schaltzeit${slot}AstroTyp: ${e.message || e}`);
                }
            }
            if (row.astroOffset !== undefined && row.astroOffset !== null) {
                try {
                    await adapter.setStateAsync(
                        C.schaltzeitFieldRel(slot, 'AstroOffset'),
                        normalizeZsSchaltzeitConfigValue('AstroOffset', row.astroOffset),
                        true,
                    );
                    count += 1;
                } catch (e) {
                    adapter.log.warn(`Config-Sync Schaltzeit${slot}AstroOffset: ${e.message || e}`);
                }
            }
            for (let t = 0; t < ZS_TAG_ALL_KEYS.length; t += 1) {
                const tagKey = ZS_TAG_ALL_KEYS[t];
                if (row[tagKey] === undefined) {
                    continue;
                }
                try {
                    await adapter.setStateAsync(
                        C.schaltzeitFieldRel(slot, tagKey),
                        !!row[tagKey],
                        true,
                    );
                    count += 1;
                } catch (e) {
                    adapter.log.warn(`Config-Sync Schaltzeit${slot}${tagKey}: ${e.message || e}`);
                }
            }
            const configZeit = normalizeSchaltzeitZeit(row.zeit);
            if (await shouldWriteConfigZeitToDp(adapter, slot, configZeit)) {
                try {
                    await adapter.setStateAsync(
                        C.schaltzeitFieldRel(slot, 'Zeit'),
                        configZeit,
                        true,
                    );
                    count += 1;
                } catch (e) {
                    adapter.log.warn(`Config-Sync Schaltzeit${slot}: ${e.message || e}`);
                }
            } else if (!configZeit) {
                const dpZeit = await readStateVal(adapter, C.schaltzeitFieldRel(slot, 'Zeit'));
                if (needsSchaltzeitZeitEmptyDpWrite(dpZeit)) {
                    try {
                        await adapter.setStateAsync(
                            C.schaltzeitFieldRel(slot, 'Zeit'),
                            schaltzeitZeitEmptyDpValue(),
                            true,
                        );
                        count += 1;
                    } catch (e) {
                        adapter.log.warn(`Config-Sync Schaltzeit${slot} leer: ${e.message || e}`);
                    }
                }
            }
        }
    }

    return count;
}

async function buildTimeEventsFromDp(adapter, existingRows) {
    const rows = [];
    const configRows = Array.isArray(adapter.config?.timeEvents) ? adapter.config.timeEvents : [];
    const configCount = configRows.length;
    const discovered = await discoverSchaltzeitZeitNumbers(adapter);
    const discoveredMax = discovered.length > 0 ? Math.max(...discovered) : 0;
    const wanted = Math.max(
        configCount,
        discoveredMax,
        Array.isArray(existingRows) ? existingRows.length : 0,
        1,
    );

    for (let i = 0; i < wanted; i += 1) {
        const existing = (configCount > 0 ? configRows[i] : null)
            || (existingRows && existingRows[i] ? existingRows[i] : {});
        const slot = i + 1;
        const enabled = await readStateVal(adapter, C.schaltzeitFieldRel(slot, 'Aktiv'));
        const zeitFromDp = await readSchaltzeitZeitFromDp(adapter, slot);
        const astroEin = await readStateVal(adapter, C.schaltzeitFieldRel(slot, 'Astro'));
        const astroTyp = await readStateVal(adapter, C.schaltzeitFieldRel(slot, 'AstroTyp'));
        const astroOffset = await readStateVal(adapter, C.schaltzeitFieldRel(slot, 'AstroOffset'));
        const tagRow = {};
        for (let t = 0; t < ZS_TAG_ALL_KEYS.length; t += 1) {
            const tagKey = ZS_TAG_ALL_KEYS[t];
            const tagVal = await readStateVal(adapter, C.schaltzeitFieldRel(slot, tagKey));
            if (tagVal !== undefined) {
                tagRow[tagKey] = !!tagVal;
            } else if (existing[tagKey] !== undefined) {
                tagRow[tagKey] = !!existing[tagKey];
            } else if (tagKey === 'WeFeiertag') {
                tagRow[tagKey] = false;
            } else {
                tagRow[tagKey] = !!ZS_TAG_DEFAULTS[tagKey];
            }
        }
        rows.push({
            enabled: enabled !== undefined ? !!enabled : !!existing.enabled,
            zeit: zeitFromDp !== undefined
                ? zeitFromDp
                : normalizeSchaltzeitZeit(existing.zeit || ''),
            astroEin: astroEin !== undefined ? !!astroEin : !!existing.astroEin,
            astroTyp: astroTyp !== undefined
                ? normalizeZsSchaltzeitConfigValue('AstroTyp', astroTyp)
                : (existing.astroTyp || (slot === 2 ? 'sunset' : 'sunrise')),
            astroOffset: astroOffset !== undefined
                ? normalizeZsSchaltzeitConfigValue('AstroOffset', astroOffset)
                : (existing.astroOffset != null ? existing.astroOffset : 0),
            wochentag: existing.wochentag || '',
            ...tagRow,
        });
    }

    return rows;
}

async function syncTimeTableFromDp(adapter) {
    const existing = Array.isArray(adapter.config.timeEvents) ? adapter.config.timeEvents : [];
    const timeEvents = await buildTimeEventsFromDp(adapter, existing);
    if (adapter.config) {
        adapter.config.timeEvents = timeEvents;
    }
    return { timeEvents };
}

/**
 * Kürzt native.timeEvents[] auf die Tab-Zeilenanzahl.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {number} rowCount
 */
function trimTimeEventsConfigToRowCount(adapter, rowCount) {
    const wanted = Math.max(1, parseInt(rowCount, 10) || 1);
    if (!adapter.config) {
        return 0;
    }
    const rows = Array.isArray(adapter.config.timeEvents) ? adapter.config.timeEvents : [];
    if (rows.length <= wanted) {
        return 0;
    }
    const removed = rows.length - wanted;
    adapter.config.timeEvents = rows.slice(0, wanted);
    return removed;
}

/**
 * Entfernt zsSchaltzeit{N}* aus adapter.config für N > maxSlot (Standard-Config hat oft Schaltzeit2).
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {number} maxSlot
 */
function clearOrphanSchaltzeitConfigKeys(adapter, maxSlot) {
    const max = Math.max(1, parseInt(maxSlot, 10) || 1);
    if (!adapter.config) {
        return 0;
    }
    const suffixes = ['', 'Aktiv', 'Astro', 'AstroTyp', 'AstroOffset'];
    let cleared = 0;
    for (let nr = max + 1; nr <= C.SCHALTZEIT_ANZAHL_MAX; nr += 1) {
        for (let si = 0; si < suffixes.length; si += 1) {
            const suffix = suffixes[si];
            const key = suffix ? `zsSchaltzeit${nr}${suffix}` : `zsSchaltzeit${nr}`;
            if (adapter.config[key] !== undefined) {
                delete adapter.config[key];
                cleared += 1;
            }
        }
    }
    return cleared;
}

/**
 * Schreibt timeEvents + zsSchaltzeit* nach native (Admin-Instanz).
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function persistSchaltzeitNativeConfig(adapter) {
    if (!adapter.config) {
        return 0;
    }
    try {
        const instId = `system.adapter.${adapter.namespace}`;
        const inst = await adapter.getObjectAsync(instId);
        const native = { ...(inst?.common?.native || {}) };
        if (Array.isArray(adapter.config.timeEvents)) {
            native.timeEvents = adapter.config.timeEvents;
        }
        const suffixes = ['', 'Aktiv', 'Astro', 'AstroTyp', 'AstroOffset'];
        for (let nr = 1; nr <= C.SCHALTZEIT_ANZAHL_MAX; nr += 1) {
            for (let si = 0; si < suffixes.length; si += 1) {
                const suffix = suffixes[si];
                const key = suffix ? `zsSchaltzeit${nr}${suffix}` : `zsSchaltzeit${nr}`;
                if (adapter.config[key] !== undefined) {
                    native[key] = adapter.config[key];
                } else if (native[key] !== undefined) {
                    delete native[key];
                }
            }
        }
        await adapter.extendObjectAsync(instId, {
            common: {
                native,
            },
        });
        adapter.log.info(
            `Tab-Sync: native.timeEvents[] gespeichert (${timeEventsCount(adapter)} Zeile(n))`,
        );
        return 1;
    } catch (e) {
        adapter.log.warn(`Schaltzeit-native speichern: ${e.message || e}`);
    }
    return 0;
}

/**
 * Schreibt gekürztes native.timeEvents[] in die Instanz-Konfiguration.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function persistTrimmedTimeEventsConfig(adapter) {
    return persistSchaltzeitNativeConfig(adapter);
}

/**
 * Nach Tab-2-Zeilen-Löschung: Config kürzen und verwaiste Schaltzeit-DPs entfernen.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {number} rowCount
 */
async function afterTimeRowDelete(adapter, rowCount) {
    const trimmed = trimTimeEventsConfigToRowCount(adapter, rowCount);
    const cleared = clearOrphanSchaltzeitConfigKeys(adapter, rowCount);
    if (trimmed > 0 || cleared > 0) {
        await persistSchaltzeitNativeConfig(adapter);
    }
    const pruneStats = await pruneOrphanSchaltzeitDpsFromConfig(adapter);
    return {
        rowCount: timeEventsCount(adapter),
        trimmed,
        cleared,
        pruneStats,
    };
}

const ZS_SCHALTZEIT_CONFIG_SUFFIXES = new Set([
    'Aktiv',
    'Astro',
    'AstroTyp',
    'AstroOffset',
    'WeFeiertag',
    'Anzeige',
    ...ZS_TAG_SUFFIX,
]);

function zsSchaltzeitConfigFieldFromKey(tail) {
    if (!tail) {
        return 'Zeit';
    }
    if (ZS_SCHALTZEIT_CONFIG_SUFFIXES.has(tail)) {
        return tail;
    }
    return null;
}

function normalizeZsSchaltzeitConfigValue(field, val) {
    if (field === 'Zeit') {
        return normalizeSchaltzeitZeit(val);
    }
    if (field === 'AstroTyp') {
        return String(val == null ? '' : val).trim() || 'sunrise';
    }
    if (field === 'AstroOffset') {
        const n = parseInt(val, 10);
        return Number.isFinite(n) ? n : 0;
    }
    if (field === 'Anzeige') {
        return String(val == null ? '' : val);
    }
    if (field === 'Aktiv' || field === 'Astro' || field === 'WeFeiertag' || field.startsWith('Tag')) {
        return !!val;
    }
    return val;
}

/** zsSchaltzeit{N}* aus adapter.config → Schaltzeit-DPs (alle Tab-Zeilen). */
async function syncZsSchaltzeitConfigKeys(adapter) {
    const c = adapter.config || {};
    const activeSchaltzeit = collectSchaltzeitNrsFromConfigTimeEvents(adapter);
    let count = 0;

    for (const key of Object.keys(c)) {
        if (c[key] === undefined || c[key] === null) {
            continue;
        }
        const m = String(key).match(/^zsSchaltzeit(\d+)(.*)$/);
        if (!m) {
            continue;
        }
        const nr = parseInt(m[1], 10);
        if (!activeSchaltzeit.has(nr) || timeEventsRowForSlot(adapter, nr)) {
            continue;
        }
        const field = zsSchaltzeitConfigFieldFromKey(m[2]);
        if (!field) {
            continue;
        }
        const relId = C.schaltzeitFieldRel(nr, field);
        const val = normalizeZsSchaltzeitConfigValue(field, c[key]);
        if (field === 'Zeit') {
            if (isValidSchaltzeitZeit(val)) {
                if (!(await shouldWriteConfigZeitToDp(adapter, nr, val))) {
                    continue;
                }
            } else {
                const dpZeit = await readStateVal(adapter, relId);
                if (!needsSchaltzeitZeitEmptyDpWrite(dpZeit)) {
                    continue;
                }
                val = schaltzeitZeitEmptyDpValue();
            }
        }
        try {
            await adapter.setStateAsync(relId, val, true);
            count += 1;
        } catch (e) {
            adapter.log.warn(`Config-Sync ${adapter.namespace}.${relId}: ${e.message || e}`);
        }
    }

    return count;
}

async function syncConfigToAdapter(adapter) {
    const c = adapter.config || {};
    const FLAT_MAP = buildFlatMap();
    const activeVentils = collectVentilNrsFromConfigEvents(adapter);
    const activeSchaltzeit = collectSchaltzeitNrsFromConfigTimeEvents(adapter);
    let count = 0;

    for (let i = 0; i < FLAT_MAP.length; i++) {
        const key = FLAT_MAP[i][0];
        const relId = FLAT_MAP[i][1];
        if (c[key] === undefined || c[key] === null) continue;
        if (key === 'schleifeAktiv' && typeof c.ventilModus === 'boolean') {
            continue;
        }
        const schleifeMatch = String(key).match(/^schleifeVentil(\d+)$/);
        if (schleifeMatch && !activeVentils.has(parseInt(schleifeMatch[1], 10))) {
            continue;
        }
        const zsMatch = String(key).match(/^zsSchaltzeit(\d+)(.*)$/);
        if (zsMatch && !activeSchaltzeit.has(parseInt(zsMatch[1], 10))) {
            continue;
        }
        if (zsMatch && timeEventsRowForSlot(adapter, parseInt(zsMatch[1], 10))) {
            continue;
        }
        let val = c[key];
        if (zsMatch) {
            const field = zsSchaltzeitConfigFieldFromKey(zsMatch[2]);
            if (field) {
                val = normalizeZsSchaltzeitConfigValue(field, val);
                if (field === 'Zeit') {
                    const slot = parseInt(zsMatch[1], 10);
                    if (isValidSchaltzeitZeit(val)) {
                        if (!(await shouldWriteConfigZeitToDp(adapter, slot, val))) {
                            continue;
                        }
                    } else {
                        const dpZeit = await readStateVal(adapter, relId);
                        if (!needsSchaltzeitZeitEmptyDpWrite(dpZeit)) {
                            continue;
                        }
                        val = schaltzeitZeitEmptyDpValue();
                    }
                }
            }
        }
        try {
            await adapter.setStateAsync(relId, val, true);
            count++;
        } catch (e) {
            adapter.log.warn(`Config-Sync ${adapter.namespace}.${relId}: ${e.message || e}`);
        }
    }

    const ventile = resolveVentilRows(c);
    for (let v = 0; v < ventile.length; v++) {
        count += await syncVentilRow(adapter, ventile[v], v + 1);
    }

    count += await syncTimeEventsToAdapter(adapter);
    count += await syncZsSchaltzeitConfigKeys(adapter);

    adapter.log.info(`Config → ${adapter.namespace}: ${count} Werte synchronisiert`);
    return count;
}

function defaultVentile() {
    const rows = [];
    const count = Math.max(C.VENTIL_INSTALL_ROWS, C.VENTIL_ANZAHL_DEFAULT);
    for (let n = 1; n <= count; n += 1) {
        rows.push({
            inSchleife: n === 1,
            dauer: 1,
            wiederholungen: 2,
            ausgang: defaultVentilObjectId(ADAPTER_DP_BASE, n),
            feuchtSensor: `${TEST}.luft`,
            tempSensor: `${TEST}.temp`,
            schwelleVergleich: false,
            schwelleFeuchtAktiv: false,
            schwelleFeuchtWert: 40,
            schwelleTempAktiv: false,
            schwelleTempWert: 25,
        });
    }
    return rows;
}

module.exports = {
    DP: ADAPTER_DP_BASE,
    TEST,
    syncConfigToAdapter,
    syncConfigToUserdata: syncConfigToAdapter,
    purgeLegacyFactorySchaltzeitZeit,
    readVentilConfigFromDp,
    syncVentilTableFromDp,
    syncTimeTableFromDp,
    syncTimeEventsToAdapter,
    syncZsSchaltzeitConfigKeys,
    buildTimeEventsFromDp,
    readSchaltzeitZeitFromDp,
    schaltzeitZeitDpExists,
    schaltzeitSlotExists,
    discoverSchaltzeitNumbers,
    discoverSchaltzeitZeitNumbers,
    buildVentilTableFromDp,
    pruneOrphanVentilDpsFromConfig,
    pruneOrphanSchaltzeitDpsFromConfig,
    ensureVentilsFromConfigEvents,
    ensureSchaltzeitenFromConfigTimeEvents,
    collectSchaltzeitNrsFromConfigTimeEvents,
    trimTimeEventsConfigToRowCount,
    persistTrimmedTimeEventsConfig,
    persistSchaltzeitNativeConfig,
    clearOrphanSchaltzeitConfigKeys,
    afterTimeRowDelete,
    collectVentilNrsFromConfigEvents,
    resolveVentilNumbersForAdapter,
    discoverVentilNumbers,
    resolveInstallVentilNumbers,
    defaultVentilSprinkleName,
    defaultVentilObjectId,
    defaultVentile,
    resolveVentilRows,
    EVENT_TO_VENTIL_MAP,
    SCHWELLE_FIELD_MAP,
};
