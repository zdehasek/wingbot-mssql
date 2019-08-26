/**
 * @author David Menger
 */
'use strict';

const mongodb = require('mongodb');

const { ObjectID } = mongodb;

/**
 * @typedef Target {Object}
 * @prop {string} senderId
 * @prop {string} pageId
 */

/**
 * @typedef Subscribtion {Object}
 * @prop {string} senderId
 * @prop {string} pageId
 * @prop {string[]} subs
 */

/**
 * @typedef Campaign {Object}
 * @prop {string} id
 * @prop {string} name
 *
 * Tatgeting
 *
 * @prop {string[]} include
 * @prop {string[]} exclude
 *
 * Stats
 *
 * @prop {number} sent
 * @prop {number} succeeded
 * @prop {number} failed
 * @prop {number} unsubscribed
 * @prop {number} delivery
 * @prop {number} read
 * @prop {number} notSent
 * @prop {number} leaved
 * @prop {number} queued
 *
 * Interaction
 *
 * @prop {string} action
 * @prop {Object} [data]
 *
 * Setup
 *
 * @prop {boolean} sliding
 * @prop {number} slide
 * @prop {number} slideRound
 * @prop {boolean} active
 * @prop {boolean} in24hourWindow
 * @prop {number} startAt
 */

/**
 * @typedef Task {Object}
 * @prop {string} id
 * @prop {string} pageId
 * @prop {string} senderId
 * @prop {string} campaignId
 * @prop {number} enqueue
 * @prop {number} [read]
 * @prop {number} [delivery]
 * @prop {number} [sent]
 * @prop {number} [insEnqueue]
 * @prop {boolean} [reaction] - user reacted
 * @prop {number} [leaved] - time the event was not sent because user left
 */


const MAX_TS = 9999999999999;
const COSMO_LIMIT = 999;

class NotificationsStorage {

    /**
     *
     * @param {mongodb.Db|{():Promise<mongodb.Db>}} mongoDb
     * @param {string} collectionsPrefix
     */
    constructor (mongoDb, collectionsPrefix = '') {
        this._mongoDb = mongoDb;

        this.taksCollection = `${collectionsPrefix}notification-tasks`;

        this.campaignsCollection = `${collectionsPrefix}notification-campaigns`;

        this.subscribtionsCollection = `${collectionsPrefix}notification-subscribtions`;

        /**
         * @type {Map<string,mongodb.Collection>}
         */
        this._collections = new Map();
    }

    /**
     * @param {string} collectionName
     * @returns {Promise<mongodb.Collection>}
     */
    async _getCollection (collectionName) {
        if (!this._collections.has(collectionName)) {
            /** @type {mongodb.Collection} */
            let collection;
            if (typeof this._mongoDb === 'function') {
                const db = await this._mongoDb();
                collection = db.collection(collectionName);
            } else {
                collection = this._mongoDb.collection(collectionName);
            }
            this._collections.set(collectionName, collection);

            // attach indexes
            switch (collectionName) {
                case this.taksCollection:
                    await this._ensureIndexes(collection, [
                        {
                            index: {
                                pageId: 1, senderId: 1, campaignId: 1, sent: -1
                            },
                            options: { unique: true, name: 'unique_task' }
                        }, {
                            index: { enqueue: 1 },
                            options: { name: 'enqueue' }
                        }, {
                            index: {
                                pageId: 1, senderId: 1, sent: -1, read: 1
                            },
                            options: { name: 'search_by_read' }
                        }, {
                            index: {
                                pageId: 1, senderId: 1, sent: -1, delivery: 1
                            },
                            options: { name: 'search_by_delivery' }
                        }, {
                            index: {
                                campaignId: 1, leaved: -1, reaction: -1
                            },
                            options: { name: 'search_left_or_reacted' }
                        }
                    ]);
                    break;
                case this.subscribtionsCollection:
                    await this._ensureIndexes(collection, [
                        {
                            index: { pageId: 1, senderId: 1 },
                            options: { unique: true, name: 'subscriber' }
                        }, {
                            index: { subs: 1, pageId: 1 },
                            options: { name: 'subs' }
                        }
                    ]);
                    break;
                case this.campaignsCollection:
                    await this._ensureIndexes(collection, [
                        {
                            index: { id: 1 },
                            options: { unique: true, name: 'identifier' }
                        }, {
                            index: { active: -1, startAt: -1 },
                            options: { name: 'startAt' }
                        }
                    ]);
                    break;
                default:
                    break;
            }
        }
        return this._collections.get(collectionName);
    }

    async _ensureIndexes (collection, indexes) {
        let existing;
        try {
            existing = await collection.indexes();
        } catch (e) {
            existing = [];
        }

        await Promise.all(indexes
            .filter(i => !existing.some(e => e.name === i.options.name))
            .map(i => collection
                .createIndex(i.index, i.options)));
    }

    /**
     *
     * @param {Object} tasks
     * @returns {Promise<Task[]>}
     */
    async pushTasks (tasks) {

        // upsert through unique KEY (only single sliding campaign in queue)
        // [campaignId,senderId,pageId,sent]
        // maybe without unique key at dynamodb

        const c = await this._getCollection(this.taksCollection);

        const res = await c.bulkWrite(tasks.map((task) => {
            const {
                campaignId, senderId, pageId, sent
            } = task;

            const $set = Object.assign({}, task);

            const filter = {
                campaignId, senderId, pageId, sent
            };

            delete $set.campaignId;
            delete $set.senderId;
            delete $set.pageId;
            delete $set.sent;

            return {
                updateOne: {
                    filter,
                    update: {
                        $set,
                        $inc: { ups: 1 },
                        $min: { insEnqueue: task.enqueue }
                    },
                    upsert: true
                }
            };
        }));

        const findMissingIds = tasks
            .reduce((arr, {
                campaignId, senderId, pageId, sent
            }, i) => {
                if (typeof res.upsertedIds[i] !== 'undefined') {
                    return arr;
                }
                arr.push({
                    i,
                    filter: {
                        campaignId, senderId, pageId, sent
                    }
                });
                return arr;
            }, []);

        const missingIds = new Map();

        if (findMissingIds.length > 0) {
            await Promise.all(findMissingIds
                .map(({ filter, i }) => c.findOne(filter, {
                    projection: {
                        _id: 1, insEnqueue: 1, enqueue: 1, ups: 1
                    }
                })
                    .then((found) => {
                        const id = typeof found._id === 'string'
                            ? found._id
                            : found._id.toHexString();
                        missingIds.set(i, {
                            id,
                            insEnqueue: found.insEnqueue,
                            enqueue: found.insEnqueue === found.enqueue
                                && found.enqueue !== MAX_TS && found.ups !== 1
                                ? found.enqueue + 1
                                : found.enqueue
                        });
                    })));
        }

        return tasks.map((task, i) => {
            let override;
            if (typeof res.upsertedIds[i] !== 'undefined') {
                override = { id: res.upsertedIds[i].toHexString(), insEnqueue: task.enqueue };
            } else {
                override = missingIds.get(i);
            }
            return Object.assign({}, task, override);
        });
    }

    _mapGenericObject (obj) {
        if (!obj) {
            return null;
        }

        const id = typeof obj._id === 'string'
            ? obj._id
            : obj._id.toHexString();

        delete obj._id; // eslint-disable-line no-param-reassign

        return Object.assign(obj, { id });
    }

    _mapCampaign (camp) {
        if (!camp) {
            return null;
        }

        delete camp._id; // eslint-disable-line

        return camp;
    }

    async popTasks (limit, until = Date.now()) {
        const c = await this._getCollection(this.taksCollection);
        const pop = [];

        let go = true;
        while (go) {
            const found = await c.findOneAndUpdate({
                enqueue: { $lte: until }
            }, {
                $set: {
                    enqueue: MAX_TS,
                    insEnqueue: MAX_TS,
                    ups: 0
                }
            }, {
                sort: { enqueue: 1 },
                returnOriginal: false
            });
            if (found.value) {
                pop.push(this._mapGenericObject(found.value));
                go = pop.length < limit;
            } else {
                go = false;
            }
        }

        return pop;
    }

    /**
     *
     * @param {string} campaignId
     * @param {boolean} [sentWithoutReaction]
     * @param {string} [pageId]
     */
    async getUnsuccessfulSubscribersByCampaign (
        campaignId,
        sentWithoutReaction = false,
        pageId = null
    ) {

        const c = await this._getCollection(this.taksCollection);

        const condition = { campaignId, leaved: null };

        if (pageId) Object.assign(condition, { pageId });
        if (sentWithoutReaction) {
            Object.assign(condition, { leaved: null, reaction: false });
        } else {
            Object.assign(condition, { leaved: { $gt: 0 } });
        }

        const data = [];

        let hasNext = true;
        let skip = 0;

        // this is because the cosmodb
        while (hasNext) {
            const res = await c.find(condition)
                .project({ _id: 0, senderId: 1, pageId: 1 })
                .limit(COSMO_LIMIT)
                .skip(skip)
                .toArray();

            data.push(...res);

            if (res.length === COSMO_LIMIT) {
                skip += COSMO_LIMIT;
            } else {
                hasNext = false;
            }
        }

        return data;
    }

    /**
     *
     * @param {string} taskId
     * @param {Object} data
     */
    async updateTask (taskId, data) {
        const c = await this._getCollection(this.taksCollection);

        const res = await c.findOneAndUpdate({
            _id: ObjectID.isValid(taskId)
                ? ObjectID.createFromHexString(taskId)
                : taskId
        }, {
            $set: data
        }, {
            returnOriginal: false
        });

        return this._mapGenericObject(res.value);
    }

    /**
     * Get last sent task from campaign
     *
     * @param {string} pageId
     * @param {string} senderId
     * @param {string} campaignId
     * @returns {Promise<Task|null>}
     */
    async getSentTask (pageId, senderId, campaignId) {
        const c = await this._getCollection(this.taksCollection);

        const res = await c.findOne({
            pageId,
            senderId,
            campaignId,
            sent: { $gte: 1 }
        }, {
            sort: { sent: -1 }
        });

        return this._mapGenericObject(res);
    }

    /**
     *
     * @param {string} pageId
     * @param {string} senderId
     * @param {string[]} checkCampaignIds
     * @returns {Promise<string[]>}
     */
    async getSentCampagnIds (pageId, senderId, checkCampaignIds) {
        const c = await this._getCollection(this.taksCollection);

        const condition = {
            pageId,
            senderId,
            campaignId: { $in: checkCampaignIds },
            sent: { $gte: 1 }
        };

        try {
            const res = await c.distinct('campaignId', condition);
            return res;
        } catch (e) {
            const data = await c.find(condition)
                .project({ campaignId: 1, _id: 0 })
                .toArray();

            return data.map(d => d.campaignId);
        }
    }

    /**
     *
     * @param {string} senderId
     * @param {string} pageId
     * @param {number} watermark
     * @param {('read'|'delivery')} eventType
     * @param {number} ts
     * @returns {Promise<Task[]>}
     */
    async updateTasksByWatermark (senderId, pageId, watermark, eventType, ts = Date.now()) {
        const c = await this._getCollection(this.taksCollection);

        const tasks = await c
            .find({
                senderId, pageId, sent: { $lte: watermark }, [eventType]: null
            })
            .project({ _id: true })
            .toArray();

        if (tasks.length === 0) {
            return [];
        }

        const result = await Promise.all(
            tasks.map(task => c.findOneAndUpdate({
                _id: task._id,
                [eventType]: null
            }, {
                $set: {
                    [eventType]: ts
                }
            }, {
                returnOriginal: false
            }))
        );

        return result
            .map(res => (res.value ? this._mapGenericObject(res.value) : null))
            .filter(r => r !== null);
    }

    /**
     *
     * @param {Object} campaign
     * @param {Object} [updateCampaign]
     * @returns {Promise<Campaign>}
     */
    async upsertCampaign (campaign, updateCampaign = null) {
        const c = await this._getCollection(this.campaignsCollection);

        let ret;
        if (campaign.id) {
            const $setOnInsert = Object.assign({}, campaign);
            delete $setOnInsert.id;
            const update = {};
            if (Object.keys($setOnInsert).length !== 0) {
                Object.assign(update, {
                    $setOnInsert
                });
            }
            if (updateCampaign) {
                Object.assign(update, {
                    $set: updateCampaign
                });
            }
            const res = await c.findOneAndUpdate({
                id: campaign.id
            }, update, {
                upsert: true,
                returnOriginal: false
            });
            ret = this._mapCampaign(res.value);
        } else {
            const id = new ObjectID();
            ret = Object.assign({ id: id.toHexString(), _id: id }, campaign);
            if (updateCampaign) {
                Object.assign(ret, updateCampaign);
            }
            await c.insertOne(ret);
            delete ret._id;
        }

        return ret;
    }

    /**
     *
     * @param {string} campaignId
     * @returns {Promise}
     */
    async removeCampaign (campaignId) {
        const c = await this._getCollection(this.campaignsCollection);

        await c.deleteOne({
            id: campaignId
        });
    }

    /**
     *
     * @param {string} campaignId
     * @param {Object} increment
     * @returns {Promise}
     */
    async incrementCampaign (campaignId, increment = {}) {
        const c = await this._getCollection(this.campaignsCollection);

        await c.updateOne({
            id: campaignId
        }, {
            $inc: increment
        });
    }

    /**
     *
     * @param {string} campaignId
     * @param {Object} data
     * @returns {Promise<Campaign|null>}
     */
    async updateCampaign (campaignId, data) {
        const c = await this._getCollection(this.campaignsCollection);

        const res = await c.findOneAndUpdate({
            id: campaignId
        }, {
            $set: data
        }, {
            returnOriginal: false
        });

        return this._mapCampaign(res.value);
    }

    /**
     *
     * @param {number} [now]
     * @returns {Promise<Campaign|null>}
     */
    async popCampaign (now = Date.now()) {
        const c = await this._getCollection(this.campaignsCollection);

        const res = await c.findOneAndUpdate({
            startAt: { $ne: null, $lte: now },
            active: true
        }, {
            $set: { startAt: null }
        }, {
            returnOriginal: true
        });

        return this._mapCampaign(res.value);
    }

    /**
     *
     * @param {string} campaignId
     * @returns {Promise<null|Campaign>}
     */
    async getCampaignById (campaignId) {
        const c = await this._getCollection(this.campaignsCollection);

        const res = await c.findOne({
            id: campaignId
        });

        return this._mapCampaign(res);
    }

    /**
     *
     * @param {string[]} campaignIds
     * @returns {Promise<Campaign[]>}
     */
    async getCampaignByIds (campaignIds) {
        const c = await this._getCollection(this.campaignsCollection);

        const cursor = c.find({
            id: {
                $in: campaignIds
            }
        })
            .limit(campaignIds.length)
            .map(camp => this._mapCampaign(camp));

        return cursor.toArray();
    }

    /**
     *
     * @param {Object} condition
     * @param {number} [limit]
     * @param {Object} [lastKey]
     * @returns {Promise<{data:Campaign[],lastKey:string}>}
     */
    async getCampaigns (condition, limit = null, lastKey = null) {
        const c = await this._getCollection(this.campaignsCollection);

        let useCondition = condition;

        if (lastKey !== null) {
            const key = JSON.parse(Buffer.from(lastKey, 'base64').toString('utf8'));

            useCondition = Object.assign({}, useCondition, {
                _id: {
                    $lt: ObjectID.createFromHexString(key._id)
                }
            });
        }

        const cursor = c.find(useCondition)
            .sort({ _id: -1 });

        if (limit !== null) {
            cursor.limit(limit + 1);
        }

        let data = await cursor.toArray();

        let nextLastKey = null;
        if (limit !== null && data.length > limit) {
            data = data.slice(0, limit);

            const last = data[data.length - 1];
            nextLastKey = Buffer.from(JSON.stringify({
                _id: last._id.toHexString()
            })).toString('base64');
        }

        return {
            data: data.map(camp => this._mapCampaign(camp)),
            lastKey: nextLastKey
        };
    }

    /**
     *
     * @param {string} senderId
     * @param {string} pageId
     * @param {string} tag
     * @returns {Promise}
     */
    async subscribe (senderId, pageId, tag) {
        const c = await this._getCollection(this.subscribtionsCollection);

        await c.findOneAndUpdate({
            senderId, pageId
        }, {
            $addToSet: { subs: tag }
        }, {
            upsert: true
        });
    }

    /**
     *
     * @param {string} senderId
     * @param {string} pageId
     * @param {string} [tag]
     * @returns {Promise<string[]>}
     */
    async unsubscribe (senderId, pageId, tag = null) {
        const c = await this._getCollection(this.subscribtionsCollection);

        let removeWholeSubscribtion = tag === null;
        const ret = [];

        if (tag !== null) {
            const res = await c.findOneAndUpdate({
                pageId, senderId, subs: tag
            }, {
                $pull: { subs: tag }
            }, {
                returnOriginal: false
            });

            if (res.value) {
                ret.push(tag);
                removeWholeSubscribtion = res.value.subs.length === 0;
            } else {
                return [];
            }
        }

        if (removeWholeSubscribtion) {
            const res = await c.findOneAndDelete({ pageId, senderId });
            if (res.value) {
                ret.push(...res.value.subs);
            }
        }

        return ret;
    }

    _createSubscribtionsCondition (include, exclude, pageId = null) {
        const condition = {};

        if (include.length !== 0) {
            Object.assign(condition, { subs: { $in: include } });
        }

        if (exclude.length !== 0) {
            if (typeof condition.subs === 'undefined') Object.assign(condition, { subs: {} });

            Object.assign(condition.subs, { $nin: exclude });
        }

        if (pageId !== null) Object.assign(condition, { pageId });

        return condition;
    }

    /**
     *
     * @param {string[]} include
     * @param {string[]} exclude
     * @param {string} [pageId]
     * @returns {Promise<number>}
     */
    async getSubscribtionsCount (include, exclude, pageId = null) {
        const c = await this._getCollection(this.subscribtionsCollection);

        const condition = this._createSubscribtionsCondition(include, exclude, pageId);

        return c.find(condition)
            .project({ _id: 1 })
            .count();
    }

    /**
     *
     * @param {string[]} include
     * @param {string[]} exclude
     * @param {number} limit
     * @param {string} [pageId]
     * @param {*} lastKey
     * @returns {Promise<{data: Target[], lastKey: string }>}
     */
    async getSubscribtions (include, exclude, limit, pageId = null, lastKey = null) {
        const c = await this._getCollection(this.subscribtionsCollection);

        let condition = this._createSubscribtionsCondition(include, exclude, pageId);

        if (lastKey !== null) {
            const key = JSON.parse(Buffer.from(lastKey, 'base64').toString('utf8'));

            condition = Object.assign({}, condition, {
                _id: {
                    $gt: ObjectID.createFromHexString(key._id)
                }
            });
        }

        let data = [];
        let hasNext = true;
        let skip = 0;
        const totalLimit = limit || (Number.MAX_SAFE_INTEGER - 1);
        const useLimit = Math.min(999, totalLimit + 1);

        // this is because the cosmodb
        while (hasNext) {

            const cursor = c.find(condition)
                .project({ _id: 1, pageId: 1, senderId: 1 })
                .sort({ _id: 1 })
                .skip(skip)
                .limit(useLimit);

            const res = await cursor.toArray();
            data.push(...res);

            if (res.length === useLimit && data.length <= totalLimit) {
                skip += useLimit;
            } else {
                hasNext = false;
            }
        }

        let nextLastKey = null;
        if (limit && data.length > limit) {
            data = data.slice(0, limit);

            const last = data[data.length - 1];
            nextLastKey = Buffer.from(JSON.stringify({
                _id: last._id
            })).toString('base64');
        }

        return Promise.resolve({
            data: data.map(({ senderId, pageId: p }) => ({ senderId, pageId: p })),
            lastKey: nextLastKey
        });
    }

    /**
     *
     * @param {string} senderId
     * @param {string} pageId
     * @returns {Promise<string[]>}
     */
    async getSenderSubscribtions (senderId, pageId) {
        const c = await this._getCollection(this.subscribtionsCollection);

        const sub = await c.findOne({ senderId, pageId }, { projection: { _id: 0, subs: 1 } });

        if (sub) {
            return sub.subs;
        }

        return [];
    }

    async getTags (pageId = null) {
        const c = await this._getCollection(this.subscribtionsCollection);

        const pipeline = [
            {
                $project: { subs: 1 }
            },
            {
                $unwind: '$subs'
            },
            {
                $group: {
                    _id: '$subs',
                    subscribtions: { $sum: 1 }
                }
            },
            { $sort: { subscribtions: -1 } }
        ];

        if (pageId) {
            // @ts-ignore
            pipeline.unshift({ $match: { pageId } });
        }

        const res = await c.aggregate(pipeline);


        const arr = await res.toArray();

        return arr.map(({ _id: tag, subscribtions }) => ({ tag, subscribtions }));
    }

}

module.exports = NotificationsStorage;
