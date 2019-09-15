'use strict';


module.exports = {
    async up (next) {
        await this.query(`CREATE TABLE botConfigStorage (
            id varchar(73),
            blocks text,
            timestamp bigint

            CONSTRAINT PK_botConfigStorage PRIMARY KEY NONCLUSTERED (id)
        )`);

        next();
    },
    async down (next) {
        await this.query('DROP TABLE IF EXISTS botConfigStorage');
        next();
    }
};
