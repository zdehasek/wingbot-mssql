'use strict';

const assert = require('assert');
const ChatLogStorage = require('../src/ChatLogStorage');
const pool = require('./testpool');

const SENDER_ID = 'hello';


describe('<ChatLogStorage>', function () {

    /** @type {ChatLogStorage} */
    let chl;

    before(async () => {

        chl = new ChatLogStorage(pool.connection());

    });

    describe('#log()', () => {

        it('stores data without error', async () => {
            chl.muteErrors = false;

            await chl.log(SENDER_ID, [{ response: 1 }], { req: 1 });
        });

        it('mutes errors', async () => {
            await chl.log(SENDER_ID);
        });

    });

    describe('#getInteractions()', () => {

        it('should return stored interactions', async () => {
            const timestamp = Date.now();
            const firstTs = timestamp - 1000;
            await chl.log('abc', [{ response: 1 }], { req: 1 }, { pageId: '2', timestamp: firstTs, flag: 'a' });
            await chl.log('abc', [{ response: 2 }], { req: 2 }, { pageId: '2', timestamp, flag: 'b' });

            let data = await chl.getInteractions('abc', '2', 2);

            assert.deepEqual(data, [
                {
                    pageId: '2',
                    request: {
                        req: 1
                    },
                    responses: [
                        {
                            response: 1
                        }
                    ],
                    flag: 'a',
                    senderId: 'abc',
                    timestamp: firstTs
                },
                {
                    pageId: '2',
                    request: {
                        req: 2
                    },
                    responses: [
                        {
                            response: 2
                        }
                    ],
                    flag: 'b',
                    senderId: 'abc',
                    timestamp
                }
            ]);

            data = await chl.getInteractions('abc', '2', 1, firstTs);

            assert.deepEqual(data, [
                {
                    pageId: '2',
                    request: {
                        req: 1
                    },
                    responses: [
                        {
                            response: 1
                        }
                    ],
                    flag: 'a',
                    senderId: 'abc',
                    timestamp: firstTs
                }
            ]);

            data = await chl.getInteractions('abc', '2', 2, null, firstTs);

            assert.deepEqual(data, [
                {
                    pageId: '2',
                    request: {
                        req: 1
                    },
                    responses: [
                        {
                            response: 1
                        }
                    ],
                    flag: 'a',
                    senderId: 'abc',
                    timestamp: firstTs
                },
                {
                    pageId: '2',
                    request: {
                        req: 2
                    },
                    responses: [
                        {
                            response: 2
                        }
                    ],
                    flag: 'b',
                    senderId: 'abc',
                    timestamp
                }
            ]);

            data = await chl.getInteractions('a', null, 2, null, firstTs);

            assert.deepEqual(data, [
                {
                    pageId: '2',
                    request: {
                        req: 1
                    },
                    responses: [
                        {
                            response: 1
                        }
                    ],
                    flag: 'a',
                    senderId: 'abc',
                    timestamp: firstTs
                }
            ]);
        });

    });

    describe('#error()', () => {

        it('stores error without fail', async () => {
            chl.muteErrors = false;

            await chl.error(new Error('something failed'), SENDER_ID, [{ response: 1 }], { req: 1 });
        });

        it('mutes errors', async () => {
            chl = new ChatLogStorage(pool.connection());

            await chl.error(new Error('something failed'), SENDER_ID);
        });

    });

});
