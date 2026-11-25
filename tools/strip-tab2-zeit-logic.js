#!/usr/bin/env node
'use strict';

/**
 * Entfernt Tab-2-Zeit/Schaltzeit-Logik für sauberen Neuaufbau.
 * Lokal ausführen: node tools/strip-tab2-zeit-logic.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function removeFunctionsByName(source, keepNames, removePattern) {
    const lines = source.split('\n');
    const out = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const fnMatch = line.match(/^    function (\w+)\s*\(/);
        if (fnMatch) {
            const name = fnMatch[1];
            if (keepNames.has(name) || !removePattern.test(name)) {
                out.push(line);
                i += 1;
                continue;
            }
            // Skip function body (brace counting)
            let depth = 0;
            let started = false;
            while (i < lines.length) {
                const l = lines[i];
                for (let c = 0; c < l.length; c += 1) {
                    const ch = l[c];
                    if (ch === '{') {
                        depth += 1;
                        started = true;
                    } else if (ch === '}') {
                        depth -= 1;
                    }
                }
                i += 1;
                if (started && depth === 0) {
                    break;
                }
            }
            continue;
        }
        out.push(line);
        i += 1;
    }
    return out.join('\n');
}

function stripTabLayoutInject() {
    const file = path.join(ROOT, 'admin/tab-layout-inject.html');
    let src = fs.readFileSync(file, 'utf8');

    const keepFns = new Set([
        'isTab2VentilTable',
        'tableTabPanelHasSchleifeAktiv',
        'tagAdminTable',
        'roleTipsForTable',
        'fieldTipsForTable',
        'headerTipsForTable',
    ]);

    const removeFn = /^(resolveTab2|bindTab2|setTab2|prepareTab2|fitTab2|ensureTab2|wireTab2|refreshTab2|syncTab2|applyTab2|markTab2|patchTab2|commitTab2|readTab2|openTab2|hideTab2|flushTab2|publishTab2|finalizeTab2|scheduleTab2|reapplyTab2|removeTab2|triggerTab2|alignTab2|defaultSchaltzeit|schaltzeit|isSchaltzeit|isTab2Zeit|normalizeTab2|formatTab2|getTab2|stripLegacy|defaultTimeEvent|parseTagKey|deleteSchaltzeit|ensureSchaltzeit|syncSchaltzeit|wireSchaltzeit|scheduleSyncTime|scheduleEnsureTableSchaltzeit|handleTab2|detectTab2|pollTab2|cancelPendingSchaltzeit|retryPendingSchaltzeit|clearSkipEnsure|rememberRowSchaltzeit|markSchaltzeit|countOtherRows|resolveSchaltzeit|isProtectedSchaltzeit|buildTimeEvent|isAllowedTab2|wouldAcceptTab2|lockTab2|findTab2|getTimeRowIndex|toggleTab2|isTab2Zeiteinstellung|isTab2Astro|applySchleifeActive|syncAllSchleifeActive|scheduleSyncAllSchleifeActive|readAdminBoolState|setWochentag|syncWochentag|wireTab2Wochentag|ensureWochentag|applyWochentag|defaultWochentag|normalizeAstro|defaultAstro|applyAstro|schaltzeitSlot|schaltzeitZeit|schaltzeitAktiv|schaltzeitAstro|schaltzeitLegacy|schaltzeitAdmin|schaltzeitDelete|schaltzeitDp|isLegacyFactory)/;

    // Script-Bereich extrahieren
    const scriptStart = src.indexOf('<script>');
    const scriptEnd = src.indexOf('</script>', scriptStart);
    if (scriptStart < 0 || scriptEnd < 0) {
        throw new Error('script block not found');
    }
    const before = src.slice(0, scriptStart + '<script>'.length);
    const script = src.slice(scriptStart + '<script>'.length, scriptEnd);
    const after = src.slice(scriptEnd);

    let cleaned = removeFunctionsByName(script, keepFns, removeFn);

    // Tab2-Konstanten entfernen (isTab2VentilTable bleibt)
    cleaned = cleaned.replace(/\n    var TAB2_[^\n]+;\n/g, '\n');
    cleaned = cleaned.replace(/\n    var TAB2_[^\n]+\n/g, '\n');

    // run()-Block: Tab2-Init entfernen
    cleaned = cleaned.replace(
        /ensureTab2ZeitClockGlobalClick\(doc\);\n            ensureTab2AstroSummaryResize\(doc\);\n            /,
        '',
    );
    cleaned = cleaned.replace(/\n            applyTab2ZeitsteuerungSwitch\(doc\);/, '');
    cleaned = cleaned.replace(
        /\n            var tab2Reentry = detectTab2AdapterConfigReentry\(doc\);\n            if \(tab2Reentry\) \{\n                handleTab2AdapterConfigReentry\(doc, tables\);\n            \}/,
        '',
    );
    cleaned = cleaned.replace(
        /\n                    \} else if \(isTab2VentilTable\(table\)\) \{[\s\S]*?\n                    \}/,
        '\n                    }',
    );
    cleaned = cleaned.replace(/\n            pollTab2ZeitDpLiveSync\(doc\);\n            ensureTab2ZeitStateSubscription\(doc\);/, '');

    // Shared branches: Tab2-Zeit-Aufrufe in applyVentilTableTooltips
    cleaned = cleaned.replace(/\n            applyTab2ZeitColumnTooltips\(table, fieldTips\);/, '');

    // formatProtectedFirstRow Tab2 branch vereinfachen
    cleaned = cleaned.replace(
        /writeRowDataToDom\(row, table, isTab2VentilTable\(table\) \? \{[\s\S]*?\} : \{/,
        'writeRowDataToDom(row, table, {',
    );
    cleaned = cleaned.replace(
        /\n        if \(isTab2VentilTable\(table\)\) \{[\s\S]*?commitTab2ZeitFromRow\(row, table, \{ force: true \}\);\n        \}/,
        '',
    );
    cleaned = cleaned.replace(
        /\n        if \(isTab2VentilTable\(table\)\) \{\n            applyTab2ZeitRowHint\(row, table, getVentilDataRows\(table\)\.indexOf\(row\)\);\n            return;\n        \}/,
        '',
    );

    // BW_CSS_VER bump
    cleaned = cleaned.replace(/var BW_CSS_VER = '\d+';/, "var BW_CSS_VER = '1476';");

    fs.writeFileSync(file, before + cleaned + after, 'utf8');
    console.log('tab-layout-inject.html bereinigt');
}

function stripConfigSync() {
    const file = path.join(ROOT, 'lib/configSync.js');
    let src = fs.readFileSync(file, 'utf8');

    // Schaltzeit-Hilfsfunktionen am Anfang
    src = src.replace(
        /const SCHALTZEIT_ZEIT_EMPTY = '--:--';\n\nfunction normalizeSchaltzeitZeit[\s\S]*?function isLegacyFactorySchaltzeitZeit[\s\S]*?\}\n\n/,
        '',
    );

    // zsSchaltzeit aus buildFlatMap
    src = src.replace(
        /\n        \['zsSchaltzeit1',[^\]]+\],\n        \['zsSchaltzeit1Aktiv',[^\]]+\],\n        \['zsSchaltzeit1Astro',[^\]]+\],\n        \['zsSchaltzeit1AstroTyp',[^\]]+\],\n        \['zsSchaltzeit1AstroOffset',[^\]]+\],\n        \['zsSchaltzeit2',[^\]]+\],\n        \['zsSchaltzeit2Aktiv',[^\]]+\],\n        \['zsSchaltzeit2Astro',[^\]]+\],\n        \['zsSchaltzeit2AstroTyp',[^\]]+\],\n        \['zsSchaltzeit2AstroOffset',[^\]]+\],/,
        '',
    );

    // shouldWrite + purgeLegacy
    src = src.replace(
        /\/\*\* Schaltzeit1\/2\.Zeit:[\s\S]*?return count;\n\}\n\n\/\*\*\n \* Ermittelt vorhandene Ventil-Kanäle/,
        '/**\n * Ermittelt vorhandene Ventil-Kanäle',
    );

    // timeEventsCount + schaltzeit ensure/prune block
    src = src.replace(
        /function timeEventsCount\(adapter\) \{[\s\S]*?return \{ kept: \[\.\.\.keep\], pruned, removed, existing \};\n\}\n\n\/\*\*\n \* Kürzt native\.ventile\[\]/,
        '/**\n * Kürzt native.ventile[]',
    );

    // ZS_TAG block through syncZsSchaltzeitConfigKeys
    src = src.replace(
        /const ZS_TAG_SUFFIX = \['TagMo'[\s\S]*?return count;\n\}\n\nasync function syncConfigToAdapter/,
        'async function syncConfigToAdapter',
    );

    // syncConfigToAdapter: Schaltzeit-Logik entfernen
    src = src.replace(
        /const activeVentils = collectVentilNrsFromConfigEvents\(adapter\);\n    const activeSchaltzeit = collectSchaltzeitNrsFromConfigTimeEvents\(adapter\);/,
        'const activeVentils = collectVentilNrsFromConfigEvents(adapter);',
    );
    src = src.replace(
        /\n        const zsMatch = String\(key\)\.match\(\/\^zsSchaltzeit[\s\S]*?\n        \}\n        try \{\n            await adapter\.setStateAsync\(relId, val, true\);/,
        '\n        try {\n            await adapter.setStateAsync(relId, val, true);',
    );
    src = src.replace(
        /\n    count \+= await syncTimeEventsToAdapter\(adapter\);\n    count \+= await syncZsSchaltzeitConfigKeys\(adapter\);/,
        '',
    );

    // module.exports bereinigen
    const removeExports = [
        'purgeLegacyFactorySchaltzeitZeit',
        'syncTimeTableFromDp',
        'syncTimeEventsToAdapter',
        'syncZsSchaltzeitConfigKeys',
        'buildTimeEventsFromDp',
        'readSchaltzeitZeitFromDp',
        'writeSchaltzeitZeitToDp',
        'schaltzeitZeitDpExists',
        'schaltzeitSlotExists',
        'discoverSchaltzeitNumbers',
        'discoverSchaltzeitZeitNumbers',
        'pruneOrphanSchaltzeitDpsFromConfig',
        'ensureSchaltzeitenFromConfigTimeEvents',
        'collectSchaltzeitNrsFromConfigTimeEvents',
        'trimTimeEventsConfigToRowCount',
        'persistTrimmedTimeEventsConfig',
        'persistSchaltzeitNativeConfig',
        'clearOrphanSchaltzeitConfigKeys',
        'afterTimeRowDelete',
    ];
    for (const name of removeExports) {
        src = src.replace(new RegExp(`\\n    ${name},`), '');
    }

    fs.writeFileSync(file, src, 'utf8');
    console.log('configSync.js bereinigt');
}

stripTabLayoutInject();
stripConfigSync();
