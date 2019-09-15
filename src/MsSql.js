/**
 * @author David Menger
 */
'use strict';

const mssql = require('mssql');
const path = require('path');
const Migrate = require('./Migrate');


class MsSql {

    /**
     *
     * @param {object} config
     * @param {string} config.user
     * @param {string} config.password;
     * @param {string} config.server
     * @param {number} config.port
     * @param {string} config.database
     * @param {object} config.options
     * @param {boolean} config.options.encrypt
     * @param {string|null} migrationsDir
     * @param {console} log
     */
    constructor (config, migrationsDir = null, log = console) {
        this._config = config;
        this._migrationsDir = migrationsDir || path.resolve(__dirname, '..', 'migrations');
        this._log = log;

        this._pool = null;
    }

    async _createConnectionPoll () {
        try {
            const cp = new mssql.ConnectionPool(this._config);

            cp.on('error', (err) => {
                this._log.error('MSSQL ERROR', err);
            });

            const pool = cp.connect();

            const connection = await pool;

            const migrate = new Migrate(pool, this._migrationsDir);

            await migrate.migrate();

            return connection;
        } catch (e) {
            this._log.error('MSSQL ERROR', e);
            await new Promise((r) => setTimeout(r, 400));
            process.exit(1);
            throw e;
        }
    }

    /**
     * Get connection pool for storages
     *
     * @returns {Promise<mssql.ConnectionPool>}
     */
    connection () {
        if (!this._pool) {
            this._pool = this._createConnectionPoll();
        }
        return this._pool;
    }

}

module.exports = MsSql;
