/*
 * @author David Menger
 */
'use strict';

const express = require('express');
const webpack = require('webpack');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');
const config = require('../config');
const renderTemplates = require('../lib/renderTemplates');
const helpers = require('../lib/helpers');
const webpackConfig = require('../webpack.config');
const lambdaTester = require('../lib/lambdaTester');
const log = require('../lib/log');
const auth = require('../lib/auth');
const subscribtions = require('../lib/subscribtions');
const { eventReceived } = require('../routes/eventReceived');
const { webhook } = require('../routes/webhook');

const distPath = path.join(__dirname, '..', 'dist');
const viewsPath = path.join(__dirname, '..', 'views');

const app = express();

if (config.environment === 'development') {
    const webpackDevMiddleware = module.require('webpack-dev-middleware');
    // @ts-ignore
    const compiler = webpack(Object.assign(webpackConfig, {
        devtool: 'cheap-module-eval-source-map'
    }));

    app.use(webpackDevMiddleware(compiler, {
        publicPath: '/',
        stats: 'minimal'
    }));
}

app.use('/', express.static(distPath));

const cfgFile = path.join(__dirname, '..', 'serverless.yml');

const api = lambdaTester.yamlParser(cfgFile);

Object.assign(config, {
    development: true
});

fs.watch(viewsPath, { recursive: true }, (e, filename) => {
    let prom;
    if (filename.match(/^partials/)) {
        prom = renderTemplates
            .renderStaticFiles(config.statics, viewsPath, distPath, config, helpers)
            .then(() => console.log('Updated all templates')); // eslint-disable-line
    } else {
        const withoutExt = filename.replace(/\.hbs$/, '');
        const viewDef = Object.keys(config.statics)
            .map(key => config.statics[key])
            .find(def => def.view === withoutExt);

        if (!viewDef) {
            return;
        }

        prom = renderTemplates.renderStatic(viewDef, viewsPath, distPath, config, helpers)
            .then(() => console.log(`Updated template: ${viewDef.view}`)); // eslint-disable-line
    }

    prom.catch(e => console.error(e, e.stack)); // eslint-disable-line
});


if (config.environment === 'development') {
    const testbot = module.require('../routes/testbot');

    app.use('/bot', express.json(), testbot);
}

app.use(cookieParser());

app.use('/authframe', (req, res) => {
    const referer = req.get('referer');

    if (!referer || !referer.startsWith('https://wbhome.flyto.cloud/')) {
        res.set('X-Frame-Options', 'DENY');
    }

    if (!req.cookies.helloserver) {
        res.cookie('helloserver', `d-${(new Date()).toISOString()}`, {
            httpOnly: true,
            secure: true
        });
    }

    res.set({
        'Content-type': 'text/html; charset=utf-8'
    })
        .send(`<html><body><pre>${JSON.stringify(req.headers, undefined, 2)}\n\n${JSON.stringify(req.cookies, undefined, 2)}</pre></body></html>`);
});

app.options(/^\/api\//, (req, res) => {
    res.set('Allow', 'GET,HEAD,OPTIONS,POST,PUT');
    res.set('Access-Control-Allow-Origin', config.cors);
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Headers', 'content-type,authorization');
    res.send();
});

app.use('/api', bodyParser.text({ type: () => true }), api);

const server = http.createServer(app);

if (config.wsEnabled) {

    const wss = new WebSocket.Server({ server });

    const PING = 15000;

    wss.on('connection', (ws, req) => {

        let [, authToken = null] = req.url.match(/token=([^&]+)/) || [];
        if (authToken) authToken = decodeURIComponent(authToken);

        auth.authorize(req.headers, null, { authToken })
            .then(({ uid, cid: channelId }) => {
                const sendFn = (message) => {
                    ws.send(JSON.stringify(message));
                };

                let lastPing = Date.now();
                let lastDeliveredPing = lastPing;

                let pingInterval = setInterval(() => {
                    const pingThreshold = lastPing - PING;

                    if (lastDeliveredPing < pingThreshold) {
                        console.log('#terminating-inactive-socket'); // eslint-disable-line
                        ws.terminate();
                    } else {
                        lastPing = Date.now();
                        sendFn({ ping: lastPing });
                    }
                }, PING);

                ws.on('message', (message) => {
                    let event;

                    try {
                        event = JSON.parse(message.toString());
                    } catch (e) {
                        log.warn('unknown event', message);
                        return;
                    }

                    if (event.ping && !event.pong) {
                        sendFn({ pong: Date.now(), ping: event.ping });
                        return;
                    }

                    if (event.ping && event.pong) {
                        lastDeliveredPing = event.ping;
                        return;
                    }

                    if (!event.recipient) {
                        console.warn('#message-no-recipient', message); // eslint-disable-line
                        return;
                    }

                    // eslint-disable-next-line no-console
                    // console.log('#message', message);

                    eventReceived(event, sendFn, channelId, uid)
                        .catch((e) => {
                            if (e.status === 403) {
                                log.info(e);
                                ws.terminate();
                            } else {
                                log.error(e);
                            }
                        });
                });

                ws.on('close', (message) => {
                    // eslint-disable-next-line no-console
                    console.log('#close', message);
                    subscribtions.unsubscribe(sendFn);
                    clearInterval(pingInterval);
                    pingInterval = null;
                });

                ws.on('upgrade', (message) => {
                    // eslint-disable-next-line no-console
                    console.log('#upgrade', message);
                });

                ws.on('error', (message) => {
                    // eslint-disable-next-line no-console
                    console.log('#error', message);
                });
            })
            .catch((e) => {
                console.log('#unauthorized', e); // eslint-disable-line
                ws.terminate();
            });
    });
}

const defaultPort = config.isProduction ? 1337 : 3000;
const port = process.env.PORT || defaultPort;

renderTemplates.renderStaticFiles(config.statics, viewsPath, distPath, config, helpers)
    .then(() => {
        server.listen(port, () => {
            // eslint-disable-next-line no-console
            console.log(`Example app listening on port ${port}!`);

            // attach the events
            subscribtions.setAppEventListener(webhook);
        });
    })
    .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e, e.stack);
        process.exit(1);
    });
