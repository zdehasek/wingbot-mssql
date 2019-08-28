'use strict';

const mssql = require('mssql');
const { apiAuthorizer } = require('wingbot');

const CONFIG_ID = 'config';

/**
 * Storage for wingbot.ai conversation config
 *
 * @class
 */
class BotConfigStorage {

    /**
     *
     * @param {Promise<mssql.ConnectionPool>} pool
     */
    constructor (pool) {
        this._pool = pool;
    }

    /**
     * @param {object} newConfig
     */

    async _simpleUpdate (newConfig) {

        const cp = await this._pool;
        const r = cp.request();

        try {
            await r
                .input('CONFIG_ID', mssql.VarChar, CONFIG_ID)
                .input('blocks', mssql.Int, newConfig.blocks)
                .input('timestamp', mssql.BigInt, newConfig.timestamp)
                .query('UPDATE attachments SET id = @url, attachmentId = @attachmentId WHERE id = @CONFIG_ID');

        } catch (e) {

            throw e;
        }

        return true;
    }

    /**
     * Returns botUpdate API for wingbot
     *
     * @param {Function} [onUpdate] - async update handler function
     * @param {Function|string[]} [acl] - acl configuration
     * @returns {{updateBot:Function}}
     */
    api (onUpdate = () => Promise.resolve(), acl) {
        const storage = this;
        return {
            async updateBot (args, ctx) {
                if (!apiAuthorizer(args, ctx, acl)) {
                    return null;
                }
                await storage.invalidateConfig();
                await onUpdate();
                return true;
            }
        };
    }

    /**
     * Invalidates current configuration
     *
     * @returns {Promise}
     */
    async invalidateConfig () {
        const cp = await this._pool;
        const r = cp.request();

        return r
            .input('CONFIG_ID', mssql.VarChar, CONFIG_ID)
            .query('DELETE FROM botConfigStorage WHERE botConfigStorage.id=@CONFIG_ID');
    }

    /**
     * @returns {Promise<number>}
     */
    async getConfigTimestamp () {

        const cp = await this._pool;
        const r = cp.request();

        const { recordset } = await r
            .input('CONFIG_ID', mssql.VarChar, CONFIG_ID)
            .query('SELECT timestamp FROM botConfigStorage WHERE botConfigStorage.id=@CONFIG_ID');

        const [res] = recordset;
        //@TODO JSON.parse a vsude jinde kde pouzivam  Number

        return res ? Number(res.timestamp) : 0;
    }

    /**
     * @template T
     * @param {T} newConfig
     * @returns {Promise<T>}
     */
    async updateConfig (newConfig) {
        Object.assign(newConfig, { timestamp: Date.now() });

        const cp = await this._pool;
        const r = cp.request();

        const oldconfig = await this.getConfig();

        if (!oldconfig) {

            try {
                await r
                    .input('CONFIG_ID', mssql.VarChar, CONFIG_ID)
                    // @ts-ignore
                    .input('blocks', mssql.Text, newConfig.blocks || [])
                    // @ts-ignore
                    .input('timestamp', mssql.BigInt, newConfig.timestamp)
                    .query('INSERT INTO botConfigStorage (id, blocks, timestamp) VALUES (@CONFIG_ID, @blocks, @timestamp);');

            } catch (e) {
                // 2627 is unique constraint (includes primary key), 2601 is unique index
                if (e.number === 2601 || e.number === 2627) {
                    await this._simpleUpdate(newConfig);
                } else {

                    throw e;
                }
            }

        } else {

            await this._simpleUpdate(newConfig);
        }

        return newConfig;
    }

    /**
     * @returns {Promise<Object|null>}
     */
    async getConfig () {

        const cp = await this._pool;
        const r = cp.request();

        const { recordset } = await r
            .input('CONFIG_ID', mssql.VarChar, CONFIG_ID)
            .query('SELECT blocks, timestamp FROM botConfigStorage WHERE botConfigStorage.id=@CONFIG_ID');

        const [res] = recordset;

        return res ? { blocks: Number(res.blocks), timestamp: Number(res.timestamp) } : null;

    }

}

module.exports = BotConfigStorage;
