'use strict';

const mssql = require('mssql');

const PAGE_SENDER_TIMESTAMP = 'page_sender_timestamp';

/**
 * Storage for conversation logs
 *
 * @class
 */
class ChatLogStorage {

    /**
     *
     * @param {Promise<mssql.ConnectionPool>} pool
     */
    constructor (pool, log = console) {
        this._pool = pool;
        this._log = log;
        this.muteErrors = true;
    }


    // @TODO create indexes pageId, senderId, timestamp

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

        //const orderBackwards = startAt && !endAt;
        
        if (startAt || endAt) {
            Object.assign(q, { timestamp: {} });
        }

        if (startAt) {
            Object.assign(q.timestamp, { $gte: startAt });
            r.input('startAt', mssql.BigInt, startAt);
            query += ' AND time > @startAt';
        }

        if (endAt) {
            Object.assign(q.timestamp, { $lte: endAt });
            query += ' AND time < @startAt';

        }

        query += ' ORDER BY time';

        // orderBackwards
        if (startAt && !endAt) {
            query += ' DESC';

        } else {
            query += ' ASC';

        }

       // console.log("QQQQQQQQQQQQQQQ",q);
       // console.log("queryqueryqueryquery",query);

        const { recordset } = await r
            .input('senderId', mssql.VarChar, senderId)
            .input('pageId', mssql.VarChar, pageId)
            .query(query);

        /*
        const res = await c.find(q)
            .limit(limit)
            .sort({ timestamp: orderBackwards ? 1 : -1 })
            .project({ _id: 0, time: 0 })
            .toArray();

        if (!orderBackwards) {
            res.reverse();
        }
        */
        //return res;
        return recordset
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

        console.log("log.request", log);
        console.log("LOGFYYYYY",JSON.stringify(log));


        const query = `INSERT INTO chatlogs 
                    (senderId, time, request, responses, pageId, timestamp, err) 
                    VALUES
                    (@senderId, @time, @request, @responses, @pageId, @timestamp, @err)`;


        this._pool
            .then(pool => pool.request()
                .input('senderId', mssql.VarChar, log.senderId)
                .input('time', mssql.VarChar, log.time)
                .input('request', mssql.NVarChar, JSON.stringify(log.request))
                .input('responses', mssql.NVarChar, JSON.stringify(log.responses))
                .input('pageId', mssql.VarChar, log.pageId || null)
                .input('timestamp', mssql.VarChar, log.timestamp || null)
                .input('err', mssql.VarChar, log.err || null)
                .query(query)).catch((err) => {
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
