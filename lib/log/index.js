/*
 * @author Pragonauts
 */
'use strict';

const config = require('../../config');
const loggerOveridderFactory = require('./loggerOveridderFactory');

let logger = console;

if (config.logzioToken) {

    const logzio = module.require('logzio-nodejs').createLogger({
        token: config.logzioToken,
        host: 'listener.logz.io',
        type: config.prefix,
        protocol: 'https',
        debug: !config.isProduction
    });

    logger = loggerOveridderFactory(obj => logzio.log(obj));

    logger.sendAndClose = () => logzio.sendAndClose();
} else {
    logger.sendAndClose = () => {};
}

// overide logger here
module.exports = logger;
