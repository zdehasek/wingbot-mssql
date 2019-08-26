/*
* @author David Menger
*/
'use strict';

const mongodb = require('mongodb'); // eslint-disable-line no-unused-vars

const PAGE_SENDER_TIMESTAMP = 'page_sender_timestamp';

/**
 * Storage for conversation logs
 *
 * @class
 */
class ChatLogStorage {

    /**
     *
     * @param {mongodb.Db|{():Promise<mongodb.Db>}} mongoDb
     * @param {string} collectionName
     * @param {{error:Function}} [log] - console like logger
     */
    constructor (mongoDb, collectionName = 'chatlogs', log = console) {
        this._mongoDb = mongoDb;
        this._collectionName = collectionName;
        this._log = log;

        /**
         * @type {mongodb.Collection}
         */
        this._collection = null;

        this.muteErrors = true;
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
            let indexExists;
            try {
                indexExists = await this._collection.indexExists(PAGE_SENDER_TIMESTAMP);
            } catch (e) {
                indexExists = false;
            }
            if (!indexExists) {
                await this._collection.createIndex({
                    pageId: 1,
                    senderId: 1,
                    timestamp: -1
                }, {
                    name: PAGE_SENDER_TIMESTAMP
                });
            }
        }
        return this._collection;
    }

    /**
     * Interate history
     * all limits are inclusive
     *
     * @param {string} senderId
     * @param {string} pageId
     * @param {number} [limit]
     * @param {number} [endAt] - iterate backwards to history
     * @param {number} [startAt] - iterate forward to last interaction
     */
    async getInteractions (senderId, pageId, limit = 10, endAt = null, startAt = null) {
        const c = await this._getCollection();

        const q = {
            senderId,
            pageId
        };

        const orderBackwards = startAt && !endAt;

        if (startAt || endAt) {
            Object.assign(q, { timestamp: {} });
        }

        if (startAt) {
            Object.assign(q.timestamp, { $gte: startAt });
        }

        if (endAt) {
            Object.assign(q.timestamp, { $lte: endAt });
        }

        const res = await c.find(q)
            .limit(limit)
            .sort({ timestamp: orderBackwards ? 1 : -1 })
            .project({ _id: 0, time: 0 })
            .toArray();

        if (!orderBackwards) {
            res.reverse();
        }

        return res;
    }

    /**
     * Log single event
     *
     * @param {string} senderId
     * @param {Object[]} responses - list of sent responses
     * @param {Object} request - event request
     * @param {Object} [metadata] - request metadata
     * @returns {Promise}
     */
    log (senderId, responses = [], request = {}, metadata = {}) {
        const log = {
            senderId,
            time: new Date(request.timestamp || Date.now()),
            request,
            responses
        };

        Object.assign(log, metadata);

        return this._getCollection()
            .then(c => c.insertOne(log))
            .catch((err) => {
                this._log.error('Failed to store chat log', err, log);

                if (!this.muteErrors) {
                    throw err;
                }
            });
    }

    /**
     * Log single event
     *
     * @method
     * @name ChatLog#error
     * @param {any} err - error
     * @param {string} senderId
     * @param {Object[]} [responses] - list of sent responses
     * @param {Object} [request] - event request
     * @param {Object} [metadata] - request metadata
     * @returns {Promise}
     */
    error (err, senderId, responses = [], request = {}, metadata = {}) {
        const log = {
            senderId,
            time: new Date(request.timestamp || Date.now()),
            request,
            responses,
            err: `${err}`
        };

        Object.assign(log, metadata);

        return this._getCollection()
            .then(c => c.insertOne(log))
            .catch((storeError) => {
                this._log.error('Failed to store chat log', storeError, log);

                if (!this.muteErrors) {
                    throw storeError;
                }
            });
    }

}

module.exports = ChatLogStorage;
