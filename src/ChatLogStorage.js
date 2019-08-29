'use strict';

const mssql = require('mssql');

/**
 * Storage for conversation logs
 *
 * @class
 */
class ChatLogStorage {

    /**
     *
     * @param {Promise<mssql.ConnectionPool>} pool
     * @param {{error:Function}} [log] - console like logger
     */
    constructor (pool, log = console) {
        this._pool = pool;
        this._log = log;
        this.muteErrors = true;
    }

    /**
     * @returns {Promise<mssql.Table>}
     */

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

        const cp = await this._pool;
        const r = cp.request();

        const top = limit
            ? `TOP ${parseInt(`${limit}`, 10)}`
            : '';

        let query = `SELECT ${top}
                    senderId, request, responses, pageId, timestamp, err
                    FROM chatlogs 
                    WHERE senderId=@senderId 
                    AND pageId=@pageId`;

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
            r.input('startAt', mssql.BigInt, startAt);
            query += ' AND timestamp >= @startAt';
        }

        if (endAt) {
            Object.assign(q.timestamp, { $lte: endAt });
            r.input('endAt', mssql.VarChar, endAt);
            query += ' AND timestamp <= @endAt';

        }

        query += ' ORDER BY timestamp';

        // orderBackwards
        if (startAt && !endAt) {
            query += ' ASC';

        } else {
            query += ' DESC';

        }

        let { recordset } = await r
            .input('senderId', mssql.VarChar, senderId)
            .input('pageId', mssql.VarChar, pageId)
            .query(query);

        // @ts-ignore
        recordset = recordset.map((o) => {
            // eslint-disable-next-line no-param-reassign
            o.responses = JSON.parse(o.responses);
            // eslint-disable-next-line no-param-reassign
            o.request = JSON.parse(o.request);
            // eslint-disable-next-line no-param-reassign
            o.timestamp = JSON.parse(o.timestamp);
            if (o.err === null) {
                delete o.err; // eslint-disable-line no-param-reassign
            }
            return o;
        });

        if (!orderBackwards) {
            recordset.reverse();
        }

        // @ts-ignore
        return recordset;
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

        const query = `
                    INSERT INTO chatlogs 
                        (senderId, time, request, responses, pageId, timestamp, err) 
                    VALUES
                        (@senderId, @time, @request, @responses, @pageId, @timestamp, @err)`;


        return this._pool
            .then(pool => pool.request()
                .input('senderId', mssql.VarChar, log.senderId)
                .input('time', mssql.VarChar, log.time)
                .input('request', mssql.NVarChar, JSON.stringify(log.request))
                .input('responses', mssql.NVarChar, JSON.stringify(log.responses))
                .input('pageId', mssql.VarChar, log.pageId || null)
                .input('timestamp', mssql.VarChar, log.timestamp || null)
                .input('err', mssql.VarChar, log.err || null)
                .query(query))
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

        const query = `INSERT INTO chatlogs 
                        (senderId, time, request, responses, pageId, timestamp, err) 
                    VALUES
                        (@senderId, @time, @request, @responses, @pageId, @timestamp, @err)`;


        return this._pool
            .then(pool => pool.request()
                .input('senderId', mssql.VarChar, log.senderId)
                .input('time', mssql.VarChar, log.time)
                .input('request', mssql.NVarChar, JSON.stringify(log.request))
                .input('responses', mssql.NVarChar, JSON.stringify(log.responses))
                .input('pageId', mssql.VarChar, log.pageId || null)
                .input('timestamp', mssql.VarChar, log.timestamp || null)
                .input('err', mssql.VarChar, log.err || null)
                .query(query))
            .catch((storeError) => {
                this._log.error('Failed to store chat log', storeError, log);

                if (!this.muteErrors) {
                    throw storeError;
                }
            });

    }

}

module.exports = ChatLogStorage;
