'use strict';


module.exports = {
    async up (next) {
        await this.query(`CREATE TABLE attachments (
            id varchar(73),
            attachmentId int

            CONSTRAINT PK_attachments PRIMARY KEY CLUSTERED (id)
        )`);

        next();
    },
    async down (next) {
        await this.query('DROP TABLE IF EXISTS attachments');
        next();
    }
};
