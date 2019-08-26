/*
 * @author David Menger
 */
'use strict';

/* eslint no-console: 0 */
/* eslint import/no-extraneous-dependencies: 0 */

let targetStage = process.env.NODE_ENV || 'development';

const args = process.argv.slice();

function abort (msg) {
    console.error('  %s', msg);
    process.exit(1);
}

let arg;

function required () {
    if (args.length) {
        return args.shift();
    }
    return abort(`${arg} requires an argument`);
}

// parse arguments

while (args.length) {
    arg = args.shift();
    switch (arg) {
        case '-s':
        case '--stage':
            // @ts-ignore
            targetStage = required();
            break;
        default:
            break;
    }
}

process.env.NODE_ENV = targetStage;

const webpack = require('webpack');
const path = require('path');
const fs = require('fs');
const CompressionPlugin = require('compression-webpack-plugin');
const webpackConfig = require('../webpack.config');
const renderTemplates = require('../lib/renderTemplates');
const config = require('../config');
const helpers = require('../lib/helpers');

webpackConfig.mode = targetStage === 'development'
    ? 'development'
    : 'production';

// enable CSS compression
webpackConfig.module.rules[0].use[2] = {
    loader: 'sass-loader',
    // @ts-ignore
    options: { outputStyle: 'compressed' }
};

// add definer
const definer = new webpack.DefinePlugin({
    'process.env': {
        NODE_ENV: JSON.stringify('production')
    }
});
webpackConfig.plugins.push(definer);

// add gzip
const gzip = new CompressionPlugin({
    // @ts-ignore
    filename: '[file].gz',
    algorithm: 'gzip',
    test: /\.(js|css)$/,
    threshold: 240,
    minRatio: 0.8
});
webpackConfig.plugins.push(gzip);

console.log(webpackConfig);

// returns a Compiler instance
// @ts-ignore
const compiler = webpack(webpackConfig);

// setup templating

const distPath = path.resolve(__dirname, '..', 'dist');
const viewsPath = path.resolve(__dirname, '..', 'views');

console.log('Cleaning up dist dir');

const files = fs.readdirSync(distPath);

for (const file of files) {
    if (file.match(/\.(js|html)(\.gz)?$/)) {
        fs.unlinkSync(path.join(distPath, file));
    }
}

console.log(`Building for stage: ${targetStage}`);

compiler.run((err, res) => {
    if (err || res.hasErrors()) {
        console.error('Build failed', err);
        if (res) {
            console.log(res.toString('minimal'));
        }
        process.exit(1);
    } else {
        console.log('Build is done.');
        console.log(res.toString('minimal'));

        config.apiUrl = `${config.apiUrl || ''}`;
        config.pageUrl = `${config.pageUrl || ''}`;
        config.environment = targetStage;

        renderTemplates.renderStaticFiles(config.statics, viewsPath, distPath, config, helpers)
            .then(() => {
                console.log('Templates are rendered.');
                process.exit(0);
            })
            .catch((e) => {
                console.error(e, e.stack); // eslint-disable-line
                process.exit(1);
            });
    }
});
