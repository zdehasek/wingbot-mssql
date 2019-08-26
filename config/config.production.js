/*
 * @author David Menger
 */
'use strict';

module.exports = {

    isProduction: true,

    pageUrl: 'https://webchat-staging.azurewebsites.net',

    apiUrl: 'https://webchat-staging.azurewebsites.net/api',

    wsUrl: 'wss://webchat-staging.azurewebsites.net',

    gaCode: '',

    logzioToken: '',

    mssql: {
        options: {
            encrypt: true
        }
    },

    deployMockData: false,

    security: {
        prefix: '_wc',
        requestTokenExpiration: 320, // seconds
        userCookieExpiration: 43200, // seconds (12 hours)
        testEnv: false
    },

    redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6380,
        password: process.env.REDIS_PASSWORD,
        tls: {
            servername: process.env.REDIS_HOST
        }
    }

};
