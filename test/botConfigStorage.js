'use strict';

const assert = require('assert');
const pool = require('./testpool');

const BotConfigStorage = require('../src/BotConfigStorage');

const T = require('./long.json');

describe('<BotConfigStorage>', () => {

    /** @type {BotConfigStorage} */
    let botConfigStorage;

    before(async () => {

        botConfigStorage = new BotConfigStorage(pool.connection());
    });

    it('has api', async () => {
        const api = botConfigStorage.api();

        assert.equal(typeof api.updateBot, 'function');

        const res = await api.updateBot({}, { groups: ['a'], token: { groups: [{ group: 'a' }] } });

        assert.strictEqual(res, true);

        const res2 = await api.updateBot({}, { groups: ['b'], token: { groups: [{ group: 'a' }] } });

        assert.strictEqual(res2, null);
    });

    it('is able to update config', async () => {
        const cfgObj = { blocks: [{ obj: '1' }] };

        // save config
        const savedConfig = await botConfigStorage.updateConfig(cfgObj);

        assert.deepEqual(savedConfig.blocks, cfgObj.blocks);

        const cfgObj2 = { blocks: [{ obj: '2' }] };

        // save config
        const savedConfig2 = await botConfigStorage.updateConfig(cfgObj2);

        assert.deepEqual(savedConfig2.blocks, cfgObj2.blocks);

    });

    it('should be able to store and fetch, invalidate and update config under same timestamp', async () => {
        const cfgObj = { blocks: [{ obj: '1\n2' }, T] };

        // save config
        const savedConfig = await botConfigStorage.updateConfig(cfgObj);

        assert.deepEqual(savedConfig.blocks, cfgObj.blocks);

        // check for config timestamp
        const ts = await botConfigStorage.getConfigTimestamp();

        assert.strictEqual(ts, savedConfig.timestamp);

        // try another
        botConfigStorage = new BotConfigStorage(pool.connection());

        // load config
        const loadedConfig = await botConfigStorage.getConfig();

        assert.deepStrictEqual(loadedConfig, savedConfig);

        // invalidate config
        await botConfigStorage.invalidateConfig();

        const emptyTs = await botConfigStorage.getConfigTimestamp();
        const emptyConfig = await botConfigStorage.getConfig();

        assert.strictEqual(emptyTs, 0);
        assert.strictEqual(emptyConfig, null);
    });

});
