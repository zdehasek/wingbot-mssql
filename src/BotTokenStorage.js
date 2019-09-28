'use strict';

const mssql = require('mssql');
const tokenFactory = require('./tokenFactory');


/**
 * @typedef {object} Token
 * @prop {string} senderId
 * @prop {string} pageId
 * @prop {string} token
 */

/**
 * Storage for webview tokens
 *
 * @class
 */
class BotTokenStorage {

    /**
     *
     * @param {Promise<mssql.ConnectionPool>} pool
     */
    constructor (pool) {
        this._pool = pool;
    }

    /**
     *
     * @param {string} token
     * @returns {Promise<Token|null>}
     */
    async findByToken (token) {
        if (!token) {
            return null;
        }

        const cp = await this._pool;
        const r = cp.request();

        const { recordset } = await r
            .input('token', mssql.VarChar, token)
            .query('SELECT senderId, token, pageId FROM tokens WHERE tokens.token=@token');

        const [res] = recordset;

        return res ? {
            senderId: res.senderId,
            token: res.token,
            pageId: res.pageId
        } : null;
    }

    async _simpleSelect (senderId, pageId) {

        const cp = await this._pool;
        const r = cp.request();

        const { recordset } = await r
            .input('senderId', mssql.VarChar, senderId)
            .input('pageId', mssql.VarChar, pageId)
            .query('SELECT token FROM tokens WHERE senderId=@senderId AND pageId = @pageId');

        const [res] = recordset;

        return res || null;
    }

    async _simpleUpSert (senderId, pageId, token, upSertOption) {

        if (!upSertOption && upSertOption !== 'update' && upSertOption !== 'insert') {
            throw new Error('Missing/Wrong  upSertOption');
        }

        const cp = await this._pool;
        const r = cp.request();

        const upSert = {
            update: 'UPDATE tokens SET token = @token WHERE senderId = @senderId AND pageId = @pageId',
            insert: 'INSERT INTO tokens (senderId, pageId, token) VALUES (@senderId, @pageId, @token);'
        };

        await r
            .input('senderId', mssql.VarChar, senderId)
            .input('pageId', mssql.VarChar, pageId)
            .input('token', mssql.VarChar, token)
            .query(upSert[upSertOption]);


        return true;
    }

    /**
     *
     * @param {string} senderId
     * @param {string} pageId
     * @param {{(): Promise<string>}} createToken
     * @returns {Promise<Token|null>}
     */
    async getOrCreateToken (senderId, pageId, createToken = tokenFactory) {
        if (!senderId) {
            throw new Error('Missing sender ID');
        }

        const temporaryInsecureToken = `>${Math.random() * 0.9}${Date.now()}`;

        let res = await this._simpleSelect(senderId, pageId);
        if (!res) {

            try {
                await this._simpleUpSert(senderId, pageId, temporaryInsecureToken, 'insert');

            } catch (e) {
                // 2627 is unique constraint (includes primary key), 2601 is unique index
                if (e.number === 2601 || e.number === 2627) {
                    await this._simpleUpSert(senderId, pageId, temporaryInsecureToken, 'update');
                    // @TODO fix this else bug everywhere
                } else {

                    throw e;
                }
            }

        }

        res = await this._simpleSelect(senderId, pageId);

        // @ts-ignore
        if (res.token === temporaryInsecureToken) {

            const token = await createToken();

            Object.assign(res, { token });

            await this._simpleUpSert(senderId, pageId, token, 'update');

        // @ts-ignore
        } else if (res.token.match(/^>[0-9.]+$/)) {
            // probably collision, try it again
            await this._wait(400);

            res = await this._simpleSelect(senderId, pageId);

            if (!res) {
                throw new Error('Cant create token');
            }
        }

        return {
            senderId,
            // @ts-ignore
            token: res.token,
            pageId
        };
    }

    _wait (ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

}

module.exports = BotTokenStorage;
