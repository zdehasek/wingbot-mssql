'use strict';

module.exports = {
    async up (next) {
        await this.query(`CREATE TABLE chatlogs (
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
    async down (next) {
        await this.query('DROP TABLE IF EXISTS chatlogs');
        next();
    }
};
