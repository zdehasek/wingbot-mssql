/*
 * @author David Menger
 */
'use strict';

const assert = require('assert');
const BotTokenStorage = require('../src/BotTokenStorage');
const mongodb = require('./mongodb');

const SENDER_ID = 'hello5';
const SENDER_ID2 = 'hello6';
const PAGE_ID = 'xy';


describe('<BotTokenStorage>', function () {

    /** @type {BotTokenStorage} */
    let bts;

    before(async () => {
        const db = await mongodb();

        bts = new BotTokenStorage(db);

        try {
            await db.dropCollection(bts._collectionName);
        } catch (e) {
            // suppress
        }
    });

    after(() => mongodb(true));

    describe('#getOrCreateToken()', () => {

        it('creates random token', async () => {
            const randomSenderId = `${Date.now()}`;

            const token = await bts.getOrCreateToken(randomSenderId, PAGE_ID);

            assert.strictEqual(token.senderId, randomSenderId);
            assert.strictEqual(typeof token.token, 'string');
        });

        it('creates token', async () => {
            let token = await bts.getOrCreateToken(SENDER_ID, PAGE_ID, () => Promise.resolve('randomToken'));

            assert.deepStrictEqual(token, {
                token: 'randomToken',
                senderId: SENDER_ID,
                pageId: PAGE_ID
            });

            token = await bts.getOrCreateToken(SENDER_ID, PAGE_ID, () => Promise.resolve('nothing'));

            assert.deepStrictEqual(token, {
                token: 'randomToken',
                senderId: SENDER_ID,
                pageId: PAGE_ID
            });
        });

        it('avoids collisions', async () => {
            const tokens = await Promise.all([
                bts.getOrCreateToken('a', PAGE_ID, () => Promise.resolve('fake')),
                bts.getOrCreateToken('a', PAGE_ID, () => Promise.resolve('another'))
            ]);

            assert.ok(tokens.every(t => t.senderId === 'a'
                && (t.token === 'fake' || t.token === 'another')));
        });

    });

    describe('#findByToken()', () => {

        it('is able to find token', async () => {
            bts = new BotTokenStorage(mongodb);

            let token = await bts.findByToken('nonexisting');

            assert.strictEqual(token, null);

            await bts.getOrCreateToken(SENDER_ID2, PAGE_ID, () => Promise.resolve('lookForAToken'));

            token = await bts.findByToken('lookForAToken');

            assert.deepStrictEqual(token, {
                token: 'lookForAToken',
                senderId: SENDER_ID2,
                pageId: PAGE_ID
            });
        });

        it('no token returns null response', async () => {
            const token = await bts.findByToken('');

            assert.strictEqual(token, null);
        });

    });

});
