'use strict';

const { queryWithoutMigration: query } = require('../lib/mssql');

module.exports = {
    up: async (next) => {
        await query(`CREATE TABLE chatlogs (
            senderId varchar(73),
            pageId varchar(73),
            time varchar(73),
            request nvarchar(max),
            responses nvarchar(max),
            timestamp bigint,
            err varchar(73)

        )`);

        next();
    },
    down: async (next) => {
        await query('DROP TABLE IF EXISTS chatlogs');
        next();
    }
};
