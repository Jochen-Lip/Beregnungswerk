#!/usr/bin/env node
'use strict';

/**
 * Entfernt nur Tab-2-Zeit/Schaltzeit-Funktionen (explizite Liste).
 * Tab-1-Funktionen bleiben unberührt.
 */

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

const REMOVE = new Set([
    'resolveTab2ZeitRowByIndex', 'bindTab2ClockMessageListeners',
    'setTab2ZeitClockPickerIcon', 'prepareTab2AstroSummaryButton', 'fitTab2AstroSummaryFontSize',
    'fitAllTab2AstroSummaryFonts', 'ensureTab2AstroSummaryResize', 'setTab2AstroSettingsIcon',
    'resolveTab2ZeitClockClick', 'triggerTab2ZeitClockOpen', 'wireTab2ZeitClockPickerButton',
    'ensureTab2ZeitClockGlobalClick', 'ensureTab2ZeitClockClickDelegation', 'removeTab2StandaloneClockButtons',
    'ensureTab2ZeitClockEndButton', 'ensureTab2ZeitClockButtons', 'isTab2ZeitNoClearButton', 'hideTab2ZeitClearButton',
    'prepareTab2ToggleCell', 'alignTab2NrCell', 'alignTab2AktivCell', 'alignTab2ZeitCell',
    'alignTab2WochentagColCell', 'alignTab2AstroEinCell', 'alignTab2AstroColCell', 'tab2ColWidthForKind',
    'ensureTab2Colgroup', 'markTab2ColumnHeaders', 'applyTab2SharedColumnMarkers',
    'isTab2ZeiteinstellungActive', 'readTab2ZeitChecked', 'syncTab2ZeitToggle', 'toggleTab2ZeitSwitch',
    'applyTab2ZeitsteuerungSwitch',
    'defaultTimeEventWochentag', 'schaltzeitSlotChannelId', 'schaltzeitZeitStateId', 'schaltzeitZeitWriteStateIds',
    'schaltzeitAktivStateId', 'schaltzeitAstroStateId', 'schaltzeitAstroTypStateId', 'schaltzeitAstroOffsetStateId',
    'schaltzeitLegacyFlatId', 'isSchaltzeitTimeRowIndex', 'schaltzeitSlotForRowIndex', 'defaultSchaltzeitZeitForSlot',
    'defaultSchaltzeitZeitForRowIndex', 'isLegacyFactorySchaltzeitZeitForIndex', 'schaltzeitDpPathForRowIndex',
    'schaltzeitZeitDpExistsViaAdmin', 'isAllowedTab2ZeitControlKey', 'getTab2ZeitInputEl', 'isTab2ZeitInputFocused',
    'isTab2ZeitCellEditing', 'getTab2ZeitInputFromEvent', 'formatTab2ZeitInput', 'wouldAcceptTab2ZeitInput',
    'isCompleteTab2ZeitValue', 'isTab2ZeitEmptyValue', 'lockTab2ZeitUserCell', 'isTab2ZeitUserLocked',
    'findTab2ZeitInputOnChange', 'reapplyTab2ZeitCellDisplay', 'scheduleTab2ZeitCellReapply',
    'finalizeTab2ZeitFromPicker', 'applyTab2ZeitValueToCell', 'saveTab2ZeitDraft', 'readTab2ZeitDraft',
    'reapplyTab2ZeitDrafts', 'flushTab2ZeitInputsFromTable', 'resolveTab2ZeitCommitValue', 'applyTab2ZeitAutoFormat',
    'stripLegacySchaltzeitZeitForIndex', 'normalizeTab2ZeitValue', 'defaultWochentagTagStates',
    'applyWochentagTagsToTimeEventRow', 'publishTab2WochentagReactField', 'schaltzeitTagStateId',
    'schaltzeitWeFeiertagStateId', 'schaltzeitWochentagPickerStateId', 'defaultAstroTypForSlot',
    'normalizeAstroTypValue', 'normalizeAstroOffsetValue', 'applyAstroValuesToTimeEventRow',
    'publishTab2AstroReactField', 'publishTab2ZeitReactField', 'isTab2AstroPanelBusy', 'isTab2AstroEinActive',
    'hideTab2AstroNative', 'applyTab2AstroPanelValues', 'wireTab2AstroPanelControls', 'refreshTab2AstroPanel',
    'refreshTab2AstroPanelForRow', 'refreshAllTab2AstroPanels', 'syncTab2AstroPanelVisibility',
    'ensureTab2AstroPanel', 'applyTab2AstroCells', 'hideTab2WochentagNative', 'ensureWochentagButtonWrapped',
    'openTab2AstroSettingsForRow', 'openTab2AnalogClockForRow', 'hideTab2ZeitPersistentHelp',
    'applyTab2ZeitColumnTooltips', 'hideTab2ZeitCellClearButtons', 'ensureTab2ZeitClearButtons',
    'applyTab2ZeitRowHint', 'refreshTab2ZeitCell', 'readTab2ZeitValFromAdminDp', 'applyTab2TimeEventsSyncResult',
    'wireTab2ZeitInputCommit', 'refreshAllTab2ZeitCells', 'syncTab2ZeitTableFromAdapterDp',
    'flushPendingTab2ZeitToDp', 'ensureTab2ZeitRowsWired', 'applyTab2ZeitInputHints', 'ensureTab2ZeitInputHints',
    'setWochentagButtonVisual', 'syncWochentagSuffixForSlot', 'wireTab2WochentagButton', 'syncWochentagPickerButtons',
    'refreshTab2WochentagPicker', 'refreshAllTab2WochentagPickers', 'markTab2WochentagHeader',
    'ensureTab2WochentagPicker', 'applyTab2WochentagCells', 'schaltzeitZsConfigKey', 'patchTab2SchaltzeitNativeConfig',
    'wireTab2SaveHook', 'wireTab2LeaveHook', 'markTab2SchaltzeitNativeFromRow', 'refreshTab2AstroEinCell',
    'refreshAllTab2AstroEinCells', 'ensureTab2AstroEinButton', 'applyTab2AstroEinCells', 'readTab2ZeitCellValue',
    'readTab2RowDomState', 'publishTab2TimeEventsToNative', 'publishTab2SnapshotToNative', 'applyTab2RowDomState',
    'applyTab2TableDomSnapshot', 'reapplyTab2RowsAfterMove', 'wireTab2RowMovePreserve', 'readTab2ZeitRawFromRow',
    'commitTab2ZeitFromRow', 'applySchleifeActiveToRow', 'syncAllSchleifeActiveFromDp', 'scheduleSyncAllSchleifeActiveFromDp',
    'schaltzeitDeleteProbeId', 'isSchaltzeitSlotMarkedDeleted', 'ensureSchaltzeitStatesForNr', 'schaltzeitAdminTagBundle',
    'schaltzeitAdminStateBundle', 'ensureSchaltzeitStatesViaAdmin', 'syncSchaltzeitDefaultToDp', 'resolveSchaltzeitDeleteSlot',
    'isProtectedSchaltzeitSlot', 'countOtherRowsWithSchaltzeitSlot', 'rememberRowSchaltzeitDeleteSlot',
    'markSchaltzeitSlotDeleted', 'retryPendingSchaltzeitDpDeletes', 'clearSkipEnsureIfSchaltzeitBackInTable',
    'cancelPendingSchaltzeitDpEnsure', 'wireSchaltzeitDeleteDpCleanup', 'deleteSchaltzeitStatesViaAdmin',
    'deleteSchaltzeitStatesForNr', 'scheduleEnsureTableSchaltzeitDps', 'scheduleSyncTimeTableFromDp',
    'syncTimeTableFromDp', 'handleTab2ZeitStateChange', 'ensureTab2ZeitStateSubscription', 'pollTab2ZeitDpLiveSync',
    'detectTab2AdapterConfigReentry', 'handleTab2AdapterConfigReentry', 'invalidateTab2ZeitDpSync', 'clearTab2ZeitDrafts',
    'resetTab2TableDpSyncFlags', 'invalidateTab2WochentagDpSync', 'mergeTab2TimeEventsFromDomToNative',
    'collectTab2TableDomSnapshot', 'permuteTab2Snapshot', 'pushTimeActiveStates', 'pushTimeAstroStates',
    'getTimeRowIndex', 'buildTimeEventRowFromIndex', 'normalizeTimeEventRow', 'readAdminBoolState',
]);

function removeListedFunctions(source) {
    const lines = source.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
        const m = lines[i].match(/^    function (\w+)\s*\(/);
        if (m && REMOVE.has(m[1])) {
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

script = removeListedFunctions(script);

// Konstanten
['TAB2_ASTRO_SETTINGS_URL', 'TAB2_ANALOG_CLOCK_URL', 'TAB2_ZEIT_HINT', 'TAB2_ZEIT_EMPTY_DP',
    'TAB2_ZEIT_ROW1_DEFAULT', 'TAB2_ZEIT_ROW2_DEFAULT', 'TAB2_CLOCK_LINES_ICON_SRC'].forEach((name) => {
    script = script.replace(new RegExp(`\\n    var ${name} = [^\\n]+;`, 'g'), '');
});

script = script.replace(/\n    var bwTab2ZeitStateSubBound = false;/, '');

// run(): Tab2-Init entfernen
script = script.replace(
    /\n            ensureTab2ZeitClockGlobalClick\(doc\);\n            ensureTab2AstroSummaryResize\(doc\);/,
    '',
);
script = script.replace(/\n            applyTab2ZeitsteuerungSwitch\(doc\);/, '');
script = script.replace(
    /\n            var tab2Reentry = detectTab2AdapterConfigReentry\(doc\);\n            if \(tab2Reentry\) \{\n                handleTab2AdapterConfigReentry\(doc, tables\);\n            \}/,
    '',
);
script = script.replace(
    /\n                    \} else if \(isTab2VentilTable\(table\)\) \{[\s\S]*?\n                    \}/,
    '\n                    }',
);
script = script.replace(/\n            pollTab2ZeitDpLiveSync\(doc\);\n            ensureTab2ZeitStateSubscription\(doc\);/, '');

// applyVentilTableTooltips
script = script.replace(/\n            applyTab2ZeitColumnTooltips\(table, fieldTips\);/, '');

script = script.replace(/var BW_CSS_VER = '\d+';/, "var BW_CSS_VER = '1478';");

fs.writeFileSync(file, before + script + after, 'utf8');
console.log('tab-layout-inject.html – gezielte Tab2-Bereinigung abgeschlossen');
