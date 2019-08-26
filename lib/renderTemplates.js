/*
 * @author David Menger
 */
'use strict';

const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

let loadedPartials = null;

function readFile (fileName) {
    return new Promise((res, rej) => {
        fs.readFile(fileName, 'utf8', (err, data) => (err ? rej(err) : res(data)));
    });
}

function writeFile (fileName, data) {
    return new Promise((res, rej) => {
        fs.writeFile(fileName, data, err => (err ? rej(err) : res()));
    });
}

function listDirectory (directory) {
    return new Promise((res, rej) => {
        fs.readdir(directory, (err, files) => (err ? rej(err) : res(files)));
    });
}

function loadPartials (directory) {
    return listDirectory(directory)
        .then(files => Promise.all(
            files
                .map(file => readFile(path.join(directory, file))
                    .then(partial => ({ partial, file: file.replace(/\.hbs$/, '') })))
        ));
}

function ensureDirectories (basePath, fileName) {
    if (!fileName || fileName.indexOf(path.sep) === -1) {
        return Promise.resolve();
    }
    const chunks = fileName.split(path.sep);
    const directory = path.join(basePath, chunks.shift());

    return new Promise((resolve, reject) => {
        fs.access(directory, (err) => {
            if (err && err.code === 'ENOENT') {
                fs.mkdir(directory, (e) => {
                    if (e) {
                        reject(e);
                    } else {
                        resolve(ensureDirectories(basePath, chunks.join(path.sep)));
                    }
                });
            } else if (err) {
                reject(err);
            } else {
                resolve(ensureDirectories(basePath, chunks.join(path.sep)));
            }
        });
    });
}

function prepareHbs (directory, knownHelpers) {
    if (loadedPartials) {
        return loadedPartials;
    }

    loadedPartials = loadPartials(directory)
        .then((partials) => {
            loadedPartials = Promise.resolve();
            handlebars.registerHelper(knownHelpers);
            partials.forEach((partial) => {
                handlebars.registerPartial(partial.file, partial.partial);
            });
        });
    return loadedPartials;
}

function renderTemplate (viewsPath, view, data, knownHelpers) {

    const sourceFileName = path.join(viewsPath, `${view}.hbs`);
    const partialsDirectory = path.join(viewsPath, 'partials');

    return prepareHbs(partialsDirectory, knownHelpers)
        .then(() => readFile(sourceFileName))
        .then((template) => {
            const tpl = handlebars.compile(template, { knownHelpers });
            return tpl(data);
        });
}

function getDestPath (view) {
    let destPath = view;

    if (!destPath.match(/(index|error)$/)) {
        destPath += `${path.sep}index.html`;
    } else {
        destPath += '.html';
    }

    return destPath;
}

function renderStatic (staticDef, viewsPath, distPath, data, knownHelpers) {
    const destPath = getDestPath(staticDef.view);
    const destFileName = path.join(distPath, destPath);

    const useData = Object.assign({}, data, {
        viewMeta: staticDef,
        distPath
    });

    return ensureDirectories(distPath, destPath)
        .then(() => renderTemplate(viewsPath, staticDef.view, useData, knownHelpers))
        .then(content => writeFile(destFileName, content));
}

function renderStaticFiles (statics, viewsPath, distPath, data, knownHelpers) {
    const ret = Object.keys(statics)
        .map(staticDef => renderStatic(
            statics[staticDef],
            viewsPath,
            distPath,
            data,
            knownHelpers
        ));
    return Promise.all(ret);
}

module.exports = {
    renderStaticFiles,
    renderStatic
};
