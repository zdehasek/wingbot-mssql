/*
 * @author David Menger
 */
'use strict';

const environment = process.env.NODE_ENV || 'development';

const config = {
    lang: 'en',

    title: {
        default: 'Webchat',
        suffix: ''
    },

    description: 'Chatbot Solutions solutions for Enterprise.',

    region: process.env.REGION || 'eu-west-1',

    environment,

    accountId: process.env.ACCOUNT_ID || '0',

    isProduction: false,

    basePath: '/',

    apiUrl: 'http://localhost:3000/api',

    pageUrl: 'http://localhost:3000',

    wsUrl: 'ws://localhost:3000',

    wsEnabled: true,

    prefix: process.env.PREFIX || 'webchat',

    bucket: process.env.BUCKET || null,

    appSecret: process.env.APP_SECRET || 'B793183CE9B6E46D558422D6435D8DE96CA5B28AD802413EE215D39D7A3C4B76',

    cors: process.env.CORS || 'http://localhost:3000',

    poolingTimeout: 10000, // 10s

    mssql: {
        user: process.env.SQL_USER || 'SA',
        password: process.env.SQL_PASSWORD || 'NeotravujPotvoro1',
        server: process.env.SQL_HOST || 'localhost',
        port: parseInt(process.env.SQL_PORT || '1433', 10),
        database: process.env.SQL_DB || 'wingbotMssql',
        options: {
            encrypt: false
        }
    },

    overrideAppSecrets: {
        '652f3f7c-ff0e-44c6-98a0-fe41c2687f3e': 'abc:)',
        '652f3f7c-ff0e-44c6-98a0-fe41c2687f3f': 'F39C47043C3ABF13DEDA8B269E03D44F854926DB27AE86BDFCA7F27A8AF95282'
    },

    genesys: {
        // url: 'https://www.csas.cz/onlinechat/server/cometd'
        url: 'https://www.csast.csas.cz/onlinechat/server/cometd',
        targetAppId: '652f3f7c-ff0e-44c6-98a0-fe41c2687f3f',
        genesysAppId: '652f3f7c-ff0e-44c6-98a0-fe41c2687f0f',
        listenTimeout: 35000
    },

    security: {
        prefix: '_wc',
        requestTokenExpiration: 320, // seconds
        userCookieExpiration: 120, // seconds,
        testEnv: true
    },

    deployMockData: true,

    redis: null, /* {
        port: 6379, // Redis port
        host: '127.0.0.1', // Redis host
        family: 4, // 4 (IPv4) or 6 (IPv6)
        // password: 'auth',
        db: 0
    }, */

    statics: {
        index: {
            view: 'index',
            title: 'Webchat'
        },
        error: {
            view: 'error',
            title: 'Page not found'
        }
    },

    gaCode: ''
};

/**
 * [initialize description]
 *
 * @param {Object} cfg
 * @param {string} env
 */
function initialize (cfg, env = 'development') {
    try {
        // @ts-ignore
        const configuration = module.require(`./config.${env}`);

        // deeper object assign
        Object.keys(configuration)
            .forEach((key) => {
                if (typeof cfg[key] === 'object'
                    && typeof configuration[key] === 'object') {

                    // eslint-disable-next-line no-param-reassign
                    if (cfg[key] === null) cfg[key] = {};

                    Object.assign(cfg[key], configuration[key]);
                } else {
                    Object.assign(cfg, { [key]: configuration[key] });
                }
            });
    } catch (e) {
        /* eslint no-console: 0 */
        console.log(`Failed to load configuration for ENV: ${env}`);
    }

    return cfg;
}

initialize(config, process.env.NODE_ENV);

module.exports = config;
