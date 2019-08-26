/*
 * @author Pragonauts
 */
'use strict';

/**
 * @param {Function} callback
 * @returns {{ log: Function, info: Function, warn: Function, error: Function }}
 */
function loggerOveridderFactory (callback) {

    return ['info', 'log', 'warn', 'error']
        .reduce((obj, level) => Object.assign(obj, {
            [level] (message, data, ...args) {

                let entry;
                if (data && typeof data === 'object' && typeof data.level === 'string') {
                    entry = data;
                } else {
                    entry = { level, data };
                }

                console[level](message, data, ...args); // eslint-disable-line

                if (args.length !== 0) {
                    entry.args = args;
                }

                let text = level;

                if (message instanceof Error) {
                    entry.stack = message.stack;
                    text = message.message;
                } else if (data instanceof Error) {
                    entry.stack = data.stack;
                    text = data.message;
                }

                if (typeof message === 'object' && message !== null) {
                    callback(Object.assign(entry, {
                        message: text
                    }, message));
                } else {
                    callback(Object.assign(entry, { message }));
                }
            }
        }), {});
}

module.exports = loggerOveridderFactory;
