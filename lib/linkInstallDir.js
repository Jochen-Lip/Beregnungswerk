'use strict';

/**
 * ioBroker leitet den Ordnernamen aus dem GitHub-Repository ab.
 * Das Repository heißt Beregnungswerk, npm legt das Paket aber als
 * iobroker.beregnungswerk ab. Auf einem System, das Groß- und
 * Kleinschreibung unterscheidet, findet die Installation den Ordner
 * sonst nicht. Diese Verknüpfung macht beide Namen gültig.
 */
const fs = require('fs');
const path = require('path');

const pkgDir = path.resolve(__dirname, '..');
const modulesDir = path.dirname(pkgDir);

if (path.basename(modulesDir) !== 'node_modules') {
    process.exit(0);
}

const realDir = fs.realpathSync(pkgDir);
const names = ['iobroker.beregnungswerk', 'iobroker.Beregnungswerk'];

for (const name of names) {
    const linkPath = path.join(modulesDir, name);
    let stat;
    try {
        stat = fs.lstatSync(linkPath);
    } catch (e) {
        stat = null;
    }

    if (stat) {
        try {
            if (fs.realpathSync(linkPath) === realDir) {
                continue;
            }
        } catch (e) {
            // kaputte Verknüpfung
        }
        if (!stat.isSymbolicLink()) {
            continue;
        }
        try {
            fs.unlinkSync(linkPath);
        } catch (e) {
            continue;
        }
    }

    try {
        const type = process.platform === 'win32' ? 'junction' : 'dir';
        fs.symlinkSync(realDir, linkPath, type);
    } catch (e) {
        // Auf Datenträgern ohne Groß-/Kleinschreibung ist der Ordner schon derselbe.
    }
}
