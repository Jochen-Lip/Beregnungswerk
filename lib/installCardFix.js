'use strict';

/**
 * Startet die Kartenkorrektur während der GitHub-Installation.
 * Der Controller schreibt „+main“ erst nach diesem Skript. Deshalb läuft
 * die Korrektur im Hintergrund weiter, bis die Adapterkarte gesetzt ist.
 */
const { spawn } = require('child_process');
const path = require('path');
const { isInstalledPackageDir } = require('./adapterCatalog');

const packageDir = path.resolve(__dirname, '..');

if (!isInstalledPackageDir(packageDir)) {
    process.exit(0);
}

const child = spawn(process.execPath, [path.join(__dirname, 'installCardWorker.js')], {
    cwd: packageDir,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
});
child.unref();
