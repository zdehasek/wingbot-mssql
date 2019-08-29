'use strict';

const { queryWithoutMigration: query } = require('../lib/mssql');

// 'off' is too small for MS SQL like a column name, that's why there is itsOff instead

module.exports = {
    up: async (next) => {
        await query(`CREATE TABLE states (
            senderId varchar(73),
            pageId varchar(73),
            lock bigint,
            lastSendError nvarchar(max),
            itsOff nvarchar(32),
            state nvarchar(max),
            lastInteraction bigint
            
            CONSTRAINT PK_states PRIMARY KEY CLUSTERED (senderId, pageId)

        )`);

        next();
    },
    down: async (next) => {
        await query('DROP TABLE IF EXISTS states');
        next();
    }
};
