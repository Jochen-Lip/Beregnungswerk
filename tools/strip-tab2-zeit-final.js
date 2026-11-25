#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const file = path.join(ROOT, 'admin/tab-layout-inject.html');
let src = fs.readFileSync(file, 'utf8');

const scriptStart = src.indexOf('<script>');
const scriptEnd = src.indexOf('</script>', scriptStart);
const before = src.slice(0, scriptStart + '<script>'.length);
let script = src.slice(scriptStart + '<script>'.length, scriptEnd);
const after = src.slice(scriptEnd);

const KEEP = new Set([
    'isTab2VentilTable', 'tableTabPanelHasSchleifeAktiv', 'tagAdminTable',
    'roleTipsForTable', 'fieldTipsForTable', 'headerTipsForTable',
    'schleifeVentilDpId', 'findSchleifeAktivInput', 'getSchleifeVentilSlot',
]);

const REMOVE_RE = /Tab2|Schaltzeit|schaltzeit|TimeEvent|timeEvent|Wochentag|AstroEin|AstroPanel|AstroCell|AstroSummary|AstroSettings|AstroTyp|AstroOffset|AnalogClock|emptyTime|pushTime|sanitizeTime|domStateToTime|emitJsonConfigZeit|tab2Zeit|nrLabelForTime|isVentilLikeZeit|parseTagSuffix|serializeWochentag|wochentagTag|wochentagButton|wochentagTone|wochentagActive|styleWochentag|toggleTab2|getWochentag|getAstro|astroTyp|astroValues|formatAstro|isKnownAstro|serializeAstro|buildTab2|getTab2Admin|isWochentagButton|showTab2|closeTab2|invalidateTab2|restoreTab2|readTab2|applyTab2|ensureTab2|wireTab2|refreshTab2|syncTab2|markTab2|patchTab2|commitTab2|publishTab2|flushTab2|hideTab2|openTab2|alignTab2|defaultSchaltzeit|normalizeTab2|formatTab2|resolveTab2|scheduleTab2|reapplyTab2|deleteSchaltzeit|ensureSchaltzeit|wireSchaltzeit|retryPending|cancelPending|rememberRowSchaltzeit|markSchaltzeit|resolveSchaltzeit|countOtherRows|isProtectedSchaltzeit|syncSchaltzeit|scheduleSyncTime|scheduleEnsureTableSchaltzeit|syncTimeTable|handleTab2|detectTab2|pollTab2|getTimeRowIndex|BW_ZS_TAG/;

function removeFunctions(source) {
    const lines = source.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
        const m = lines[i].match(/^    function (\w+)\s*\(/);
        if (m && !KEEP.has(m[1]) && REMOVE_RE.test(m[1])) {
            let depth = 0;
            let started = false;
            while (i < lines.length) {
                const l = lines[i];
                for (let c = 0; c < l.length; c += 1) {
                    if (l[c] === '{') { depth += 1; started = true; }
                    else if (l[c] === '}') depth -= 1;
                }
                i += 1;
                if (started && depth === 0) break;
            }
            continue;
        }
        out.push(lines[i]);
        i += 1;
    }
    return out.join('\n');
}

script = removeFunctions(script);

// Tab2-only Variablen
script = script.replace(/\n    var TAB2_(ASTRO_SETTINGS_URL|ANALOG_CLOCK_URL|ZEIT_HINT|ZEIT_EMPTY_DP|ZEIT_ROW1_DEFAULT|ZEIT_ROW2_DEFAULT|CLOCK_LINES_ICON_SRC) = [^;]+;/g, '');
script = script.replace(/\n    var BW_ZS_TAG_SUFFIX = [^;]+;/, '');
script = script.replace(/\n    var BW_ZS_TAG_DEFAULTS = [^;]+;/, '');
script = script.replace(/\n    var BW_ZS_TAG_NAMES = \{[\s\S]*?\};/, '');
script = script.replace(/\n    var bwTab2ZeitStateSubBound = false;/, '');

// run()
script = script.replace(/\n            ensureTab2ZeitClockGlobalClick\(doc\);\n            ensureTab2AstroSummaryResize\(doc\);/, '');
script = script.replace(/\n            applyTab2ZeitsteuerungSwitch\(doc\);/, '');
script = script.replace(/\n            var tab2Reentry = detectTab2AdapterConfigReentry\(doc\);[\s\S]*?\n            \}/, '');
script = script.replace(/\n                    \} else if \(isTab2VentilTable\(table\)\) \{[\s\S]*?\n                    \}/, '\n                    }');
script = script.replace(/\n            pollTab2ZeitDpLiveSync\(doc\);\n            ensureTab2ZeitStateSubscription\(doc\);/, '');
script = script.replace(/\n            applyTab2ZeitColumnTooltips\(table, fieldTips\);/, '');

script = script.replace(/var BW_CSS_VER = '\d+';/, "var BW_CSS_VER = '1479';");

fs.writeFileSync(file, before + script + after, 'utf8');
console.log('tab-layout-inject.html – finale Tab2-Bereinigung');
