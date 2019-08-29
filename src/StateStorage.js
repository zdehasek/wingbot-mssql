'use strict';

const mssql = require('mssql');

/**
 * @typedef {Object} State
 * @prop {string} senderId
 * @prop {string} pageId
 * @prop {Object} state
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

        return this._simpleSelect(senderId, pageId);

    }

    async _simpleSelect (senderId, pageId, lock = null) {

        const cp = await this._pool;
        const r = cp.request();

        let query = 'SELECT * FROM states WHERE senderId=@senderId AND pageId=@pageId';

        if (lock !== null) {
            r.input('lock', mssql.NVarChar, lock);
            query += ' AND lock < @lock';

        }

        let { recordset } = await r
            .input('senderId', mssql.VarChar, senderId)
            .input('pageId', mssql.VarChar, pageId)
            .query(query);


        // @ts-ignore
        recordset = recordset.map((o) => {
            // eslint-disable-next-line no-param-reassign
            o.state = JSON.parse(o.state);

            return o;
        });

        const [res] = recordset;

        return res || null;
    }

    async _simpleUpSert (
        upSertOption,
        senderId,
        pageId,
        lock,
        lastSendError = null,
        itsOff = null,
        state = null
    ) {

        if (!upSertOption && upSertOption !== 'update' && upSertOption !== 'insert') {
            throw new Error('Missing/Wrong  upSertOption');
        }

        const cp = await this._pool;
        const r = cp.request();


        const upSert = {
            update: 'UPDATE states SET lock = @lock WHERE senderId = @senderId AND pageId = @pageId',
            insert: 'INSERT INTO states VALUES (@senderId, @pageId, @lock, @lastSendError, @itsOff, @state, @lastInteraction)'
        };

        try {
            await r
                .input('senderId', mssql.VarChar, senderId)
                .input('pageId', mssql.VarChar, pageId)
                .input('lock', mssql.NVarChar, lock)
                .input('lastSendError', mssql.NVarChar, lastSendError)
                .input('itsOff', mssql.VarChar, itsOff)
                .input('state', mssql.NVarChar, state)
                .input('lastInteraction', mssql.NVarChar, null)
                .query(upSert[upSertOption]);

        } catch (e) {

            throw e;
        }

        return true;
    }

    /**
     * Load state from database and lock it to prevent another reads
     *
     * @param {string} senderId - sender identifier
     * @param {string} pageId - page identifier
     * @param {Object} [defaultState] - default state of the conversation
     * @param {number} [timeout=300] - given default state
     * @returns {Promise<Object>} - conversation state
     */
    async getOrCreateAndLock (senderId, pageId, defaultState = {}, timeout = 300) {

        const now = Date.now();
        const lt = now - timeout;

        // calling function WITH lock
        const res = await this._simpleSelect(senderId, pageId, lt);

        if (!res) {

            try {

                await this._simpleUpSert('insert', senderId, pageId, now, null, false, JSON.stringify(defaultState));

            } catch (e) {

                // 2627 is unique constraint (includes primary key), 2601 is unique index
                if (e.number === 2601 || e.number === 2627) {
                    // for compatibility with MongDB connnector sending same error code
                    e.code = 11000;
                }

                throw e;
            }

        } else {

            await this._simpleUpSert('update', senderId, pageId, now);

        }
        // calling function withou lock So I'm albe to retrun row even it's loked
        return this._simpleSelect(senderId, pageId);
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
        const c = await this._getCollection();

        let cursor;
        const useCondition = {};
        let skip = 0;

        if (lastKey !== null) {
            const key = JSON.parse(Buffer.from(lastKey, 'base64').toString('utf8'));

            if (key.skip) {
                ({ skip } = key);
            } else {
                Object.assign(useCondition, {
                    lastInteraction: {
                        $lte: new Date(key.lastInteraction)
                    }
                });
            }
        }

        const searchStates = typeof condition.search === 'string';

        if (searchStates) {
            if (this._doesNotSupportTextIndex) {
                Object.assign(useCondition, {
                    name: { $regex: condition.search, $options: 'i' }
                });
            } else {
                Object.assign(useCondition, {
                    $text: { $search: condition.search }
                });
            }
            cursor = c
                .find(useCondition)
                .limit(limit + 1)
                .skip(skip);
            if (!this._doesNotSupportTextIndex) {
                cursor
                    .project({ score: { $meta: 'textScore' } })
                    .sort({ score: { $meta: 'textScore' } });
            }
        } else {
            cursor = c
                .find(useCondition)
                .limit(limit + 1)
                .sort({ lastInteraction: -1 });
        }

        let data = await cursor.toArray();

        let nextLastKey = null;
        if (limit !== null && data.length > limit) {
            if (searchStates) {
                nextLastKey = Buffer.from(JSON.stringify({
                    skip: skip + limit
                })).toString('base64');
            } else {
                const last = data[data.length - 1];
                nextLastKey = Buffer.from(JSON.stringify({
                    lastInteraction: last.lastInteraction.getTime()
                })).toString('base64');
            }

            data = data.slice(0, limit);
        }

        return {
            data: data.map(camp => this._mapState(camp)),
            lastKey: nextLastKey
        };
    }

    _mapState (state) {
        if (!state) {
            return null;
        }

        delete state._id; // eslint-disable-line
        delete state.lock; // eslint-disable-line
        delete state.off; // eslint-disable-line
        delete state.lastSendError // eslint-disable-line
        delete state.score // eslint-disable-line

        return state;
    }

    /**
     * Save the state to database
     *
     * @param {Object} state - conversation state
     * @returns {Promise<Object>}
     */
    async saveState (state) {
        Object.assign(state, {
            lock: 0
        });

        const { senderId, pageId } = state;

        try {
            await this._simpleUpSert('insert', senderId, pageId, state.lock);

        } catch (e) {
            // 2627 is unique constraint (includes primary key), 2601 is unique index
            if (e.number === 2601 || e.number === 2627) {
                await this._simpleUpSert('update', senderId, pageId, state.lock);

            } else {
                throw e;
            }
        }

        return state;
    }

}

module.exports = StateStorage;
