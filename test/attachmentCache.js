'use strict';

const assert = require('assert');
const AttachmentCache = require('../src/AttachmentCache');
const pool = require('./testpool');

const TEST_URL = 'abc';

describe('<AttachmentCache>', function () {

    /** @type {AttachmentCache} */
    let attachmentCache;

    before(async () => {

        attachmentCache = new AttachmentCache(pool);
    });

    after(async () => {

        const cp = await pool;

        const r = cp.request();

        await r.query('TRUNCATE TABLE attachments');

    });


    it.only('should be able to store and fetch the cached item', async () => {
        const nothing = await attachmentCache.findAttachmentByUrl(TEST_URL);

        assert.strictEqual(nothing, null);

        // save to cache
        await attachmentCache.saveAttachmentId(TEST_URL, 1);

        const something = await attachmentCache.findAttachmentByUrl(TEST_URL);

        assert.strictEqual(something, 1);


    });

});
