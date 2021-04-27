const mongoose = require('mongoose')

const MongoClient = require('mongodb').MongoClient;

const MongooseSchema = (collection, attributes, hasOwnerAttr, hasStateAttr, hasWorkflowAttr) => {
    const Schema = new mongoose.Schema(attributes, {timestamps: true});

    Schema.plugin(require('mongoose-deep-populate')(mongoose));

    //默认添加组织记录归属字段,如属性为false则不添加
    if (hasOwnerAttr || hasOwnerAttr === void (0)) {
        Schema.add({
            idOrgan: {
                type: mongoose.Schema.ObjectId,
                ref: 'org_organ',
            },
        });
    }
    //默认添加数据记录状态字段,如属性为false则不添加
    if (hasStateAttr || hasStateAttr === void (0)) {
        Schema.add({
            __s: {
                name: '数据状态',
                type: Number,
                default: 1,
            },
            __c: {
                name: '关闭标志',
                type: Number,
                default: 1,
            },
            __r: {
                type: Number,
                default: 0,
            },
        });
    }
    //添加数据审批字段
    if (hasWorkflowAttr) {
        Schema.add({
            submitUser: {
                name: '提交人',
                type: mongoose.Schema.ObjectId,
                ref: 'sys_user'
            },
            submitAt: {
                name: '提交日期',
                type: Date,
            },
            verifyUser: {
                name: '审核人',
                type: mongoose.Schema.ObjectId,
                ref: 'sys_user'
            },
            verifyAt: {
                name: '审核日期',
                type: Date,
            },
            closeUser: {
                name: '关闭人',
                type: mongoose.Schema.ObjectId,
                ref: 'sys_user'
            },
            closeAt: {
                name: '关闭日期',
                type: Date,
            },
            closeReason: {
                name: '关闭理由',
                type: String,
            },
            openUser: {
                name: '关闭人',
                type: mongoose.Schema.ObjectId,
                ref: 'sys_user'
            },
            openAt: {
                name: '关闭日期',
                type: Date,
            },
            openReason: {
                name: '关闭理由',
                type: String,
            },
        })
    }

    Schema.add({
        createdUser: {
            name: '创建人',
            type: mongoose.Schema.ObjectId,
            ref: 'sys_user',
        },
        updatedUser: {
            name: '修改人',
            type: mongoose.Schema.ObjectId,
            ref: 'sys_user',
        },
    });

    Schema.set('toJSON', {getters: true, virtuals: true});

    Schema.set('toObject', {getters: true, virtuals: true});

    return Schema;
};

const GenerateSchemaAttributes = (collection, collectionFields, p_id, schemas) => {
    schemas = schemas ? schemas : {};
    const ResolveAttribute = (fields) => {
        let attributes = {};
        let attributesStr = ``;
        for (let field of fields) {
            if (['idOrgan', '__s', '__r', '__c',
                'createdAt', 'createdUser', 'updatedAt', 'updatedUser',
                'submitAt', 'submitUser', 'verifyAt', 'verifyUser',
                'closeAt', 'closeUser', 'openAt', 'openUser',
                'reviewAt', 'reviewUser'].includes(field.field)) {
                continue;
            }
            let defaultJson = {};
            let defaultStr = ``;
            if (field.defaultValue) {
                defaultJson['default'] = field.defaultValue;
                defaultStr = `,default:'${field.defaultValue}'`
            }
            if (field.enums&&field.enums.length>0) {
                defaultJson['enum'] = field.enums;
                defaultStr = defaultStr+(field.type!=='String'?`,enum:[${field.enums.join(',')}]`:`,enum:["${field.enums.join('","')}"]`)
            }
            switch (field.type) {
                case 'File':
                    attributes[field.field] = {
                        type: mongoose.Schema.ObjectId,
                        name: field.name ? field.name : field.field,
                        ref: 'sys_file',
                        ...defaultJson
                    };
                    attributesStr += `${field.field}: {name:'${field.name ? field.name : field.field}',type: app.mongoose.Schema.ObjectId,ref:'sys_file'${defaultStr}},`;
                    break;
                case 'Files':
                    attributes[field.field] = [new mongoose.Schema({
                        idFile: {
                            name: field.name ? field.name : field.field,
                            type: mongoose.Schema.ObjectId,
                            ref: 'sys_file',
                            ...defaultJson
                        }
                    })];
                    attributesStr += `${field.field}: [ new app.mongoose.Schema({idFile:{name:'${field.name ? field.name : field.field}'type: app.mongoose.Schema.ObjectId, ref: 'sys_file'${defaultStr}}}) ],`;
                    break;
                case 'ObjectId':
                    if (field.refer) {
                        attributes[field.field] = {
                            name: field.name ? field.name : field.field,
                            type: mongoose.Schema.ObjectId,
                            ref: field.refer,
                            ...defaultJson
                        };
                        attributesStr += `${field.field}: {name:'${field.name ? field.name : field.field}',type: app.mongoose.Schema.ObjectId,ref:'${field.refer}'${defaultStr}},`;
                    } else {
                        attributes[field.field] = {
                            name: field.name ? field.name : field.field,
                            type: mongoose.Schema.ObjectId,
                            ...defaultJson
                        };
                        attributesStr += `${field.field}: {name:'${field.name ? field.name : field.field}',type: app.mongoose.Schema.ObjectId${defaultStr}},`;
                    }
                    break;
                case 'Entity':
                    if (!field.childSeparate) {
                        const childConfig = ResolveAttribute(collectionFields.filter((item) => item.p_id == field._id));
                        switch (field.childType) {
                            case 'OneToOne':
                                attributes[field.field] = childConfig.attributes;
                                attributesStr += `${field.field}:new app.mongoose.Schema({${childConfig.attributesStr}}),`;
                                break;
                            case 'OneToMany':
                                attributes[field.field] = childConfig.attributes;
                                attributesStr += `${field.field}:[ new app.mongoose.Schema({${childConfig.attributesStr}}) ],`;
                                break;
                            default:
                                attributes[field.field] = childConfig.attributes;
                                attributesStr += `${field.field}:new app.mongoose.Schema({${childConfig.attributesStr}}),`;
                                break;
                        }
                    } else {
                        schemas[collection + '_' + field.field] = GenerateSchemaAttributes(collection + '_' + field.field, [{
                            p_id: field._id,
                            type: 'ObjectId',
                            field: 'idFather',
                            refer: collection
                        }].concat(collectionFields.filter((item) => item.p_id == field._id)), field._id, schemas)[collection + '_' + field.field]
                    }
                    break
                default:
                    attributes[field.field] = {
                        name: field.name ? field.name : field.field,
                        type: field.type, ...defaultJson
                    };
                    attributesStr += `${field.field}: {name:'${field.name ? field.name : field.field}',type: ${field.type}${defaultStr}},`;
                    break;
            }
        }
        return {attributes, attributesStr}
    };

    schemas[collection] = {...ResolveAttribute(collectionFields.filter((item) => item.p_id == p_id))};

    return schemas;
};

const GenerateSchemaDefine = (attributesStr, option) => {
    return require('js-beautify').js(
        `'use strict';
    
        module.exports = app => {
        
        const collection = require('path').basename(__filename, '.js');
        
        const attributes = {${attributesStr}};

        const schema = app.MongooseSchema(collection, attributes,${option.hasOwnerAttr},${option.hasStateAttr},${option.hasWorkflowAttr});

        return app.mongooseDB.get('default').model(collection, schema, collection);
    
        };`);
};

const GenerateAttributesBySchema = (schema) => {
    const getFieldInfo = (schema, p_id) => {
        const array = [];
        for (let key in schema) {
            const json = {};
            json.field = key;
            json.name = schema[key].name ? schema[key].name : key;
            json.p_id = p_id;

            if (['_id', 'id'].includes(json.field)) {
                continue;
            }
            if (!schema.hasOwnProperty(key)) {
                continue;
            }
            switch (schema[key].type ? schema[key].type : schema[key]) {
                case Number:
                    json.type = 'Number';
                    break;
                case Date:
                    json.type = 'Date';
                    break;
                case String:
                    json.type = 'String';
                    break;
                case Array:
                    json.type = 'Array';
                    break;
                case mongoose.Schema.ObjectId:
                    json.type = 'ObjectId';
                    json.ref = schema[key].ref;
                    break;
                case Boolean:
                    json.type = 'Boolean';
                    break;
                default:
                    break;
            }
            array.push(json)
        }
        return array
    };
    let records = [];
    records = records.concat(getFieldInfo(Object.assign({}, schema.tree), '0'));
    for (let childSchema of schema.childSchemas) {
        const cSchema = Object.assign({}, childSchema.schema.tree);
        records = records.concat(getFieldInfo(cSchema, childSchema.model.path));
    }
    return records;
};

const toObjectIDS = (obj) => {
    const WhiteList = ['idOrganVisible'];
    for (const key in obj) {
        // 如果对象类型为object类型且数组长度大于0 或者 是对象 ，继续递归解析
        if (obj.hasOwnProperty(key) && !['scopes'].includes(key)) {
            const element = obj[key];
            if (WhiteList.indexOf(key) < 0) {
                if (element && element.length > 0 && typeof (element) === 'object' || typeof (element) === 'object') {
                    toObjectIDS(element);
                } else { // 不是对象或数组、直接输出
                    if (/^[a-fA-F0-9]{24}$/.test(obj[key])) {
                        obj[key] = new mongoose.Types.ObjectId(obj[key]);
                    }
                }
            }
        }
    }
    return obj;
}

const toObjectID = (obj) => {
    return new mongoose.Types.ObjectId(obj);
}

const connect = async (dbUri, dbName, user, pass) => {
    const connect = mongoose.createConnection([dbUri, dbName].join('/'), {
        user,
        pass,
        useUnifiedTopology: true,
        useNewUrlParser: true
    });
    connect.on('error', err => {
        console.log(err.message);
    });
    connect.on('disconnected', () => {
        console.log(`mongoose disconnected`);
    });
    connect.on('connected', () => {
        console.log(`mongoose connected successfully`);
    });
    connect.on('reconnected', () => {
        console.log(`mongoose reconnected successfully`);
    });

    const client = await MongoClient.connect([dbUri, dbName].join('/'), {
        auth: {
            user,
            password: pass
        }
    });
    let collections = {};
    const entities = await client.db(dbName).collection('cdp_entity').find().toArray();
    for (let entity of entities) {
        const fields = await client.db(dbName).collection('cdp_entity_field').find({idEntity: entity._id}).toArray();
        const app = {
            mongoose,
            MongooseSchema,
            mongooseDB: {
                get() {
                    return {
                        model(model, schema) {
                            return connect.model(entity.dsCollection, schema, entity.dsCollection);
                        }
                    }
                }
            }
        }
        const schema = GenerateSchemaAttributes(entity.dsCollection, fields, '0');
        for (let key in schema) {
            collections[entity.dsCollection] = eval(GenerateSchemaDefine(schema[key].attributesStr, entity))(app);
        }
    }
    return {connect, collections}
}

const doGet = async (collection, query) => {
    let {filter, order, skip, limit, project, populate} = query;
    const error = {code: '0'};
    const count = await collection.countDocuments(filter);
    let records = await collection.find(filter, project)
        .sort(order)
        .skip(skip)
        .limit(limit)
        .catch(e => {
            if (e) {
                error.code = e.code;
                error.message = e.message;
            }
            console.info(e);
        });
    if (populate) {
        records = await collection.deepPopulate(records, populate.split(','))
            .catch(e => {
                if (e) {
                    error.code = e.code;
                    error.message = e.message;
                }
                console.info(e);
            });
    }
    records = JSON.parse(JSON.stringify(records));
    return error.code === '0' ? {error, count, records} : {error};
}

const doGetById = async (collection, ids, query) => {
    const error = {code: '0'};
    let records = await collection.find({_id: {$in: ids.split(',')}}, query.project)
        .catch(e => {
            if (e) {
                error.code = e.code;
                error.message = e.message;
            }
            console.info(e);
        });

    if (query.populate) {
        records = await collection.deepPopulate(records, query.populate.split(','))
            .catch(e => {
                if (e) {
                    error.code = e.code;
                    error.message = e.message;
                }
                console.info(e);
            });
    }
    records = JSON.parse(JSON.stringify(records));
    return error.code === '0' ? {error, records,} : {error};
}

const doPost = async (collection, data) => {
    const error = {code: '0'};
    let records = [];
    if (Array.isArray(data)) {
        for (const d of data) {
            delete d.updatedAt;
            delete d.createdAt;
            const record = await collection.create(d).catch(e => {
                if (e) {
                    error.code = e.code;
                    error.message = e.message;
                }
                console.info(e);
            });
            records.push(record);
        }
    } else {
        delete data.updatedAt;
        delete data.createdAt;
        records = [await collection.create(data).catch(e => {
            if (e) {
                error.code = e.code;
                error.message = e.message;
            }
            console.info(e);
        })];
    }
    records = JSON.parse(JSON.stringify(records));
    return error.code === '0' ? {error, records,} : {error,};
}

const doUpdate = async (collection, id, data) => {
    const error = {
        code: '0',
    };
    let records;
    const exist = await collection.findOne({_id: id});
    if (exist) {
        if ((new Date(exist.updatedAt)).toString() === (new Date(data.updatedAt)).toString() || !data.updatedAt) {
            delete data.updatedAt;
            records = await collection.updateMany({_id: id}, data)
                .catch(e => {
                    if (e) {
                        error.code = e.code;
                        error.message = e.message;
                    }
                    console.info(e);
                });
        } else {
            error.code = '909';
            error.message = '当前数据已被修改，请刷新数据后重试！';
        }
    } else {
        error.code = '904';
        error.message = '当前数据已删除！';
    }
    records = JSON.parse(JSON.stringify(records));
    return error.code === '0' ? {error, records,} : {error};
}

const doDestroy = async (collection, ids) => {
    const error = {
        code: '0',
    };

    const records = await collection.deleteMany({_id: {$in: ids.split(',')}})
        .catch(e => {
            if (e) {
                error.code = e.code;
                error.message = e.message;
            }
            console.info(e);
        });

    return error.code === '0' ? {error, records,} : {error};
}

const doGetByAggregate = async (collection, query) => {
    const error = {code: '0'};
    let {pipeline = [], prePipeline = [], filter = {}, like, likeBy, order, limit, skip} = query;
    let likeFilter = {};
    if (like && likeBy) {
        likeFilter.$or = [];
        for (const key of likeBy.split(',')) {
            likeFilter.$or.push({[key]: new RegExp(like, 'i')});
        }
    }
    Object.keys(filter).length > 0 && prePipeline.push({$match: filter});
    Object.keys(likeFilter).length > 0 && prePipeline.push({$match: likeFilter});

    function generateAggregatePage({order, skip, limit}) {
        const SSL = [];
        const sort = {};
        if (order && order.split(' ')[0]) {
            order.split(' ').map(e => {
                if (e && e[0] === '-') {
                    sort[e.slice(1)] = -1;
                } else {
                    sort[e] = 1;
                }
            });
            SSL.push({$sort: sort});
        }
        skip = skip ? skip : 0;
        SSL.push({$skip: skip});
        if (limit && limit !== 0) {
            SSL.push({$limit: limit});
        }
        return SSL;
    }

    const getCount = async () => {
        return await collection.aggregate([...toObjectIDS(prePipeline)]).option({allowDiskUse: true})
            .count('count')
            .then(res => res[0] ? res[0].count : 0)
            .catch(e => {
                if (e) {
                    error.code = e.code;
                    error.message = e.message;
                }
                console.info(e);
            })
    };
    const getData = async () => {
        return await collection.aggregate([...toObjectIDS(prePipeline), ...generateAggregatePage({
            order,
            skip,
            limit
        }), ...pipeline]).option({allowDiskUse: true})
            .catch(e => {
                if (e) {
                    error.code = e.code;
                    error.message = e.message;
                }
                console.info(e);
            })
    };
    let [count, records] = await Promise.all([getCount(), getData()]);
    records = JSON.parse(JSON.stringify(records));
    return error.code === '0' ? {error, count, records} : {error};
}

const doResolveFilter = async (collections, idEntity, filter) => {
    const error = {code: '0'};
    let KeyPath = Object.keys(filter)[0].split('.');
    if (KeyPath.length <= 1) {
        return error.code === '0' ? {error, record: filter} : {error};
    }
    const getNextEntity = async (idEntity, field) => {
        const CdpEntity = collections.cdp_entity;
        const CdpEntityField = collections.cdp_entity_field;
        const FieldCfg = await CdpEntityField.findOne({idEntity, field}).populate('idEntity').lean();
        let cfg = {field, collection: FieldCfg.idEntity.dsCollection};
        switch (FieldCfg.type) {
            case 'Entity':
                cfg.idEntityNext = FieldCfg.idEntity._id;
                break;
            case 'ObjectIds':
                cfg.idEntityNext = (await CdpEntity.findOne({dsCollection: FieldCfg.refer}))._id;
                break;
            case 'ObjectId':
                cfg.idEntityNext = (await CdpEntity.findOne({dsCollection: FieldCfg.refer}))._id;
                break;
            default :
                cfg.idEntityNext = null
                break;
        }
        if (FieldCfg.p_id !== '0') {
            const ParentCfg = await CdpEntityField.findOne({_id: FieldCfg.p_id});
            if (ParentCfg.childSeparate) {
                cfg.collection = FieldCfg.idEntity.dsCollection + '_' + ParentCfg.field;
            }
        }
        return cfg
    };
    let stages = [];
    let i = 0;
    do {
        const stage = await getNextEntity(idEntity, KeyPath[i])
        idEntity = stage.idEntityNext;
        if (stage.collection === (stages[i - 1] ? stages[i - 1].collection : null)) {
            stages[i - 1].field = stages[i - 1].field + '.' + stage.field;
        } else {
            stages.push(stage)
        }
        i++;
    } while (i < KeyPath.length)

    let j = stages.length - 1;
    let record = {[stages[j].field]: filter[Object.keys(filter)[0]]};
    do {
        const collection = collections[stages[j].collection];
        switch (stages[j].type) {
            case 'EntitySeparate':
                record = {[stages[j - 1].field]: {$in: (await collection.find(record)).map(item => item.idFather)}};
                break;
            default :
                record = {[stages[j - 1].field]: {$in: (await collection.find(record)).map(item => item._id)}};
                break;
        }
        j--;
    } while (j >= 1)
    return error.code === '0' ? {error, record} : {error};
}

module.exports = {
    MongooseSchema,
    GenerateSchemaAttributes,
    GenerateSchemaDefine,
    GenerateAttributesBySchema,
    connect,
    toObjectIDS,
    toObjectID,
    doGet,
    doGetById,
    doPost,
    doUpdate,
    doDestroy,
    doGetByAggregate,
    doResolveFilter
}
