/**
 * @author David Menger
 */
'use strict';

const { pool } = require('../lib/mssql');

after(async () => {
    const cp = await pool;
    cp.close();
});

module.exports = pool;
