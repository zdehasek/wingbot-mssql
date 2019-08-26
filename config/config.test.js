/*
 * @author David Menger
 */
'use strict';

module.exports = {
    isProduction: false,

    db: {
        db: 'wingbot-mssql'
    },

    prefix: process.env.PREFIX || 'wingbotMssql',

    security: {
        prefix: '_wc',
        requestTokenExpiration: 320, // seconds
        userCookieExpiration: 120, // seconds,
        testEnv: true
    }
};
