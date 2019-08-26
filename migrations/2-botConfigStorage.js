/**
 * @author David Menger
 */
'use strict';

const { queryWithoutMigration: query } = require('../lib/mssql');

module.exports = {
    up: async (next) => {
        await query(`CREATE TABLE botConfigStorage (
            id varchar(73),
            blocks int,
            timestamp bigint

        )`);

       // await query('CREATE CLUSTERED INDEX cid_timestamp ON events (cid, timestamp DESC)');
       //             CONSTRAINT PK_ PRIMARY KEY NONCLUSTERED (mid)


        next();
    },
    down: async (next) => {
        await query('DROP TABLE IF EXISTS botConfigStorage');
        next();
    }
};
