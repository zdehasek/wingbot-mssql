'use strict';

const mssql = require('mssql');

/**
 * Cache storage for Facebook attachments
 *
 * @class
 */
class AttachmentCache {

    /**
     *
     * @param {Promise<mssql.ConnectionPool>} pool
     */
    constructor (pool) {
        this._pool = pool;
    }

    /**
     *
     * @param {string} url
     * @returns {Promise<number|null>}
     */
    async findAttachmentByUrl (url) {
        const cp = await this._pool;
        const r = cp.request();
        const query = 'SELECT attachmentId FROM attachments WHERE attachments.id=@url';

        const { recordset } = await r
            .input('url', mssql.VarChar, url)
            .query(query);

        const [res] = recordset;

        return res ? res.attachmentId : null;
    }

    /**
     * @param {string} url
     * @param {number} attachmentId
     */

    async _simpleUpdate (url, attachmentId) {

        const cp = await this._pool;
        const r = cp.request();

        await r
            .input('url', mssql.VarChar, url)
            .input('attachmentId', mssql.Int, attachmentId)
            .query('UPDATE attachments SET id = @url, attachmentId = @attachmentId WHERE id = @url');

        return true;
    }

    /**
     *
     * @param {string} url
     * @param {number} attachmentId
     * @returns {Promise}
     */
    async saveAttachmentId (url, attachmentId) {

        const cp = await this._pool;
        const r = cp.request();

        const oldAttachmentId = await this.findAttachmentByUrl(url);

        if (!oldAttachmentId) {

            try {
                await r
                    .input('url', mssql.VarChar, url)
                    .input('attachmentId', mssql.Int, attachmentId)
                    .query('INSERT INTO attachments (id, attachmentId) VALUES (@url, @attachmentId);');

            } catch (e) {
                // 2627 is unique constraint (includes primary key), 2601 is unique index
                if (e.number === 2601 || e.number === 2627) {
                    return this._simpleUpdate(url, attachmentId);
                }

                throw e;
            }

        } else if (attachmentId === oldAttachmentId) {

            return true;

        } else {

            return this._simpleUpdate(url, attachmentId);
        }

        return true;
    }

}

module.exports = AttachmentCache;
