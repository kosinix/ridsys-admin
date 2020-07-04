//// Core modules
const fs = require('fs')

//// External modules
const express = require('express')
const fileUpload = require('express-fileupload')
const flash = require('kisapmata')
const phAddress = require('ph-address')
const lodash = require('lodash')
const moment = require('moment')
const qr = require('qr-image')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const paginator = require('../paginator');
const passwordMan = require('../password-man');

// Router
let router = express.Router()

router.use('/entity', middlewares.requireAuthUser )

router.get('/entity/all', middlewares.guardRoute(['read_all_entity', 'read_entity']), async (req, res, next) => {
    try {
        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', 1))
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = parseInt(lodash.get(req, 'query.customSort'))

        let query = {}
        let projection = {}

        // Pagination
        let totalDocs = await db.main.Entity.countDocuments(query)
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/entity/all',
            req.query
        )

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        console.log(query, projection, options, sort)

        let entities = await db.main.Entity.find(query, projection, options).sort(sort).lean()

        let doors = []
        entities.forEach((entity)=>{
            doors.push(db.main.Door.find({ entityId: entity._id })) // return array of doors
        })
        doors = await Promise.all(doors)
        entities.forEach((entity, i)=>{
            entity.doors = doors[i]
        })

        res.render('entity/all.html', {
            flash: flash.get(req, 'entity'),
            entities: entities,
            pagination: pagination,
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/entity/create', middlewares.guardRoute(['create_entity']), async (req, res, next) => {
    try {

        res.render('entity/create.html', {
        });
    } catch (err) {
        next(err);
    }
});
router.post('/entity/create', middlewares.guardRoute(['create_entity']), async (req, res, next) => {
    try {
        let body = req.body
        let patch = {}
        lodash.set(patch, 'name', lodash.get(body, 'name'))

        let entity = new db.main.Entity(patch)
        await entity.save()
        flash.ok(req, 'entity', `Added ${entity.name}.`)
        res.redirect(`/entity/${entity._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/entity/:entityId', middlewares.getEntity, async (req, res, next) => {
    try {
        let entity = res.entity.toObject()

        entity.doors = await db.main.Door.find({entityId: entity._id});

        res.render('entity/read.html', {
            flash: flash.get(req, 'entity'),
            entity: entity,
        });
    } catch (err) {
        next(err);
    }
});
router.get('/entity/:entityId/door/create', middlewares.getEntity, async (req, res, next) => {
    try {
        let entity = res.entity

        res.render('entity/door/create.html', {
            flash: flash.get(req, 'entity'),
            entity: entity,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/entity/:entityId/door/create', middlewares.getEntity, async (req, res, next) => {
    try {
        let entity = res.entity
        let body = req.body
        let patch = {}

        let password = passwordMan.randomString(8)
        let salt = passwordMan.randomString(16)
        let passwordHash = passwordMan.hashPassword(password, salt)

        lodash.set(patch, 'entityId', lodash.get(entity, '_id'))
        lodash.set(patch, 'name', lodash.get(body, 'name'))
        lodash.set(patch, 'passwordHash', passwordHash)
        lodash.set(patch, 'salt', salt)

        let door = new db.main.Door(patch)
        await door.save()

        flash.ok(req, 'entity', `Added ${door.name}. ID is "${door.uid}" and password is "${password}". You will only see your password once so please save it in a secure place.`)

        res.redirect(`/entity/${entity._id}`)

    } catch (err) {
        next(err);
    }
});
module.exports = router;