'use strict';

const C = require('./constants');

function commonSchalter(name, desc, def = false, labels = { false: 'Aus', true: 'Ein' }) {
    return {
        name,
        desc,
        type: 'boolean',
        role: 'switch',
        read: true,
        write: true,
        def,
        states: labels,
        custom: { materialize: { false: C.FARBE.AUS, true: C.FARBE.AN } },
    };
}

function commonAnzeige(name, desc, def = false, labels = { false: 'Aus', true: 'An' }) {
    return {
        name,
        desc,
        type: 'boolean',
        role: 'indicator',
        read: true,
        write: false,
        def,
        states: labels,
        custom: { materialize: { false: C.FARBE.AUS, true: C.FARBE.AN } },
    };
}

function commonTaster(name, desc, label) {
    return {
        name,
        desc,
        type: 'boolean',
        role: 'button',
        read: true,
        write: true,
        def: false,
        states: { false: label, true: label },
        custom: { materialize: { false: C.FARBE.INFO, true: C.FARBE.INFO } },
    };
}

function commonSperre(name, desc) {
    return {
        name,
        desc,
        type: 'boolean',
        role: 'indicator',
        read: true,
        write: false,
        def: false,
        states: { false: 'Frei', true: 'Gesperrt' },
        custom: { materialize: { false: C.FARBE.AN, true: C.FARBE.AUS } },
    };
}

module.exports = {
    commonSchalter,
    commonAnzeige,
    commonTaster,
    commonSperre,
};
