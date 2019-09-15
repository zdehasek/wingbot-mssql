'use strict';

// const { pool } = require('../lib/mssql');

const StateStorage = require('./StateStorage');
const BotTokenStorage = require('./BotTokenStorage');
const ChatLogStorage = require('./ChatLogStorage');
const BotConfigStorage = require('./BotConfigStorage');
const NotificationsStorage = require('./NotificationsStorage');
const AttachmentCache = require('./AttachmentCache');
const MsSql = require('./MsSql');

module.exports = {
    StateStorage,
    BotTokenStorage,
    ChatLogStorage,
    BotConfigStorage,
    AttachmentCache,
    NotificationsStorage,
    MsSql
};
