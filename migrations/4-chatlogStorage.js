'use strict';

module.exports = {
    async up (next) {
        await this.query(`CREATE TABLE chatlogs (
            senderId varchar(73),
            pageId varchar(73),
            time varchar(73),
            request nvarchar(max),
            responses nvarchar(max),
            metadata nvarchar(max),
            timestamp bigint,
            flag varchar(3),
            err varchar(73)

        )`);

        await this.query('CREATE INDEX page_sender_timestamp ON chatlogs (pageId, senderId, timestamp DESC)');
        await this.query('CREATE INDEX flag ON chatlogs (flag, timestamp DESC)');

        next();
    },
    async down (next) {
        await this.query('DROP TABLE IF EXISTS chatlogs');
        next();
    }
};
