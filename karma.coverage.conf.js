/*
 * @author David Menger
 */
'use strict';

const karmaConfigurator = require('./test/karmaConfigurator');

module.exports = function karmaCoverageConfig (config) {
    config.set(karmaConfigurator(false, true));
};
