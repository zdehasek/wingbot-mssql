/**
 * @author David Menger
 */
'use strict';

const MsSql = require('../src/MsSql');

const sql = new MsSql({
    user: 'SA',
    password: 'NeotravujPotvoro1',
    server: 'localhost',
    port: 1433,
    database: 'wingbotMssql',
    options: {
        encrypt: false
    }
});

after(async () => {
    const cp = await sql.connection();
    cp.close();
});

module.exports = sql;
