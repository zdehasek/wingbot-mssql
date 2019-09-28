'use strict';

// 'off' is too small for MS SQL like a column name, that's why there is itsOff instead

module.exports = {
    async up (next) {
        await this.query(`CREATE TABLE states (
            senderId varchar(73),
            pageId varchar(73),
            lock bigint,
            lastSendError nvarchar(max),
            itsOff nvarchar(32),
            state nvarchar(max),
            lastInteraction bigint

            CONSTRAINT PK_states PRIMARY KEY CLUSTERED (senderId, pageId)

        )`);

        await this.query('CREATE INDEX lastInteraction ON states (lastInteraction DESC)');

        next();
    },
    async down (next) {
        await this.query('DROP TABLE IF EXISTS states');
        next();
    }
};
