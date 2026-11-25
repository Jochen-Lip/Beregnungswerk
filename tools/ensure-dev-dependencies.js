#!/usr/bin/env node
'use strict';

/**
 * Mac (dev-server): installiert fehlende Adapter-Abhängigkeiten in .dev-server
 * (z. B. javascript), damit beregnungswerk.0 starten kann.
 * Installiert nur, wenn noch keine Instanz existiert (z. B. javascript.0).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DEV_ROOT = path.join(ROOT, '.dev-server');
const PREFERRED_JS_INSTANCE = 'javascript.0';

function findProfileDirs() {
    if (!fs.existsSync(DEV_ROOT)) {
        return [];
    }
    return fs.readdirSync(DEV_ROOT, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(DEV_ROOT, e.name));
}

function findIobrokerCli(profileDir) {
    const candidates = [
        path.join(profileDir, 'iobroker'),
        path.join(profileDir, 'node_modules', '.bin', 'iobroker'),
    ];
    for (const cli of candidates) {
        if (fs.existsSync(cli)) {
            return cli;
        }
    }
    return null;
}

function run(cli, args, cwd) {
    const cmd = `${cli} ${args.join(' ')}`;
    console.log(`> ${cmd}`);
    execFileSync(cli, args, { cwd, stdio: 'inherit' });
}

function execQuiet(cli, args, cwd) {
    return execSync(`"${cli}" ${args.join(' ')}`, {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
    });
}

function collectJavascriptInstances(text) {
    const found = new Set();
    if (!text) {
        return found;
    }
    const patterns = [
        /system\.adapter\.javascript\.(\d+)/g,
        /\bjavascript\.(\d+)\b/g,
    ];
    patterns.forEach((re) => {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text)) !== null) {
            found.add(`javascript.${m[1]}`);
        }
    });
    return found;
}

function listJavascriptInstances(cli, cwd) {
    const found = new Set();
    const commands = [
        ['list', 'instances'],
        ['list', 'instances', 'javascript'],
    ];
    commands.forEach((args) => {
        try {
            collectJavascriptInstances(execQuiet(cli, args, cwd)).forEach((inst) => found.add(inst));
        } catch (e) {
            // ignore – nächster Versuch
        }
    });
    try {
        collectJavascriptInstances(execQuiet(cli, ['list', 'installed'], cwd)).forEach((inst) => found.add(inst));
    } catch (e) {
        // ignore
    }
    return Array.from(found).sort((a, b) => {
        const na = parseInt(a.split('.')[1], 10);
        const nb = parseInt(b.split('.')[1], 10);
        return na - nb;
    });
}

function pickPreferredInstance(instances) {
    if (!instances.length) {
        return null;
    }
    if (instances.indexOf(PREFERRED_JS_INSTANCE) >= 0) {
        return PREFERRED_JS_INSTANCE;
    }
    return instances[0];
}

function isJavascriptAdapterPackageInstalled(cli, cwd) {
    try {
        const out = execQuiet(cli, ['list', 'installed'], cwd);
        return /system\.adapter\.javascript\b/i.test(out)
            || /\badapter\.javascript\b/i.test(out)
            || /\bjavascript\b/i.test(out);
    } catch (e) {
        return false;
    }
}

function ensureJavascript(cli, cwd) {
    const instances = listJavascriptInstances(cli, cwd);
    if (instances.length) {
        const inst = pickPreferredInstance(instances);
        console.log(`JavaScript-Instanz ${inst} bereits vorhanden – keine Installation.`);
        return;
    }

    if (isJavascriptAdapterPackageInstalled(cli, cwd)) {
        console.log('JavaScript-Adapter installiert, aber keine Instanz – javascript.0 anlegen …');
        try {
            run(cli, ['addinstance', 'javascript'], cwd);
        } catch (e1) {
            console.warn('iobroker addinstance javascript:', e1.message || e1);
            try {
                run(cli, ['add', 'javascript'], cwd);
            } catch (e2) {
                console.warn('iobroker add javascript:', e2.message || e2);
            }
        }
    } else {
        console.log('JavaScript-Adapter fehlt – wird installiert …');
        try {
            run(cli, ['add', 'javascript'], cwd);
        } catch (e) {
            console.warn('iobroker add javascript:', e.message || e);
        }
    }

    const inst = pickPreferredInstance(listJavascriptInstances(cli, cwd)) || PREFERRED_JS_INSTANCE;
    console.log(`JavaScript-Instanz ${inst} ist vorbereitet. dev-server watch startet sie mit dem Controller.`);
}

function main() {
    const profiles = findProfileDirs();
    if (!profiles.length) {
        console.log('Kein .dev-server – übersprungen (zuerst: npm run dev-server:setup)');
        return;
    }

    for (const profileDir of profiles) {
        const cli = findIobrokerCli(profileDir);
        if (!cli) {
            console.warn(`Kein iobroker-CLI in ${profileDir}`);
            continue;
        }
        ensureJavascript(cli, profileDir);
    }
}

main();
