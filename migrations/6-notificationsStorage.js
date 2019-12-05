'use strict';

// TODO primary keys
// CONSTRAINT PK_states PRIMARY KEY CLUSTERED (senderId, pageId)
// await this.query('CREATE INDEX lastInteraction ON states (lastInteraction DESC)');

module.exports = {
    async up (next) {
        await this.query(`CREATE TABLE notificationTasks (
            campaignId varchar(73),
            senderId varchar(73),
            pageId varchar(73),
            sent nvarchar(max)
  
        )`);

        await this.query(`CREATE TABLE notificationCampaigns (
            id varchar(73),
            name text,
            startAt nvarchar(32),
            active int

        )`);

        await this.query(`CREATE TABLE notificationSubscribtions (
            senderId varchar(73),
            pageId varchar(73),
            lock bigint,
            lastSendError nvarchar(max),
            itsOff nvarchar(32),
            state nvarchar(max),
            lastInteraction bigint

        )`);


        next();
    },
    async down (next) {
        await this.query('DROP TABLE IF EXISTS notificationTasks');
        await this.query('DROP TABLE IF EXISTS notificationCampaigns');
        await this.query('DROP TABLE IF EXISTS notificationSubscribtions');
        next();
    }
};
