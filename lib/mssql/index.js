/**
 * @author David Menger
 */
'use strict';

const mssql = require('mssql');
const { format } = require('sqlstring');
const path = require('path');
const log = require('../log');
const config = require('../../config');
const Migrate = require('./Migrate');

const cp = new mssql.ConnectionPool(config.mssql);

cp.on('error', (err) => {
    log.error('MSSQL ERROR', err);
});

const pool = cp.connect()
    .catch((e) => {
        log.error(e);
        setTimeout(() => process.exit(1), 400);
        return cp;
    });

async function queryWithoutMigration (string, ...args) {
    const q = await pool;

    const r = q.request();

    return r.query(format(string, args));
}

const migrationsPath = path.resolve(__dirname, '..', '..', 'migrations');

const migrate = new Migrate(pool, migrationsPath);

async function poolWithMigration () {
    const res = await pool;

    await migrate.migrate();

    return res;
}

const migratedPool = poolWithMigration()
    .catch((e) => {
        log.error(e);
        setTimeout(() => process.exit(1), 400);
        return cp;
    });

module.exports = {
    pool: migratedPool,
    queryWithoutMigration
};
