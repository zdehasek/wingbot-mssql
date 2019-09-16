/*
 * @author David Menger
 */
'use strict';

function deepMap (obj, iterator) {
    let iterate;
    let res;
    let keyVal;

    if (Array.isArray(obj)) {
        iterate = obj;
        res = new Array(obj.length);
        keyVal = (k, i) => ({ key: i, val: k });
    } else {
        iterate = Object.keys(obj);
        res = {};
        keyVal = key => ({ key, val: obj[key] });
    }

    return iterate
        .reduce((result, k, i) => {
            const { key, val } = keyVal(k, i);

            const goDeeper = typeof val === 'object'
                && !(val instanceof Date)
                && (val !== null)
                && (val !== undefined);

            // eslint-disable-next-line no-param-reassign
            result[key] = goDeeper ? deepMap(val, iterator) : iterator(val, key, obj);

            return Object.assign(result, {
                [key]: goDeeper ? deepMap(val, iterator) : iterator(val, key, obj)
            });
        }, res);
}

module.exports = deepMap;
