'use strict';

const crypto = require('crypto');

/**
 * @returns {Promise.<string>}
 */
function tokenFactory () {
    return new Promise((res, rej) => crypto.randomBytes(
        255,
        (err, buf) => (err ? rej(err) : res(buf.toString('base64')))
    ));
}

module.exports = tokenFactory;
