'use strict';

const mssql = require('mssql');
const deepMap = require('./deepMap');

const ISODatePattern = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(([+-]\d\d:\d\d)|Z)?$/i;


/**
 * @typedef {object} State
 * @prop {string} senderId
 * @prop {string} pageId
 * @prop {object} state
 */

/**
 * @typedef {object} StateCondition
 * @prop {string} [search]
 */

/**
 * Storage for chat states
 *
 * @class
 */
class StateStorage {

    /**
     * @param {Promise<mssql.ConnectionPool>} pool
     */
    constructor (pool) {
        this._pool = pool;
    }

    /**
     *
     * @param {string} senderId
     * @param {string} pageId
     * @returns {Promise<State|null>}
     */
    async getState (senderId, pageId) {

        const cp = await this._pool;

        const { recordset } = await cp.request()
            .input('senderId', mssql.VarChar, senderId)
            .input('pageId', mssql.VarChar, pageId)
            .query('SELECT TOP 1 * FROM states WHERE senderId=@senderId AND pageId=@pageId');

        const [res] = recordset;

        if (!res) {
            return null;
        }

        return {
            ...res,
            state: this._decodeState(res.state)
        };
    }

    /**
     * Load state from database and lock it to prevent another reads
     *
     * @param {string} senderId - sender identifier
     * @param {string} pageId - page identifier
     * @param {object} [defaultState] - default state of the conversation
     * @param {number} [timeout=300] - given default state
     * @returns {Promise<object>} - conversation state
     */
    async getOrCreateAndLock (senderId, pageId, defaultState = {}, timeout = 300) {

        const now = Date.now();
        const threshold = now - timeout;

        const cp = await this._pool;

        const res = await cp.request()
            .input('senderId', mssql.VarChar, senderId)
            .input('pageId', mssql.VarChar, pageId)
            .input('lock', mssql.BigInt, now)
            .input('threshold', mssql.BigInt, threshold)
            .query('UPDATE states SET lock = @lock WHERE senderId = @senderId AND pageId = @pageId AND lock < @threshold');

        if (res.rowsAffected[0] === 1) {
            // successfully locked

            return this.getState(senderId, pageId);
        }

        try {
            // not exists or conflict
            await this._insertState(cp, senderId, pageId, defaultState, now);

            return {
                senderId,
                pageId,
                lock: now,
                state: { ...defaultState }
            };
        } catch (e) {
            // 2627 is unique constraint (includes primary key), 2601 is unique index
            if (e.number === 2601 || e.number === 2627) {
                // for compatibility with MongDB connnector sending same error code
                e.code = 11000;
            }

            throw e;
        }
    }

    /**
     * Save the state to database
     *
     * @param {object} state - conversation state
     * @returns {Promise<object>}
     */
    async saveState (state) {
        const {
            senderId, pageId, lastSendError, off = false, lastInteraction
        } = state;

        const cp = await this._pool;

        const res = await cp.request()
            .input('senderId', mssql.VarChar, senderId)
            .input('pageId', mssql.VarChar, pageId)
            .input('lastSendError', mssql.NVarChar, lastSendError)
            .input('state', mssql.NVarChar, this._encodeState(state.state))
            .input('itsOff', mssql.VarChar, off ? 'true' : 'false')
            .input('lastInteraction', mssql.BigInt, lastInteraction)
            .query('UPDATE states SET lock = 0, state = @state, itsOff = @itsOff, lastInteraction = @lastInteraction WHERE senderId = @senderId AND pageId = @pageId');


        if (res.rowsAffected[0] === 0) {
            // nothing was updated so let's insert it

            await this._insertState(cp, senderId, pageId, state.state, 0, lastInteraction, off);
        }

        return state;
    }

    _decodeState (state) {
        const obj = JSON.parse(state);

        return deepMap(obj, (value) => {
            if (typeof value === 'string' && ISODatePattern.test(value)) {
                return new Date(value);
            }
            return value;
        });
    }

    _encodeState (state) {
        const obj = deepMap(state, (value) => {
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        });

        return JSON.stringify(obj);
    }

    async _insertState (cp, senderId, pageId, state, lock = 0, lastInt = null, off = false) {

        return cp.request()
            .input('senderId', mssql.VarChar, senderId)
            .input('pageId', mssql.VarChar, pageId)
            .input('lock', mssql.BigInt, lock)
            .input('state', mssql.NVarChar, this._encodeState(state))
            .input('itsOff', mssql.VarChar, off ? 'true' : 'false')
            .input('lastInteraction', mssql.BigInt, lastInt)
            .query('INSERT INTO states (senderId, pageId, lock, state, itsOff, lastInteraction) VALUES (@senderId, @pageId, @lock, @state, @itsOff, @lastInteraction)');
    }

    // @TODO Davide, getStates jsem uz nestihl.
    // našel jsem že MS SQL má taky metodu SKIP a LIMIT které se tu používají v MongoDB
    // https://docs.microsoft.com/en-us/dotnet/framework/data/adonet/ef/language-reference/skip-entity-sql
    // https://docs.microsoft.com/en-us/dotnet/framework/data/adonet/ef/language-reference/limit-entity-sql
    /**
     *
     * @param {StateCondition} condition
     * @param {number} limit
     * @param {string} lastKey
     * @returns {Promise<{data:State[],lastKey:string}>}
     */
    async getStates (condition = {}, limit = 20, lastKey = null) {
        const cp = await this._pool;

        let lastInteraction = 0;
        let skip = 0;

        if (lastKey !== null) {
            const key = JSON.parse(Buffer.from(lastKey, 'base64').toString('utf8'));

            if (key.skip) {
                ({ skip } = key);
            } else {
                ({ lastInteraction } = key);
                // Object.assign(useCondition, {
                //     lastInteraction: {
                //         $lte: new Date(key.lastInteraction)
                //     }
                // });
            }
        }

        const searchStates = typeof condition.search === 'string';

        let where = '';

        if (lastInteraction) {
            where = 'WHERE lastInteraction <= @lastInteraction';
        } else if (searchStates) {
            where = 'WHERE';
        }

        if (searchStates && lastInteraction) {
            where += ' AND';
        }

        if (searchStates) {
            where += ' senderId LIKE @search';
        }

        const res = await cp.request()
            .input('offset', mssql.BigInt, skip)
            .input('limit', mssql.BigInt, limit + 1)
            .input('lastInteraction', mssql.BigInt, lastInteraction)
            .input('search', mssql.VarChar, `${condition.search}%`)
            .query(`SELECT * FROM states ${where} ORDER BY lastInteraction DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);

        let { recordset: data } = res;

        let nextLastKey = null;
        if (limit !== null && data.length > limit) {
            if (searchStates) {
                nextLastKey = Buffer.from(JSON.stringify({
                    skip: skip + limit
                })).toString('base64');
            } else {
                const last = data[data.length - 1];
                nextLastKey = Buffer.from(JSON.stringify({
                    lastInteraction: last.lastInteraction
                })).toString('base64');
            }

            // @ts-ignore
            data = data.slice(0, limit);
        }

        return {
            data: data.map((camp) => this._mapState(camp)),
            lastKey: nextLastKey
        };
    }

    _mapState (state) {
        if (!state) {
            return null;
        }

        // eslint-disable-next-line no-param-reassign
        state.state = this._decodeState(state.state);

        // eslint-disable-next-line no-param-reassign
        state.itsOff = state.itsOff === 'true' || state.itsOff === true;

        // eslint-disable-next-line no-param-reassign
        state.lastInteraction = new Date(typeof state.lastInteraction === 'string'
            ? parseInt(state.lastInteraction, 10)
            : state.lastInteraction);

        delete state._id; // eslint-disable-line
        delete state.lock; // eslint-disable-line
        delete state.off; // eslint-disable-line
        delete state.lastSendError // eslint-disable-line
        delete state.score // eslint-disable-line

        return state;
    }

}

module.exports = StateStorage;
