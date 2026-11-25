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
    'isTab2VentilTable',
    'tableTabPanelHasSchleifeAktiv',
    'tagAdminTable',
    'roleTipsForTable',
    'fieldTipsForTable',
    'headerTipsForTable',
]);

function shouldRemoveFn(name) {
    if (KEEP.has(name)) return false;
    return /Tab2|Schaltzeit|schaltzeit|TimeEvent|timeEvent|Wochentag|AstroEin|AstroPanel|AstroCell|AstroSummary|Zeitsteuerung|ZeitDp|ZeitState|ZeitRow|ZeitCell|ZeitInput|ZeitDraft|ZeitClear|ZeitClock|ZeitColumn|ZeitHint|ZeitRaw|ZeitVal|ZeitToggle|ZeitEmpty|ZeitUser|ZeitCommit|ZeitAuto|ZeitPicker|schleifeActive|SchleifeActive/i.test(name);
}

function removeFunctions(source) {
    const lines = source.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
        const m = lines[i].match(/^    function (\w+)\s*\(/);
        if (m && shouldRemoveFn(m[1])) {
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

// Tab2-Konstanten (Tips/Styling behalten für isTab2VentilTable-Zweige)
script = script.replace(/\n    var TAB2_ZEIT_[^\n]+\n/g, '\n');
script = script.replace(/\n    var TAB2_ASTRO_SETTINGS_URL[^\n]+\n/g, '\n');
script = script.replace(/\n    var TAB2_ANALOG_CLOCK_URL[^\n]+\n/g, '\n');
script = script.replace(/\n    var TAB2_CLOCK_LINES_ICON_SRC[^\n]+\n/g, '\n');
script = script.replace(/\n    var bwTab2ZeitStateSubBound[^\n]+\n/g, '\n');

// Tab2-Zweige in applyTableBody3D und ähnlichen Funktionen: leere Blöcke entfernen
script = script.replace(/\n        if \(tab2\) \{[\s\S]*?\n        \}\n        if \(tab1\)/g, '\n        if (tab1)');
script = script.replace(/\n        if \(isTab2VentilTable\(table\)\) \{[\s\S]*?\n        \}\n        row\.setAttribute\('data-bw-delete-ventil-nr'/g, "\n        row.setAttribute('data-bw-delete-ventil-nr'");
script = script.replace(/\n        if \(isTab2VentilTable\(table\)\) \{[\s\S]*?\n            return;\n        \}/g, '');

// Clone/Add Tab2 branches
script = script.replace(/\n            if \(isTab2VentilTable\(table\)\) \{[\s\S]*?\n            \}\n            reapplyClonedNameHighlights/g, '\n            reapplyClonedNameHighlights');
script = script.replace(/\n            if \(isTab2VentilTable\(table\)\) \{[\s\S]*?\n                \}\);\n            \} else \{/g, '\n            } else {');
script = script.replace(/\n            if \(isTab2VentilTable\(table\)\) \{[\s\S]*?\n                \}\);\n            \}/g, '');

// applyTableBody3D tab2 block at end
script = script.replace(/\n            if \(isTab2VentilTable\(table\)\) \{[\s\S]*?\n            \}\n        \}\);/g, '\n        });');

// writeRowDataToDom / readRowData tab2
script = script.replace(/\n        var tab2 = isTab2VentilTable\(table\);[\s\S]*?\n        \}\n        if \(oidCell/g, '\n        if (oidCell');
script = script.replace(/\n        var nameCell = isTab2VentilTable\(table\)[\s\S]*?\n        \}\n        if \(activeCell/g, '\n        if (activeCell');

// reorderActions tab2
script = script.replace(/\n        if \(isTab2VentilTable\(table\)\) \{[\s\S]*?applyTab2SharedColumnMarkers\(table\);[\s\S]*?\n        \}/g, '');

// formatProtectedFirstRow
script = script.replace(/\n        if \(isTab2VentilTable\(table\)\) \{[\s\S]*?commitTab2ZeitFromRow[\s\S]*?\n        \}/g, '');

// hideTab2 in ensureEraser
script = script.replace(/\n        if \(isTab2ZeitNoClearButton\(btn\)\) \{[\s\S]*?\n        \}/g, '');

script = script.replace(/var BW_CSS_VER = '\d+';/, "var BW_CSS_VER = '1477';");

fs.writeFileSync(file, before + script + after, 'utf8');
console.log('tab-layout-inject.html – zweite Bereinigungsrunde');
