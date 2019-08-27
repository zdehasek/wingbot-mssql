/**
 * @author David Menger
 */
'use strict';

const { queryWithoutMigration: query } = require('../lib/mssql');

module.exports = {
    up: async (next) => {
        await query(`CREATE TABLE tokens (
            senderId varchar(73),
            pageId varchar(73),
            token varchar(400)

            CONSTRAINT PK_tokens PRIMARY KEY CLUSTERED (senderId, pageId)
        )`);

        // varchar(max) is invalid for use as a key column in an index
        await query('CREATE CLUSTERED INDEX tokens_token ON tokens (token)');


        next();
    },
    down: async (next) => {
        await query('DROP TABLE IF EXISTS tokens');
        next();
    }
};
