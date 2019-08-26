'use strict';

module.exports = {

    isProduction: true,

    pageUrl: 'https://webchat-staging.azurewebsites.net',

    apiUrl: 'https://webchat-staging.azurewebsites.net/api',

    wsUrl: 'wss://webchat-staging.azurewebsites.net',

    mssql: {
        options: {
            encrypt: true
        }
    },

    deployMockData: true,

    security: {
        prefix: '_wc',
        requestTokenExpiration: 320, // seconds
        userCookieExpiration: 43200, // seconds (12 hours)
        testEnv: false
    }

};
