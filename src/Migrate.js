/**
 * @author David Menger
 */
'use strict';

const loadMigrationsIntoSet = require('migrate/lib/load-migrations');
const migrate = require('migrate');
const mssql = require('mssql');
const { format } = require('sqlstring');
const MigrationSet = require('./MigrationSet');

class Migrate {

    /**
     *
     * @param {Promise<mssql.ConnectionPool>} pool
     * @param {string} migrationsPath
     * @param {string} tableName
     */
    constructor (pool, migrationsPath, tableName = 'migrations') {
        this._pool = pool;
        this._tableName = tableName;
        this._migrationsPath = migrationsPath;
    }

    load (cb) {
        this._load()
            .then((set) => cb(null, set))
            .catch((e) => cb(e));
    }

    async _load () {
        const cp = await this._pool;
        try {
            const r = cp.request();
            const res = await r.query(`SELECT TOP 1 data FROM ${this._tableName} WHERE id=1`);
            const [item = null] = res.recordset;
            if (!item) {
                return { lastRun: null, migrations: [] };
            }
            return JSON.parse(item.data);
        } catch (e) {
            const r = cp.request();
            await r.query(`CREATE TABLE ${this._tableName} (id int, data text)`);
            return { lastRun: null, migrations: [] };
        }
    }

    save (set, cb) {
        this._save(set)
            .then(() => cb())
            .catch((e) => cb(e));
    }

    async _save (set) {
        const cp = await this._pool;
        const r = cp.request();

        await r
            .input('data', mssql.Text, JSON.stringify(set))
            .query(`MERGE INTO ${this._tableName} AS target
                USING (SELECT 1 as id) AS source (id)
                ON source.id = target.id
                WHEN MATCHED THEN
                    UPDATE SET data = @data
                WHEN NOT MATCHED THEN
                    INSERT (id, data) VALUES (1, @data);`);
    }

    migrate () {
        const query = async (string, ...args) => {
            const q = await this._pool;

            const r = q.request();

            return r.query(format(string, args));
        };

        const set = new MigrationSet(this, query);

        // @ts-ignore
        migrate.set = set;

        return new Promise((resolve, reject) => {
            loadMigrationsIntoSet({
                set,
                store: this,
                ignoreMissing: true,
                migrationsDirectory: this._migrationsPath
            }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    // @ts-ignore
                    set.up((er) => {
                        if (er) {
                            reject(er);
                        } else {
                            resolve();
                        }
                    });
                }
            });
        });
    }

}

module.exports = Migrate;
