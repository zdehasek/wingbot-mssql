/**
 * @author David Menger
 */
'use strict';

const { queryWithoutMigration: query } = require('../lib/mssql');

module.exports = {
    up: async (next) => {
        await query(`CREATE TABLE botConfigStorage (
            id varchar(73),
            blocks text,
            timestamp bigint
            
            CONSTRAINT PK_botConfigStorage PRIMARY KEY NONCLUSTERED (id)
        )`);

        next();
    },
    down: async (next) => {
        await query('DROP TABLE IF EXISTS botConfigStorage');
        next();
    }
};
