'use strict';

/** Zusatzfunktionen je Pumpe (Tab Pumpensteuerung, Inline-Panel). */
const FELDER = [
    { key: 'Aktiv', type: 'boolean', def: false, name: 'Pumpe aktiv' },
    { key: 'Ausgang', type: 'string', def: '', name: 'Pumpenausgang' },
    { key: 'Art', type: 'string', def: 'tank', name: 'Pumpenart' },
    { key: 'TankAktiv', type: 'boolean', def: false, name: 'Tankbefüllung' },
    { key: 'TankSensor', type: 'string', def: '', name: 'Tank-Sensor' },
    { key: 'TankSchwelle', type: 'number', def: 30, name: 'Tank-Schwelle' },
    { key: 'TankVergleich', type: 'string', def: 'unter', name: 'Tank-Vergleich' },
    { key: 'TankSchwelleUnten', type: 'number', def: 20, name: 'Untere Schwelle' },
    { key: 'TankSchwelleOben', type: 'number', def: 90, name: 'Obere Schwelle' },
    { key: 'SchalterAktiv', type: 'boolean', def: false, name: 'Analoger Ein/Aus-Schalter' },
    { key: 'SchalterSensor', type: 'string', def: '', name: 'Ein/Aus-Schalter' },
    { key: 'FlussAktiv', type: 'boolean', def: false, name: 'Durchflussmesser' },
    { key: 'FlussSensor', type: 'string', def: '', name: 'Durchflussmesser' },
    { key: 'FlussMindest', type: 'number', def: 1, name: 'Mindestfluss' },
    { key: 'TimerAktiv', type: 'boolean', def: false, name: 'Timer' },
    { key: 'TimerMinuten', type: 'number', def: 10, name: 'Timer Minuten' },
    { key: 'TimerSekunden', type: 'number', def: 0, name: 'Timer Sekunden' },
    { key: 'ErholSekunden', type: 'number', def: 30, name: 'Erholpause Sekunden' },
    { key: 'TankPauseSchleife', type: 'boolean', def: true, name: 'Schleife bei Tankbefüllung pausieren' },
    { key: 'NachtruheAktiv', type: 'boolean', def: false, name: 'Nachtruhe' },
    { key: 'NachtruheVon', type: 'string', def: '22:00', name: 'Nachtruhe von' },
    { key: 'NachtruheBis', type: 'string', def: '06:00', name: 'Nachtruhe bis' },
    { key: 'Invertieren', type: 'boolean', def: false, name: 'Ein/Aus invertieren' },
    { key: 'BeiWartung', type: 'boolean', def: false, name: 'Bei Wartung einschalten' },
    { key: 'BeiSchleife', type: 'boolean', def: false, name: 'Bei Schleife einschalten' },
    { key: 'Druckschalter', type: 'boolean', def: false, name: 'Integrierter Druckschalter' },
];

function relId(nr, key) {
    return `Pumpen.Pumpe${nr}.Konfig.${key}`;
}

function fullId(ns, nr, key) {
    return `${ns}.${relId(nr, key)}`;
}

function statusRel(nr) {
    return `Pumpen.Pumpe${nr}.Anzeigen.Status`;
}

function statusFull(ns, nr) {
    return `${ns}.${statusRel(nr)}`;
}

function zeitMinuten(raw) {
    const m = String(raw || '').trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
}

function imZeitfenster(date, von, bis) {
    const a = zeitMinuten(von);
    const b = zeitMinuten(bis);
    if (a == null || b == null || a === b) return false;
    const now = date.getHours() * 60 + date.getMinutes();
    if (a < b) return now >= a && now < b;
    return now >= a || now < b;
}

function artVon(c) {
    const art = String((c && c.Art) || '').trim();
    if (art === 'brunnen' || art === 'hauswasser' || art === 'tank') return art;
    return '';
}

function timerDauerMs(c) {
    if (!c || c.TimerAktiv !== true) return 0;
    const minuten = Number(c.TimerMinuten);
    const sekunden = Number(c.TimerSekunden);
    const min = Number.isFinite(minuten) && minuten > 0 ? minuten : 0;
    const sek = Number.isFinite(sekunden) && sekunden > 0 ? sekunden : 0;
    return (min * 60 + sek) * 1000;
}

function schalterAktiv(c, x) {
    return !!(c && c.SchalterAktiv === true && x && x.schalterBekannt === true);
}

function fuellPause(c, fuellt, an) {
    return !!(c && c.TankPauseSchleife === true && fuellt && an);
}

const FLUSS_KARRENZ_MS = 15000;

function flussZuKlein(c, x) {
    if (!c || c.FlussAktiv !== true || !x || x.flussBekannt !== true) return false;
    const wert = Number(x.flussWert);
    if (!Number.isFinite(wert)) return false;
    const grenze = Number(c.FlussMindest);
    if (!Number.isFinite(grenze) || grenze <= 0) return wert <= 0;
    return wert < grenze;
}

function wendeFluss(c, x, state, bedarf, jetztMs) {
    if (!c || c.FlussAktiv !== true || !x || x.flussBekannt !== true) {
        return { wollen: !!bedarf, gestoppt: false };
    }
    if (state.flussStopp && !bedarf) state.flussStopp = false;
    if (state.flussStopp && bedarf) return { wollen: false, gestoppt: true };
    if (bedarf && state.gestartet && flussZuKlein(c, x) && jetztMs - state.seit >= FLUSS_KARRENZ_MS) {
        state.flussStopp = true;
        state.an = false;
        return { wollen: false, gestoppt: true };
    }
    return { wollen: !!bedarf, gestoppt: false };
}

function schwelleHaelt(c, x, vorherAn) {
    if (!c || c.TankAktiv !== true || x.sensorBekannt !== true) {
        return { wollen: false, grund: '' };
    }
    const wert = Number(x.sensorWert);
    const unten = Number(c.TankSchwelleUnten);
    const oben = Number(c.TankSchwelleOben);
    if (!Number.isFinite(wert)) return { wollen: false, grund: '' };
    if (Number.isFinite(oben) && wert >= oben) return { wollen: false, grund: 'obere Schwelle' };
    if (Number.isFinite(unten) && wert <= unten) return { wollen: true, grund: 'untere Schwelle' };
    if (vorherAn) return { wollen: true, grund: 'füllt' };
    return { wollen: false, grund: '' };
}

function mitMaxTimer(wollen, c, state, jetztMs, latchHalten) {
    const dauerMs = timerDauerMs(c);
    const timerAn = dauerMs > 0;
    if (!wollen) {
        state.an = false;
        state.seit = 0;
        state.gestartet = false;
        if (!latchHalten) state.timerStopp = false;
        return { an: false, hinweis: latchHalten ? 'Timer abgelaufen' : '' };
    }
    if (!timerAn) {
        state.an = true;
        return { an: true, hinweis: '' };
    }
    if (state.timerStopp) return { an: false, hinweis: 'Timer abgelaufen' };
    if (!state.gestartet) {
        state.seit = jetztMs;
        state.gestartet = true;
    }
    if (jetztMs - state.seit >= dauerMs) {
        state.timerStopp = true;
        state.an = false;
        return { an: false, hinweis: 'Timer abgelaufen' };
    }
    state.an = true;
    return { an: true, hinweis: '' };
}

function nachtruheSperrt(c, jetzt) {
    return c.NachtruheAktiv === true && imZeitfenster(jetzt, c.NachtruheVon, c.NachtruheBis);
}
function leererTankLauf() {
    return { an: false, seit: 0, gestartet: false, timerStopp: false, erholBis: 0, flussStopp: false };
}

/**
 * Untere Schwelle schaltet ein, obere aus.
 * Timer allein oder als Abbruch, wenn die obere Schwelle nicht kommt.
 * @param {object} c
 * @param {object} x
 * @param {{an: boolean, seit: number, timerStopp: boolean}} lauf
 */
function bewerteTank(c, x, lauf) {
    const state = lauf || leererTankLauf();
    const jetzt = (x.jetzt || new Date()).getTime();
    const schwelleAn = c.TankAktiv === true && x.sensorBekannt === true;
    const schalter = schalterAktiv(c, x);
    const dauerMs = timerDauerMs(c);
    const timerAn = dauerMs > 0;
    const unten = Number(c.TankSchwelleUnten);
    const oben = Number(c.TankSchwelleOben);
    const wert = Number(x.sensorWert);
    const hatUnten = Number.isFinite(unten);
    const hatOben = Number.isFinite(oben);

    if (state.timerStopp && schwelleAn && Number.isFinite(wert) && hatUnten && wert > unten) {
        state.timerStopp = false;
        state.seit = 0;
        state.gestartet = false;
    }
    if (state.timerStopp && schalter && x.schalterAn !== true && !schwelleAn) {
        state.timerStopp = false;
        state.seit = 0;
        state.gestartet = false;
    }

    let wollen = false;
    let grund = '';
    if (schwelleAn && Number.isFinite(wert) && (hatUnten || hatOben)) {
        if (hatOben && wert >= oben) {
            wollen = false;
            grund = 'obere Schwelle';
            state.timerStopp = false;
            state.seit = 0;
            state.gestartet = false;
        } else if (hatUnten && wert <= unten && !state.timerStopp) {
            wollen = true;
            grund = 'untere Schwelle';
        } else if (state.an && !state.timerStopp) {
            wollen = true;
            grund = 'füllt';
        }
        if (schalter && x.schalterAn === true && !state.timerStopp && grund !== 'obere Schwelle') {
            wollen = true;
            if (!grund || grund === 'Schalter aus') grund = 'Schalter ein';
        }
    } else if (schalter) {
        wollen = x.schalterAn === true && !state.timerStopp;
        grund = wollen ? 'Schalter ein' : (state.timerStopp ? 'Timer abgelaufen' : 'Schalter aus');
    } else if (timerAn && !schwelleAn) {
        wollen = !state.timerStopp;
        grund = 'Timer';
    }

    if (wollen && !state.an) {
        state.seit = jetzt;
        state.gestartet = true;
    }
    const fluss = wendeFluss(c, x, state, wollen, jetzt);
    if (fluss.gestoppt) {
        wollen = false;
        grund = 'kein Durchfluss';
    }
    if (wollen && timerAn && state.gestartet && jetzt - state.seit >= dauerMs) {
        wollen = false;
        state.timerStopp = true;
        state.an = false;
        grund = 'Timer abgelaufen';
        return { tank: false, grund, lauf: state };
    }
    state.an = wollen;
    if (!wollen && !state.timerStopp) {
        state.seit = 0;
        state.gestartet = false;
    }
    const tank = wollen && (schwelleAn || schalter || timerAn);
    return { tank, grund: tank ? grund : (state.timerStopp ? 'Timer abgelaufen' : ''), lauf: state };
}

/**
 * @param {object} cfg
 * @param {{sensorBekannt?: boolean, sensorWert?: number, schleifeLaeuft?: boolean, ventilHardwareAn?: boolean, ventilWartung?: boolean, jetzt?: Date, lauf?: {an: boolean, seit: number, timerStopp: boolean}}} ctx
 */
function bewertePumpe(cfg, ctx) {
    const c = cfg || {};
    const x = ctx || {};
    const ausgang = String(c.Ausgang || '').trim();
    if (c.Aktiv !== true || !ausgang) {
        if (x.lauf) {
            x.lauf.an = false;
            x.lauf.seit = 0;
            x.lauf.gestartet = false;
            x.lauf.timerStopp = false;
            x.lauf.erholBis = 0;
            x.lauf.flussStopp = false;
        }
        return { an: false, hardware: false, pause: false, status: 'nicht aktiv', laufReset: true };
    }
    const art = artVon(c);
    const state = x.lauf || leererTankLauf();
    const jetzt = x.jetzt || new Date();
    if (art === 'brunnen') return bewerteBrunnen(c, x, state, jetzt);
    if (art === 'hauswasser') return bewerteHauswasser(c, x, state, jetzt);
    const gruende = [];
    const tankEntscheid = bewerteTank(c, x, state);
    let tank = tankEntscheid.tank;
    let timerHinweis = '';
    if (tank && tankEntscheid.grund) gruende.push(tankEntscheid.grund);
    else if (!tank && tankEntscheid.grund === 'Timer abgelaufen') timerHinweis = 'Timer abgelaufen';
    if (art !== 'tank') {
        if (c.BeiWartung === true && x.ventilWartung) gruende.push('Ventil in Wartung');
        if (c.BeiSchleife === true && x.schleifeLaeuft) gruende.push('Schleife');
        if (c.Druckschalter === true && (x.ventilHardwareAn || x.schleifeLaeuft || x.ventilWartung)) {
            gruende.push('Druckschalter');
        }
    }
    let an = gruende.length > 0;
    let status = an ? gruende.join(', ') : (timerHinweis || 'Bereit');
    if (nachtruheSperrt(c, jetzt)) {
        an = false;
        tank = false;
        status = 'Nachtruhe';
    }
    const pause = !!(tank && c.TankPauseSchleife === true && an);
    const hardware = c.Invertieren === true ? !an : an;
    return { an, hardware, pause, status };
}

function bewerteBrunnen(c, x, state, jetzt) {
    const jetztMs = jetzt.getTime();
    const vorher = state.an === true;
    const wert = Number(x.sensorWert);
    const unten = Number(c.TankSchwelleUnten);
    if (state.timerStopp && x.sensorBekannt === true && Number.isFinite(wert) && Number.isFinite(unten) && wert > unten) {
        state.timerStopp = false;
    }
    if (state.timerStopp && schalterAktiv(c, x) && x.schalterAn !== true && !(x.sensorBekannt === true && Number.isFinite(wert) && Number.isFinite(unten) && wert <= unten)) {
        state.timerStopp = false;
    }
    const schwelle = schwelleHaelt(c, x, vorher && !state.timerStopp);
    const schwelleWill = schwelle.wollen && !state.timerStopp;
    const schalterWill = schalterAktiv(c, x) && x.schalterAn === true && !state.timerStopp && schwelle.grund !== 'obere Schwelle';
    const betrieb = (c.BeiSchleife === true && x.schleifeLaeuft) || (c.BeiWartung === true && x.ventilWartung);
    const bedarf = schwelleWill || schalterWill || betrieb;
    const fluss = wendeFluss(c, x, state, bedarf, jetztMs);
    const begrenzt = mitMaxTimer(fluss.wollen, c, state, jetztMs, state.timerStopp && !fluss.wollen);
    let an = begrenzt.an;
    let status = 'Bereit';
    if (fluss.gestoppt) status = 'kein Durchfluss';
    else if (an && schalterWill && !schwelleWill) status = 'Schalter ein';
    else if (an && schwelleWill && schwelle.grund) status = schwelle.grund;
    else if (an && x.ventilWartung && c.BeiWartung === true) status = 'Ventil in Wartung';
    else if (an) status = 'Schleife';
    else status = begrenzt.hinweis || (schwelle.grund === 'obere Schwelle' ? 'obere Schwelle' : 'Bereit');
    if (nachtruheSperrt(c, jetzt)) {
        an = false;
        status = 'Nachtruhe';
    }
    const erholSek = Math.max(0, Number(c.ErholSekunden) || 0);
    if (vorher && !an && erholSek > 0) state.erholBis = jetztMs + erholSek * 1000;
    if (an) state.erholBis = 0;
    state.an = an;
    const erholt = !an && state.erholBis && jetztMs < state.erholBis;
    if (erholt) status = 'Erholpause';
    return {
        an,
        hardware: c.Invertieren === true ? !an : an,
        pause: !!(erholt || fuellPause(c, schwelleWill || schalterWill, an)),
        status,
    };
}

function bewerteHauswasser(c, x, state, jetzt) {
    const jetztMs = jetzt.getTime();
    const schwelle = schwelleHaelt(c, x, state.an === true && !state.timerStopp);
    const schalterWill = schalterAktiv(c, x) && x.schalterAn === true && !state.timerStopp && schwelle.grund !== 'obere Schwelle';
    const fuellt = (schwelle.wollen && !state.timerStopp) || schalterWill;
    const bedarf = !!(fuellt || x.ventilHardwareAn || x.schleifeLaeuft || x.ventilWartung);
    const fluss = wendeFluss(c, x, state, bedarf, jetztMs);
    const begrenzt = mitMaxTimer(fluss.wollen, c, state, jetztMs);
    let an = begrenzt.an;
    let status = fluss.gestoppt ? 'kein Durchfluss' : (an ? (fuellt && !x.ventilHardwareAn && !x.schleifeLaeuft && !x.ventilWartung ? (schalterWill && !schwelle.wollen ? 'Schalter ein' : (schwelle.grund || 'Schalter ein')) : 'Druckschalter') : (begrenzt.hinweis || 'Bereit'));
    if (nachtruheSperrt(c, jetzt)) {
        an = false;
        state.an = false;
        status = 'Nachtruhe';
    } else {
        state.an = an;
    }
    return {
        an,
        hardware: c.Invertieren === true ? !an : an,
        pause: fuellPause(c, fuellt, an),
        status,
    };
}

module.exports = {
    FELDER,
    relId,
    fullId,
    statusRel,
    statusFull,
    bewertePumpe,
    imZeitfenster,
};
