'use strict';

const C = require('./constants');
const { LEGACY_TEST_DP_BASE } = C;
const { getEigeneStates, getCatalogSource, LEGACY_DP_BASE, ALT_DP_BASE } = require('./stateCatalog');
const { getStateDefinitions, buildVentilBundle, buildSchaltzeitBundle } = require('./stateDefinitions');
const { resolveVentilNumbersForAdapter, collectSchaltzeitNrsFromConfigTimeEvents } = require('./configSync');

/** ACL: Admin-Gruppe + JavaScript-Skripte dürfen lesen/schreiben (Schalter, Taster, Logik) */
const ROOT_ACL = {
    object: 1636,
    state: 1636,
    owner: 'system.user.admin',
    ownerGroup: 'system.group.administrator',
};

/** Haupt-Kanäle unter beregnungswerk.0 (Ventil-Kanäle dynamisch je nach Installation) */
const BASE_TOP_CHANNELS = [
    ['Steuerung', 'Steuerung'],
    ['SchleifenSteuerung', 'Schleifensteuerung'],
    ['WassertankSteuerung', 'Wassertank'],
    ['GartenpumpeSteuerung', 'Gartenpumpe'],
    ['Nachrichten', 'Nachrichten'],
    ['Test', 'Test (Hardware-Simulation)'],
];

/**
 * @param {string} relId
 * @param {Set<number>} ventilNumbers
 */
function shouldSkipVentilState(relId, ventilNumbers) {
    let m = String(relId || '').match(/^Ventil(\d+)(?:\.|$)/);
    if (m) {
        return !ventilNumbers.has(parseInt(m[1], 10));
    }
    m = String(relId || '').match(/^SchleifenSteuerung\.Ventil(\d+)$/);
    if (m) {
        return !ventilNumbers.has(parseInt(m[1], 10));
    }
    m = String(relId || '').match(/^Test\.Ventil(\d+)$/);
    if (m) {
        return false;
    }
    return false;
}

/**
 * @param {string} relId
 * @param {Set<number>} schaltzeitNumbers
 */
function shouldSkipSchaltzeitState(relId, schaltzeitNumbers) {
    let m = String(relId || '').match(/^Steuerung\.Zeitschaltuhr\.Schaltzeit(\d+)\./);
    if (m) {
        return !schaltzeitNumbers.has(parseInt(m[1], 10));
    }
    m = String(relId || '').match(/^Steuerung\.Zeitschaltuhr\.Schaltzeit(\d+)(?:$|[A-Z])/);
    if (m) {
        return !schaltzeitNumbers.has(parseInt(m[1], 10));
    }
    return false;
}

/**
 * @param {string} fullId
 * @param {string} adapterNs
 */
function toRelativeStateId(fullId, adapterNs) {
    const id = String(fullId || '').trim();
    const prefixes = [
        `${LEGACY_DP_BASE}.`,
        `${ALT_DP_BASE}.`,
        `${LEGACY_TEST_DP_BASE}.`,
        `${adapterNs}.`,
        'beregnungswerk.0.',
    ];
    for (let i = 0; i < prefixes.length; i++) {
        if (id.startsWith(prefixes[i])) {
            return id.slice(prefixes[i].length);
        }
    }
    return id;
}

/**
 * @param {object} common
 */
function sanitizeCommon(common) {
    let c;
    try {
        c = JSON.parse(JSON.stringify(common || {}));
    } catch (e) {
        c = {};
    }
    if (!c.name) c.name = 'Datenpunkt';
    if (!c.type) {
        if (typeof c.def === 'boolean') c.type = 'boolean';
        else if (typeof c.def === 'number') c.type = 'number';
        else c.type = 'string';
    }
    if (!c.role) {
        c.role = c.type === 'boolean' ? 'switch' : c.type === 'number' ? 'value' : 'text';
    }
    if (c.read === undefined) c.read = true;
    if (c.write === undefined) c.write = false;
    return c;
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {string} relativeId
 */
async function ensureParentChannels(adapter, relativeId) {
    const parts = String(relativeId || '').split('.');
    if (parts.length < 2) return;

    let current = parts[0];
    for (let i = 1; i < parts.length - 1; i++) {
        current = `${current}.${parts[i]}`;
        try {
            const existing = await adapter.getObjectAsync(current);
            if (existing) continue;
            await adapter.setObjectNotExistsAsync(current, {
                type: 'channel',
                common: { name: parts[i] },
                native: {},
            });
        } catch (e) {
            adapter.log.warn(`Kanal ${adapter.namespace}.${current}: ${e.message || e}`);
        }
    }
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {number[]} ventilNumbers
 */
async function ensureTopChannels(adapter, ventilNumbers) {
    for (let i = 0; i < BASE_TOP_CHANNELS.length; i += 1) {
        const [id, name] = BASE_TOP_CHANNELS[i];
        try {
            await adapter.setObjectNotExistsAsync(id, {
                type: 'channel',
                common: { name },
                native: {},
            });
        } catch (e) {
            adapter.log.warn(`Top-Kanal ${id}: ${e.message || e}`);
        }
    }
    for (let vi = 0; vi < ventilNumbers.length; vi += 1) {
        const nr = ventilNumbers[vi];
        const channelId = `Ventil${nr}`;
        try {
            await adapter.setObjectNotExistsAsync(channelId, {
                type: 'channel',
                common: { name: `Ventil ${nr}` },
                native: {},
            });
        } catch (e) {
            adapter.log.warn(`Top-Kanal ${channelId}: ${e.message || e}`);
        }
    }
}

/**
 * @param {object} existingCommon
 * @param {object} desiredCommon
 */
function stateCommonNeedsSync(existingCommon, desiredCommon) {
    const cur = existingCommon || {};
    const want = desiredCommon || {};
    if (cur.type !== want.type) return true;
    if (cur.role !== want.role) return true;
    if (cur.write !== want.write) return true;
    if (cur.read !== want.read) return true;
    if (want.name && cur.name !== want.name) return true;
    if (want.states && JSON.stringify(cur.states || {}) !== JSON.stringify(want.states)) return true;
    return false;
}

/**
 * Bestehende States mit Katalog abgleichen (z. B. string → boolean/switch).
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {string} relId
 * @param {object} s
 */
async function syncStateCommon(adapter, relId, s) {
    const desired = sanitizeCommon(s.common);
    const existing = await adapter.getObjectAsync(relId);
    if (!existing || existing.type !== 'state') return false;
    if (!stateCommonNeedsSync(existing.common, desired)) return false;

    await adapter.extendObjectAsync(relId, { common: desired });

    const st = await adapter.getStateAsync(relId);
    const typ = String(desired.type || '').toLowerCase();
    if (typ === 'boolean' && (st?.val === null || st?.val === undefined || st?.val === '')) {
        await adapter.setStateAsync(relId, !!s.val, true);
    }

    adapter.log.info(`Metadaten korrigiert: ${adapter.namespace}.${relId} → ${desired.type}/${desired.role}`);
    return true;
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {string} relId
 */
async function ensureRootAcl(adapter, relId) {
    try {
        await adapter.extendObjectAsync(relId, { acl: ROOT_ACL });
    } catch (e) {
        adapter.log.debug(`ACL ${adapter.namespace}.${relId}: ${e.message || e}`);
    }
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {string} relId
 * @param {object} s
 * @param {unknown} val
 */
async function createAdapterState(adapter, relId, s, val) {
    await ensureParentChannels(adapter, relId);

    const common = sanitizeCommon(s.common);
    await adapter.setObjectNotExistsAsync(relId, {
        type: 'state',
        common,
        native: {},
    });

    const obj = await adapter.getObjectAsync(relId);
    if (!obj || obj.type !== 'state') {
        throw new Error('Objekt nach setObjectNotExistsAsync nicht vorhanden');
    }

    await ensureRootAcl(adapter, relId);

    const cur = await adapter.getStateAsync(relId);
    if (!cur || cur.val === null || cur.val === undefined) {
        await adapter.setStateAsync(relId, val, true);
    }
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 */
async function ensureAdapterStates(adapter) {
    const ns = adapter.namespace;
    const ventilNumbers = await resolveVentilNumbersForAdapter(adapter);
    const ventilNumberSet = new Set(ventilNumbers);
    const schaltzeitKeep = collectSchaltzeitNrsFromConfigTimeEvents(adapter);

    await ensureTopChannels(adapter, ventilNumbers);

    let states;
    try {
        states = getEigeneStates();
        const testPrefix = `${ns}.Test.`;
        const known = new Set(states.map((s) => toRelativeStateId(s.id, ns)));
        for (const extra of getStateDefinitions(ns)) {
            if (!extra?.id || !String(extra.id).startsWith(testPrefix)) {
                continue;
            }
            const relId = toRelativeStateId(extra.id, ns);
            if (!relId || known.has(relId)) {
                continue;
            }
            states.push(extra);
            known.add(relId);
        }
        const P = C.buildPaths(ns);
        for (let tnr = 1; tnr <= C.TEST_VENTIL_ANZAHL; tnr += 1) {
            const testRel = `Test.Ventil${tnr}`;
            if (known.has(testRel)) {
                continue;
            }
            const bundle = buildVentilBundle(P, tnr);
            for (let bi = 0; bi < bundle.length; bi += 1) {
                const relId = toRelativeStateId(bundle[bi].id, ns);
                if (relId === testRel) {
                    states.push(bundle[bi]);
                    known.add(testRel);
                    break;
                }
            }
        }
        for (const extra of getStateDefinitions(ns)) {
            if (!extra?.id) {
                continue;
            }
            const relId = toRelativeStateId(extra.id, ns);
            if (!relId || known.has(relId)) {
                continue;
            }
            states.push(extra);
            known.add(relId);
        }
        adapter.log.info(
            `State-Katalog (${getCatalogSource()} + stateDefinitions): ${states.length} Definitionen`,
        );
    } catch (e) {
        adapter.log.error(`State-Katalog FEHLER: ${e.message || e}`);
        await adapter.setStateAsync('info.setupError', String(e.message || e), true);
        throw e;
    }

    let created = 0;
    let skipped = 0;
    let synced = 0;
    let failed = 0;
    let ignored = 0;

    adapter.log.info(`Beregnungswerk: lege Datenpunkte unter ${ns} an …`);

    for (let i = 0; i < states.length; i++) {
        const s = states[i];
        if (!s?.id) {
            ignored++;
            continue;
        }

        const relId = toRelativeStateId(s.id, ns);
        if (!relId || relId.includes('..')) {
            ignored++;
            if (ignored <= 3) {
                adapter.log.warn(`Ungültige State-ID übersprungen: ${s.id} → ${relId}`);
            }
            continue;
        }

        if (shouldSkipVentilState(relId, ventilNumberSet)) {
            ignored++;
            continue;
        }

        if (shouldSkipSchaltzeitState(relId, schaltzeitKeep)) {
            ignored++;
            continue;
        }

        try {
            const existing = await adapter.getObjectAsync(relId);
            if (existing && existing.type === 'state') {
                skipped++;
                if (await syncStateCommon(adapter, relId, s)) synced++;
                await ensureRootAcl(adapter, relId);
                continue;
            }

            let val = s.val;
            for (const legacyPrefix of [LEGACY_DP_BASE, ALT_DP_BASE]) {
                const legacyId = `${legacyPrefix}.${relId}`;
                try {
                    const legacyState = await adapter.getForeignStateAsync(legacyId);
                    if (legacyState && legacyState.val !== null && legacyState.val !== undefined) {
                        val = legacyState.val;
                        break;
                    }
                } catch (e) {
                    // kein Legacy-Wert
                }
            }

            await createAdapterState(adapter, relId, s, val);
            created++;

            if (created === 1) {
                adapter.log.info(`Erster DP angelegt: ${ns}.${relId}`);
            } else if (created % 50 === 0) {
                adapter.log.info(`… ${created} Datenpunkte unter ${ns} angelegt`);
            }
        } catch (e) {
            failed++;
            if (failed <= 10) {
                adapter.log.error(`${ns}.${relId}: ${e.message || e}`);
            }
        }
    }

    if (failed > 10) {
        adapter.log.error(`… und ${failed - 10} weitere Fehler beim Anlegen`);
    }

    const probeId = 'Steuerung.Status';
    const probeOk = !!(await adapter.getObjectAsync(probeId));
    if (!probeOk && created === 0) {
        adapter.log.error(
            `Prüfung fehlgeschlagen: ${ns}.${probeId} existiert nicht – ` +
            `created=${created}, skipped=${skipped}, failed=${failed}, ignored=${ignored}`,
        );
    }

    adapter.log.info(
        `Beregnungswerk ${ns}: ${created} neu, ${skipped} vorhanden` +
        (synced ? `, ${synced} Metadaten korrigiert` : '') +
        (failed ? `, ${failed} Fehler` : '') +
        (ignored ? `, ${ignored} ignoriert` : '') +
        ` / ${states.length} Definitionen`,
    );

    try {
        await migrateGlobalZeitschaltuhrTags(adapter, [...schaltzeitKeep]);
    } catch (eMigrate) {
        adapter.log.warn(`migrateGlobalZeitschaltuhrTags: ${eMigrate.message || eMigrate}`);
    }

    await adapter.setStateAsync('info.statesTotal', states.length, true);
    await adapter.setStateAsync('info.statesCreated', created, true);
    await adapter.setStateAsync('info.dataNamespace', ns, true);
    await adapter.setStateAsync(
        'info.setupError',
        created > 0 || skipped > 0 ? '' : `Keine DPs angelegt (Fehler: ${failed}, ignoriert: ${ignored})`,
        true,
    );

    return { created, skipped, failed, ignored, total: states.length, probeOk };
}

/**
 * Migriert globale Steuerung.Zeitschaltuhr.TagMo…TagSo nach Schaltzeit{N}.Tag* und entfernt die alten DPs.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {number[]} schaltzeitNrs
 */
async function migrateGlobalZeitschaltuhrTags(adapter, schaltzeitNrs) {
    const nrs = [...new Set((schaltzeitNrs || []).filter((n) => Number.isFinite(n) && n >= 1))];
    if (!nrs.length) {
        nrs.push(1);
    }

    const globalVals = {};
    let hadGlobal = false;
    for (let si = 0; si < C.ZS_TAG_SUFFIX.length; si += 1) {
        const suffix = C.ZS_TAG_SUFFIX[si];
        const rel = C.zeitschaltuhrGlobalTagRel(suffix);
        try {
            const obj = await adapter.getObjectAsync(rel);
            if (obj && obj.type === 'state') {
                hadGlobal = true;
                const st = await adapter.getStateAsync(rel);
                if (st && st.val !== undefined && st.val !== null) {
                    globalVals[suffix] = st.val;
                }
            }
        } catch (e) {
            // kein globaler Tag-DP
        }
    }

    for (let ni = 0; ni < nrs.length; ni += 1) {
        const nr = nrs[ni];
        await ensureSchaltzeitByNr(adapter, nr);
        if (!hadGlobal) {
            continue;
        }
        for (let si = 0; si < C.ZS_TAG_SUFFIX.length; si += 1) {
            const suffix = C.ZS_TAG_SUFFIX[si];
            if (globalVals[suffix] === undefined) {
                continue;
            }
            const tagRel = C.schaltzeitTagRel(nr, suffix);
            const v = globalVals[suffix] === true || globalVals[suffix] === 1 ||
                globalVals[suffix] === '1' || globalVals[suffix] === 'true' || globalVals[suffix] === 'TRUE';
            try {
                await adapter.setStateAsync(tagRel, v, true);
            } catch (e) {
                adapter.log.warn(`migrate ${tagRel}: ${e.message || e}`);
            }
        }
    }

    if (!hadGlobal) {
        return { migrated: false };
    }

    for (let si = 0; si < C.ZS_TAG_SUFFIX.length; si += 1) {
        const rel = C.zeitschaltuhrGlobalTagRel(C.ZS_TAG_SUFFIX[si]);
        try {
            const obj = await adapter.getObjectAsync(rel);
            if (obj) {
                await deleteObjectRel(adapter, rel);
            }
        } catch (e) {
            adapter.log.warn(`remove global ${rel}: ${e.message || e}`);
        }
    }

    adapter.log.info(`Globale TagMo…TagSo → SchaltzeitN.Tag* migriert (${nrs.join(', ')})`);
    return { migrated: true, slots: nrs };
}

/**
 * Legt Kanal Ventil{nr} inkl. Konfig, Steuerung, Messwerte, Schwelle und Schleifen-Toggle an.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {number|string} nr
 */
async function ensureVentilByNr(adapter, nr) {
    const n = parseInt(nr, 10);
    if (!Number.isFinite(n) || n < 1) {
        throw new Error(`Ungültige Ventil-Nr: ${nr}`);
    }

    const ns = adapter.namespace;
    const channelId = `Ventil${n}`;

    try {
        await adapter.setObjectNotExistsAsync(channelId, {
            type: 'channel',
            common: { name: `Ventil ${n}` },
            native: {},
        });
    } catch (e) {
        adapter.log.warn(`Top-Kanal ${channelId}: ${e.message || e}`);
    }

    const P = C.buildPaths(ns);
    const states = buildVentilBundle(P, n);
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < states.length; i++) {
        const s = states[i];
        if (!s?.id) {
            continue;
        }

        const relId = toRelativeStateId(s.id, ns);
        if (!relId || relId.includes('..')) {
            continue;
        }

        try {
            const existing = await adapter.getObjectAsync(relId);
            if (existing && existing.type === 'state') {
                skipped++;
                await syncStateCommon(adapter, relId, s);
                await ensureRootAcl(adapter, relId);
                continue;
            }

            await createAdapterState(adapter, relId, s, s.val);
            created++;
        } catch (e) {
            failed++;
            adapter.log.error(`${ns}.${relId}: ${e.message || e}`);
        }
    }

    adapter.log.info(
        `Ventil${n} unter ${ns}: ${created} neu, ${skipped} vorhanden` +
        (failed ? `, ${failed} Fehler` : ''),
    );

    const ausgangRel = `Ventil${n}.Konfig.Ventil${n}Ausgang`;
    const aktiviertRel = `Ventil${n}.Konfig.Aktiviert`;
    const defaultAusgang = `${ns}.Ventil${n}`;
    try {
        const cur = await adapter.getStateAsync(ausgangRel);
        const curVal = cur && cur.val != null ? String(cur.val).trim() : '';
        if (!curVal) {
            await adapter.setStateAsync(ausgangRel, defaultAusgang, true);
            adapter.log.info(`Ventil${n}: Standard-Ausgang ${defaultAusgang} gesetzt`);
        }
    } catch (e) {
        adapter.log.warn(`Ventil${n} Ausgang ${ausgangRel}: ${e.message || e}`);
    }
    try {
        const akt = await adapter.getStateAsync(aktiviertRel);
        if (!akt || akt.val === null || akt.val === undefined || akt.val === '') {
            await adapter.setStateAsync(aktiviertRel, false, true);
        }
    } catch (e) {
        adapter.log.warn(`Ventil${n} Aktiviert ${aktiviertRel}: ${e.message || e}`);
    }

    return { created, skipped, failed, nr: n };
}

/**
 * Kanal Steuerung.Zeitschaltuhr.Schaltzeit{nr} für Objektbaum-Gruppierung.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {number} nr
 */
async function ensureSchaltzeitChannel(adapter, nr) {
    const n = parseInt(nr, 10);
    const channelRel = C.schaltzeitChannelRel(n);
    await adapter.setObjectNotExistsAsync(channelRel, {
        type: 'channel',
        common: { name: `Schaltzeit ${n}` },
        native: {},
    });
}

/**
 * Entfernt verwaiste flache Schaltzeit-DPs nach Migration.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {number} nr
 */
async function cleanupLegacySchaltzeitFlat(adapter, nr) {
    const n = parseInt(nr, 10);
    for (let fi = 0; fi < C.SCHALTZEIT_STATE_FIELDS.length; fi += 1) {
        const field = C.SCHALTZEIT_STATE_FIELDS[fi];
        const oldRel = C.schaltzeitLegacyFlatRel(n, field);
        try {
            const obj = await adapter.getObjectAsync(oldRel);
            if (obj && obj.type === 'state') {
                await deleteObjectRel(adapter, oldRel);
            }
        } catch (e) {
            adapter.log.debug(`cleanupLegacy Schaltzeit${n} ${oldRel}: ${e.message || e}`);
        }
    }
}

/**
 * Migriert …SchaltzeitN / SchaltzeitNAktiv → …SchaltzeitN.Zeit / .Aktiv …
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {number|string} nr
 */
async function migrateSchaltzeitFlatToGrouped(adapter, nr) {
    const n = parseInt(nr, 10);
    const legacyZeit = C.schaltzeitLegacyFlatRel(n, 'Zeit');
    const groupedZeit = C.schaltzeitFieldRel(n, 'Zeit');
    const legacyObj = await adapter.getObjectAsync(legacyZeit);
    if (!legacyObj || legacyObj.type !== 'state') {
        return { migrated: false };
    }
    const groupedObj = await adapter.getObjectAsync(groupedZeit);
    if (groupedObj && groupedObj.type === 'state') {
        await cleanupLegacySchaltzeitFlat(adapter, n);
        return { migrated: false, cleaned: true };
    }

    const P = C.buildPaths(adapter.namespace);
    const defs = buildSchaltzeitBundle(P, n);
    const defByRel = {};
    for (let di = 0; di < defs.length; di += 1) {
        const rel = toRelativeStateId(defs[di].id, adapter.namespace);
        if (rel) {
            defByRel[rel] = defs[di];
        }
    }

    await ensureSchaltzeitChannel(adapter, n);

    for (let fi = 0; fi < C.SCHALTZEIT_STATE_FIELDS.length; fi += 1) {
        const field = C.SCHALTZEIT_STATE_FIELDS[fi];
        const oldRel = C.schaltzeitLegacyFlatRel(n, field);
        const newRel = C.schaltzeitFieldRel(n, field);
        const oldStateObj = await adapter.getObjectAsync(oldRel);
        if (!oldStateObj || oldStateObj.type !== 'state') {
            continue;
        }
        const def = defByRel[newRel];
        if (!def) {
            continue;
        }
        const st = await adapter.getStateAsync(oldRel);
        let val = def.val;
        if (st && st.val !== null && st.val !== undefined && st.val !== '') {
            val = st.val;
        }
        await createAdapterState(adapter, newRel, def, val);
        try {
            await deleteObjectRel(adapter, oldRel);
        } catch (e) {
            adapter.log.warn(`migrate Schaltzeit${n} ${oldRel}: ${e.message || e}`);
        }
    }

    adapter.log.info(`Schaltzeit${n}: flache DPs unter Kanal ${C.schaltzeitChannelRel(n)} gruppiert`);
    return { migrated: true, nr: n };
}

/**
 * Legt Steuerung.Zeitschaltuhr.Schaltzeit{nr} inkl. Aktiv/Astro-Felder an.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {number|string} nr
 */
async function ensureSchaltzeitByNr(adapter, nr) {
    const n = parseInt(nr, 10);
    if (!Number.isFinite(n) || n < 1) {
        throw new Error(`Ungültige Schaltzeit-Nr: ${nr}`);
    }

    await migrateSchaltzeitFlatToGrouped(adapter, n);
    await ensureSchaltzeitChannel(adapter, n);

    const ns = adapter.namespace;
    const P = C.buildPaths(ns);
    const states = buildSchaltzeitBundle(P, n);
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < states.length; i += 1) {
        const s = states[i];
        if (!s?.id) {
            continue;
        }

        const relId = toRelativeStateId(s.id, ns);
        if (!relId || relId.includes('..')) {
            continue;
        }

        try {
            await ensureParentChannels(adapter, relId);
            const existing = await adapter.getObjectAsync(relId);
            if (existing && existing.type === 'state') {
                skipped++;
                await syncStateCommon(adapter, relId, s);
                await ensureRootAcl(adapter, relId);
                continue;
            }

            await createAdapterState(adapter, relId, s, s.val);
            created++;
        } catch (e) {
            failed++;
            adapter.log.error(`${ns}.${relId}: ${e.message || e}`);
        }
    }

    adapter.log.info(
        `Schaltzeit${n} unter ${ns}: ${created} neu, ${skipped} vorhanden` +
        (failed ? `, ${failed} Fehler` : ''),
    );

    const zeitRel = C.schaltzeitFieldRel(n, 'Zeit');
    const aktivRel = C.schaltzeitFieldRel(n, 'Aktiv');
    try {
        const curZeit = await adapter.getStateAsync(zeitRel);
        const curVal = curZeit && curZeit.val != null ? String(curZeit.val).trim() : '';
        if (!curVal) {
            const defZeit = '';
            if (defZeit) {
                await adapter.setStateAsync(zeitRel, defZeit, true);
            }
        }
    } catch (e) {
        adapter.log.warn(`Schaltzeit${n} ${zeitRel}: ${e.message || e}`);
    }
    try {
        const akt = await adapter.getStateAsync(aktivRel);
        if (!akt || akt.val === null || akt.val === undefined || akt.val === '') {
            await adapter.setStateAsync(aktivRel, false, true);
        }
    } catch (e) {
        adapter.log.warn(`Schaltzeit${n} ${aktivRel}: ${e.message || e}`);
    }

    return { created, skipped, failed, nr: n };
}

/**
 * @param {string} ns
 * @param {number} nr
 * @returns {string[]}
 */
function collectSchaltzeitDeleteRelIds(ns, nr) {
    const n = parseInt(nr, 10);
    const ids = [C.schaltzeitChannelRel(n)];

    for (let fi = 0; fi < C.SCHALTZEIT_STATE_FIELDS.length; fi += 1) {
        const field = C.SCHALTZEIT_STATE_FIELDS[fi];
        ids.push(C.schaltzeitFieldRel(n, field));
        if (C.SCHALTZEIT_LEGACY_SUFFIX[field] !== undefined) {
            ids.push(C.schaltzeitLegacyFlatRel(n, field));
        }
    }

    return [...new Set(ids)].sort((a, b) => b.split('.').length - a.split('.').length);
}

/**
 * Entfernt alle Datenpunkte zu Schaltzeit{nr} inkl. TagMo…TagSo.
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {number|string} nr
 */
async function deleteSchaltzeitByNr(adapter, nr) {
    const n = parseInt(nr, 10);
    if (!Number.isFinite(n) || n < 1) {
        throw new Error(`Ungültige Schaltzeit-Nr: ${nr}`);
    }

    const ns = adapter.namespace;
    const channelRel = C.schaltzeitChannelRel(n);
    let relIds = collectSchaltzeitDeleteRelIds(ns, n);

    if (typeof adapter.getObjectListAsync === 'function') {
        try {
            const list = await adapter.getObjectListAsync();
            const pat = new RegExp(`^Steuerung\\.Zeitschaltuhr\\.Schaltzeit${n}(?:\\.|$|[A-Z])`);
            for (let li = 0; li < list.length; li += 1) {
                const id = list[li];
                if (pat.test(id)) {
                    relIds.push(id);
                }
            }
        } catch (e) {
            adapter.log.debug(`deleteSchaltzeit getObjectListAsync: ${e.message || e}`);
        }
    }

    relIds = [...new Set(relIds)].sort((a, b) => b.split('.').length - a.split('.').length);

    let deleted = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < relIds.length; i += 1) {
        const relId = relIds[i];
        try {
            const existing = await adapter.getObjectAsync(relId);
            if (!existing) {
                skipped += 1;
                continue;
            }
            await deleteObjectRel(adapter, relId);
            deleted += 1;
        } catch (e) {
            failed += 1;
            adapter.log.warn(`deleteSchaltzeit ${relId}: ${e.message || e}`);
        }
    }

    try {
        const channelLeft = await adapter.getObjectAsync(channelRel);
        if (channelLeft) {
            await deleteObjectRel(adapter, channelRel);
            deleted += 1;
        }
    } catch (e) {
        failed += 1;
        adapter.log.warn(`deleteSchaltzeit ${channelRel} (Nachprüfung): ${e.message || e}`);
    }

    adapter.log.info(
        `Schaltzeit${n} unter ${ns} entfernt: ${deleted} gelöscht, ${skipped} nicht vorhanden` +
        (failed ? `, ${failed} Fehler` : ''),
    );

    if (deleted === 0 && failed > 0) {
        throw new Error(`Schaltzeit${n}: kein Objekt gelöscht (${failed} Fehler)`);
    }

    return { deleted, skipped, failed, nr: n };
}

const VENTIL_SUB_CHANNELS = ['Konfig', 'Steuerung', 'Messwerte', 'Schwelle'];

/**
 * @param {string} ns
 * @param {number} nr
 * @returns {string[]}
 */
function collectVentilDeleteRelIds(ns, nr) {
    const n = parseInt(nr, 10);
    const P = C.buildPaths(ns);
    const states = buildVentilBundle(P, n);
    const ids = [];

    for (let i = 0; i < states.length; i += 1) {
        const rel = toRelativeStateId(states[i].id, ns);
        if (rel && !rel.includes('..') && !rel.startsWith('Test.Ventil')) {
            ids.push(rel);
        }
    }

    const top = `Ventil${n}`;
    for (let si = 0; si < VENTIL_SUB_CHANNELS.length; si += 1) {
        ids.push(`${top}.${VENTIL_SUB_CHANNELS[si]}`);
    }
    ids.push(top);

    return [...new Set(ids)].sort((a, b) => b.split('.').length - a.split('.').length);
}

/**
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {string} relId
 */
async function deleteObjectRel(adapter, relId) {
    const opts = { children: true };

    if (typeof adapter.delObjectAsync === 'function') {
        await adapter.delObjectAsync(relId, opts);
        return;
    }
    if (typeof adapter.delObject === 'function') {
        await new Promise((resolve, reject) => {
            adapter.delObject(relId, opts, (err) => (err ? reject(err) : resolve()));
        });
        return;
    }
    throw new Error('delObject nicht verfügbar');
}

/**
 * Entfernt alle Datenpunkte und Kanäle zu Ventil{nr} (inkl. Schleife + Test).
 * @param {import('@iobroker/adapter-core').Adapter} adapter
 * @param {number|string} nr
 */
async function deleteVentilByNr(adapter, nr) {
    const n = parseInt(nr, 10);
    if (!Number.isFinite(n) || n < 1) {
        throw new Error(`Ungültige Ventil-Nr: ${nr}`);
    }

    const ns = adapter.namespace;
    let relIds = collectVentilDeleteRelIds(ns, n);

    if (typeof adapter.getObjectListAsync === 'function') {
        try {
            const list = await adapter.getObjectListAsync();
            const ventilPrefix = `Ventil${n}.`;
            const ventilTop = `Ventil${n}`;
            for (let li = 0; li < list.length; li += 1) {
                const id = list[li];
                if (id === ventilTop || id.startsWith(ventilPrefix)) {
                    relIds.push(id);
                }
            }
        } catch (e) {
            adapter.log.debug(`deleteVentil getObjectListAsync: ${e.message || e}`);
        }
    }

    relIds = [...new Set(relIds)].sort((a, b) => b.split('.').length - a.split('.').length);

    let deleted = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < relIds.length; i += 1) {
        const relId = relIds[i];
        try {
            const existing = await adapter.getObjectAsync(relId);
            if (!existing) {
                skipped++;
                continue;
            }
            await deleteObjectRel(adapter, relId);
            deleted++;
        } catch (e) {
            failed++;
            adapter.log.warn(`deleteVentil ${relId}: ${e.message || e}`);
        }
    }

    const stillTop = await adapter.getObjectAsync(`Ventil${n}`);
    if (stillTop) {
        try {
            await deleteObjectRel(adapter, `Ventil${n}`);
            deleted++;
        } catch (e) {
            failed++;
            throw new Error(`Ventil${n} unter ${ns} konnte nicht entfernt werden: ${e.message || e}`);
        }
    }

    adapter.log.info(
        `Ventil${n} unter ${ns} entfernt: ${deleted} gelöscht, ${skipped} nicht vorhanden` +
        (failed ? `, ${failed} Fehler` : ''),
    );

    if (deleted === 0 && failed > 0) {
        throw new Error(`Ventil${n}: kein Objekt gelöscht (${failed} Fehler)`);
    }

    return { deleted, skipped, failed, nr: n };
}

module.exports = {
    ensureAdapterStates,
    ensureVentilByNr,
    deleteVentilByNr,
    ensureSchaltzeitByNr,
    deleteSchaltzeitByNr,
    collectVentilDeleteRelIds,
    collectSchaltzeitDeleteRelIds,
    toRelativeStateId,
};
