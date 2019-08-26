/**
 * @author David Menger
 */
'use strict';

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz01'.split('');
const FOURTY_YEARS = 1261440000000;
const USER_ID_LEN = 12;


function fromBase (string) {
    let result = 0;
    let val;

    for (let i = string.length - 1, n = 0; i >= 0; i--) {
        val = CHARS.indexOf(string[i]);

        result += val * (62 ** n);
        n++;
    }

    return result;
}

function parseMid (mid) {
    const [from, to, ts, wid] = mid.split('.');

    if (!from || !to || !wid || !ts) {
        return null;
    }

    return {
        from,
        to,
        wid,
        ts: fromBase(ts)
    };
}

function parsedMidToCid ({ from, to }) {
    if (from < to) {
        return `${from}.${to}`;
    }
    return `${to}.${from}`;
}

function toBase (number) {
    let result = '';
    let integer = number || 0;

    do {
        result = CHARS[integer % 62] + result;
        integer = Math.floor(integer / 62);
    } while (integer > 0);

    return result;
}

function shorten (id) {
    return toBase(typeof id === 'string' ? parseInt(id, 10) : id);
}

function senderRecipientToCid (senderId, recipientId) {
    return senderId < recipientId
        ? `${senderId}.${recipientId}`
        : `${recipientId}.${senderId}`;
}

function createWid (long = false) {
    const minus = long ? 0 : FOURTY_YEARS;
    const floor = long ? 1000000 : 1000;
    const add = long ? 1 : 0;
    const len = long ? 11 : 7;
    return `${shorten(Math.floor((add + Math.random()) * floor))}${shorten(Date.now() - minus)}`.substr(0, len);
}

function encode (z) {
    let r = '';
    let n = (z || Math.floor(Math.random() * 4294967293)) - 2147483647;
    do {
        r = DIGITS[n & 0x3f] + r; // eslint-disable-line no-bitwise
        n >>>= 6; // eslint-disable-line no-bitwise
    } while (n !== 0);
    return r;
}

function token (len) {
    let r = '';
    const max = Math.ceil(len / 4.84);
    for (let k = 0; k < max; k++) {
        r += encode();
    }
    return r.substr(0, len);
}

function createUserId (len = USER_ID_LEN) {
    return `${encode(Math.floor(Date.now() / 1000))}${token(len - 6)}`.substr(0, len);
}

function createParsedMid (from, to, ts, wid = createWid()) {
    return {
        from,
        to,
        wid,
        ts
    };
}

function parsedMidToString (parsedMid) {
    const {
        wid, ts, from, to
    } = parsedMid;

    return `${from}.${to}.${shorten(ts)}.${wid}`;
}

module.exports = {
    parseMid,
    parsedMidToCid,
    createParsedMid,
    parsedMidToString,
    senderRecipientToCid,
    createUserId,
    createWid
};
