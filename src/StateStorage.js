/*
* @author David Menger
*/
'use strict';

const mongodb = require('mongodb'); // eslint-disable-line no-unused-vars

const USER_INDEX = 'user-page-index';
const LAST_INTERACTION_INDEX = 'last-interaction';
const SEARCH = 'search-text';

/**
 * @typedef {Object} State
 * @prop {string} senderId
 * @prop {string} pageId
 * @prop {Object} state
 */

/**
 * @typedef {Object} StateCondition
 * @prop {string} [search]
 */

/**
 * Storage for chat states
 *
 * @class
 */
class StateStorage {

    /**
     *
     * @param {mongodb.Db|{():Promise<mongodb.Db>}} mongoDb
     * @param {string} collectionName
     */
    constructor (mongoDb, collectionName = 'states') {
        this._mongoDb = mongoDb;
        this._collectionName = collectionName;

        /**
         * @type {mongodb.Collection}
         */
        this._collection = null;
        this._doesNotSupportTextIndex = false;
    }

    /**
     * @returns {Promise<mongodb.Collection>}
     */
    async _getCollection () {
        if (this._collection === null) {
            if (typeof this._mongoDb === 'function') {
                const db = await this._mongoDb();
                this._collection = db.collection(this._collectionName);
            } else {
                this._collection = this._mongoDb.collection(this._collectionName);
            }

            await this._ensureIndexes([
                {
                    index: { senderId: 1, pageId: 1 },
                    options: { name: USER_INDEX, unique: true, dropDups: true }
                },
                {
                    index: { lastInteraction: -1 },
                    options: { name: LAST_INTERACTION_INDEX }
                },
                {
                    index: { '$**': 'text' },
                    options: { name: SEARCH },
                    isTextIndex: true
                }
            ]);
        }
        return this._collection;
    }

    async _ensureIndexes (indexes) {
        let existing;
        try {
            existing = await this._collection.indexes();
        } catch (e) {
            existing = [];
        }

        await Promise.all(existing
            .filter(e => !['_id_', '_id'].includes(e.name) && !indexes.some(i => e.name === i.options.name))
            .map(e => this._collection.dropIndex(e.name)));

        await Promise.all(indexes
            .filter(i => !existing.some(e => e.name === i.options.name))
            .map(i => this._collection
                .createIndex(i.index, i.options)
                // @ts-ignore
                .catch((e) => {
                    if (i.isTextIndex) {
                        this._doesNotSupportTextIndex = true;
                    } else {
                        throw e;
                    }
                })));
    }

    /**
     *
     * @param {string} senderId
     * @param {string} pageId
     * @returns {Promise<State|null>}
     */
    async getState (senderId, pageId) {
        const c = await this._getCollection();
        return c.findOne({ senderId, pageId }, { projection: { _id: 0 } });
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

        const c = await this._getCollection();

        const $setOnInsert = {
            state: defaultState,
            lastSendError: null,
            off: false
        };

        const $set = {
            lock: now
        };

        const $lt = now - timeout;

        const res = await c.findOneAndUpdate({
            senderId,
            pageId,
            lock: { $lt }
        }, {
            $setOnInsert,
            $set
        }, {
            upsert: true,
            returnOriginal: false,
            projection: {
                _id: 0
            }
        });

        return res.value;
    }

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

        const c = await this._getCollection();

        const { senderId, pageId } = state;

        await c.updateOne({
            senderId, pageId
        }, {
            $set: state
        }, {
            upsert: true
        });

        return state;
    }

}

module.exports = StateStorage;
