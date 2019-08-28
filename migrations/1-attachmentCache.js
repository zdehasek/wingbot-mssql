'use strict';

const { queryWithoutMigration: query } = require('../lib/mssql');

module.exports = {
    up: async (next) => {
        await query(`CREATE TABLE attachments (
            id varchar(73),
            attachmentId int
            
            CONSTRAINT PK_attachments PRIMARY KEY CLUSTERED (id)


        )`);

        next();


    },
    down: async (next) => {
        await query('DROP TABLE IF EXISTS attachments');
        next();
    }
};
