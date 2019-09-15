'use strict';

module.exports = {
    async up (next) {
        await this.query(`CREATE TABLE tokens (
            senderId varchar(73),
            pageId varchar(73),
            token varchar(400)

            CONSTRAINT PK_tokens PRIMARY KEY CLUSTERED (senderId, pageId)
        )`);

        // varchar(max) is invalid for use as a key column in an index
        // @TODO FIX await query('CREATE CLUSTERED INDEX tokens_token ON tokens (token)');


        next();
    },
    async down (next) {
        await this.query('DROP TABLE IF EXISTS tokens');
        next();
    }
};
