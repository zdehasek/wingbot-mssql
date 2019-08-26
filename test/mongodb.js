/*
 * @author David Menger
 */
'use strict';

const mongodb = require('mongodb');

const CONNECTION_STRING = 'mongodb://127.0.0.1:27017';

let settings;
if (process.env.DB_TYPE === 'cosmos') {
    try {
        // @ts-ignore
        settings = module.require('./dbSettings');
    } catch (e) {
        console.warn('missing test/dbSettings.js for cosmosdb'); // eslint-disable-line
    }
}

if (!settings) {
    settings = {
        db: CONNECTION_STRING,
        options: { useNewUrlParser: true }
    };
}

let connectedMongoDb;

async function connect (disconnect) {
    if (disconnect && !connectedMongoDb) {
        return null;
    }

    if (disconnect) {
        return connectedMongoDb
            .then((connection) => {
                connectedMongoDb = null;
                return connection.close();
            });
    }

    if (!connectedMongoDb) {
        connectedMongoDb = mongodb.connect(settings.db, settings.options);
    }

    return connectedMongoDb
        .then(connection => connection.db('wingbot-mongodb-test'));
}

module.exports = connect;
