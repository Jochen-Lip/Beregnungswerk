'use strict';

const fs = require('fs');
const path = require('path');

let cached;
let catalogSource = 'unknown';

const ADAPTER_DP_BASE = 'beregnungswerk.0';

function loadManifestStates() {
    const manifestPath = path.join(__dirname, 'statesManifest.json');
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`statesManifest.json fehlt: ${manifestPath}`);
    }
    const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!Array.isArray(data.states) || !data.states.length) {
        throw new Error('statesManifest.json: states leer');
    }
    catalogSource = 'manifest';
    return data.states.map((s) => ({
        id: String(s.id).startsWith(`${ADAPTER_DP_BASE}.`) ? s.id : `${ADAPTER_DP_BASE}.${s.id}`,
        val: s.val,
        common: s.common || {},
    }));
}

function getEigeneStatesFromJs() {
    const srcPath = path.join(__dirname, 'Beregnungswerk.js');
    if (!fs.existsSync(srcPath)) {
        throw new Error(`Beregnungswerk.js fehlt: ${srcPath}`);
    }

    const src = fs.readFileSync(srcPath, 'utf8');
    const start = src.indexOf('const DP_BASE');
    const end = src.indexOf('const DP = {');
    if (start < 0 || end < 0 || end <= start) {
        throw new Error('EIGENE_STATES in Beregnungswerk.js nicht gefunden (DP_BASE / DP)');
    }

    let block = src.slice(start, end);
    block = block.replace(/const INLINE_SUNCALC = \(\(\) => \{[\s\S]*?\}\)\(\);\n\n?/, '');

    const fn = new Function(`'use strict';\n${block}\nreturn EIGENE_STATES;`);
    const result = fn();

    if (!Array.isArray(result) || !result.length) {
        throw new Error(`EIGENE_STATES ist leer (${result ? result.length : 'null'})`);
    }
    catalogSource = 'js';
    return result;
}

/**
 * Manifest nur Fallback – Beregnungswerk.js liefert korrekte Typen (boolean button).
 */
function getEigeneStates() {
    if (cached) return cached;

    const manifestPath = path.join(__dirname, 'statesManifest.json');

    try {
        cached = getEigeneStatesFromJs();
        return cached;
    } catch (jsErr) {
        if (fs.existsSync(manifestPath)) {
            try {
                cached = loadManifestStates();
                return cached;
            } catch (manifestErr) {
                throw new Error(`State-Katalog: JS (${jsErr.message || jsErr}), Manifest (${manifestErr.message || manifestErr})`);
            }
        }
        throw new Error(`State-Katalog: JS (${jsErr.message || jsErr})`);
    }
}

function getCatalogSource() {
    getEigeneStates();
    return catalogSource;
}

module.exports = {
    getEigeneStates,
    getCatalogSource,
    LEGACY_DP_BASE: '0_userdata.0.Beregnungswerk',
    ALT_DP_BASE: '0_userdata.0.MeineBewaesserung',
    ADAPTER_DP_BASE,
};
