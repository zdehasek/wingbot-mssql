'use strict';

const { pool } = require('../lib/mssql');

const AttachmentCache = require('./AttachmentCache');


const AttachmentCache = new AttachmentCache(pool);

module.exports = { AttachmentCache};


/*
const StateStorage = require('./StateStorage');
const BotTokenStorage = require('./BotTokenStorage');
const ChatLogStorage = require('./ChatLogStorage');
const BotConfigStorage = require('./BotConfigStorage');
const NotificationsStorage = require('./NotificationsStorage');

module.exports = {
    StateStorage,
    BotTokenStorage,
    ChatLogStorage,
    BotConfigStorage,
    AttachmentCache,
    NotificationsStorage
};

*/
