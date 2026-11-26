'use strict';

const C = require('./constants');

function erzeugeVentilDP(P, nr) {
    const base = P.ventilBase(nr);
    return {
        aktiviert: `${base}.Konfig.Aktiviert`,
        dauer: `${base}.Konfig.Bewaesserungsdauer`,
        wiederholungen: `${base}.Konfig.Wiederholungen`,
        feuchtSensor: `${base}.Konfig.FeuchtigkeitSensor`,
        tempSensor: `${base}.Konfig.Temperatursensor`,
        wasserSensor: `${base}.Konfig.WasserSensor`,
        wasserArt: `${base}.Konfig.WasserArt`,
        pumpeSteuern: `${base}.Konfig.PumpeSteuern`,
        pumpeAusgang: `${base}.Konfig.PumpeAusgang`,
        ausgang: `${base}.Konfig.Ventil${nr}Ausgang`,
        wartung: `${base}.Konfig.Wartung`,
        inWartung: `${base}.Konfig.InWartung`,
        parallel: `${base}.Konfig.Parallel`,
        parallelVentile: `${base}.Konfig.ParallelVentile`,
        ausAn: `${base}.Steuerung.Ventil${nr}_AusAn`,
        pause: `${base}.Steuerung.Pause`,
        zustand: `${base}.Steuerung.Zustand`,
        aktiv: `${base}.Steuerung.Aktiv`,
        schwelleSperre: `${base}.Steuerung.SchwelleSperre`,
        restzeit: `${base}.Steuerung.Restzeit`,
        restzeitAnzeige: `${base}.Steuerung.RestzeitAnzeige`,
        wiederholungenAktuel: `${base}.Steuerung.WiederholungenAktuel`,
        feuchtAnzeige: `${base}.Messwerte.FeuchtigkeitAnzeige`,
        externTempAnzeige: `${base}.Messwerte.ExternTempAnzeige`,
        wasserAnzeige: `${base}.Messwerte.WasserAnzeige`,
        letzteBewaesserung: `${base}.Messwerte.LetzteBewaesserung`,
        shwVergleich: `${base}.Schwelle.Vergleich`,
        shwFeuchtAktiv: `${base}.Schwelle.FeuchtigkeitAktiv`,
        shwFeuchtUnten: `${base}.Schwelle.FeuchtigkeitUnten`,
        shwFeuchtWert: `${base}.Schwelle.FeuchtigkeitWert`,
        shwTempAktiv: `${base}.Schwelle.TemperaturAktiv`,
        shwTempUnten: `${base}.Schwelle.TemperaturUnten`,
        shwTempWert: `${base}.Schwelle.TemperaturWert`,
        shwWasserAktiv: `${base}.Schwelle.WasserAktiv`,
        shwWasserUnten: `${base}.Schwelle.WasserUnten`,
        shwWasserOben: `${base}.Schwelle.WasserOben`,
        shwWasserVerzoegerung: `${base}.Schwelle.WasserVerzoegerung`,
        shwWasserVerzoegerungAus: `${base}.Schwelle.WasserVerzoegerungAus`,
        shwWasserLage: `${base}.Schwelle.WasserLage`,
        shwUeberschritten: `${base}.Schwelle.Ueberschritten`,
    };
}

function erzeugeVentilLaufzustand() {
    return {
        feuchtigkeitSensorAbo: '',
        temperaturSensorAbo: '',
        wasserSensorAbo: '',
        automatikTriggerAbo: '',
        feuchtigkeitSensorSub: null,
        temperaturSensorSub: null,
        wasserSensorSub: null,
        wasserGesperrt: false,
        pumpeFuellt: false,
        pumpeAusgangAn: null,
        wasserZielSeit: 0,
        wasserZielGesperrt: null,
        wasserVerzoegerTimer: null,
        wasserPause: false,
        endeTimer: null,
        restzeitTicker: null,
        laufEndeMs: 0,
        gesamtEndeMs: 0,
        wiederholungAktuell: 0,
        zyklusBeendetLaeuft: false,
        pauseGespeichert: false,
        gesamtRestBeiPause: 0,
        zyklusRestBeiPause: 0,
        startGrund: '',
    };
}

function buildVentile(P, eigeneStates, ventilAnzahl) {
    const count = Math.min(
        Math.max(parseInt(ventilAnzahl, 10) || C.VENTIL_ANZAHL_DEFAULT, C.VENTIL_ANZAHL_MIN),
        C.VENTIL_ANZAHL_MAX,
    );
    const ventile = [];
    for (let nr = 1; nr <= count; nr++) {
        const base = P.ventilBase(nr);
        const states = eigeneStates.filter((s) => s.id.startsWith(`${base}.`));
        ventile.push({
            nr,
            name: `Ventil ${nr}`,
            base,
            manuellAlt: nr === 1 ? `${base}.Steuerung.ManuellEin` : null,
            zielDefault: P.ventilZielDefault(nr),
            states,
            dp: erzeugeVentilDP(P, nr),
            lauf: erzeugeVentilLaufzustand(),
        });
    }
    return ventile;
}

module.exports = { buildVentile, erzeugeVentilDP };
