//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const paginator = require('../paginator');
const passwordMan = require('../password-man');


// Router
let router = express.Router()

router.use('/door', middlewares.requireAuthUser )

router.get('/door/all', middlewares.guardRoute(['read_all_door', 'read_door']), async (req, res, next) => {
    try {
        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', 1))
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = parseInt(lodash.get(req, 'query.customSort'))

        let query = {}
        let projection = {}

        // Pagination
        let totalDocs = await db.main.Door.countDocuments(query)
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/door/all',
            req.query
        )

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        console.log(query, projection, options, sort)

        let doors = await db.main.Door.find(query, projection, options).sort(sort).lean()

        let entities = []
        doors.forEach((door)=>{
            entities.push(db.main.Entity.findById(door.entityId))
        })
        entities = await Promise.all(entities)
        doors.forEach((door, i)=>{
            door.entity = entities[i]
        })

        res.render('door/all.html', {
            flash: flash.get(req, 'door'),
            doors: doors,
            pagination: pagination,
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/door/create/:entityId', middlewares.guardRoute(['create_door']), middlewares.getEntity, async (req, res, next) => {
    try {

        res.render('door/create.html', {
            entity: res.entity
        });
    } catch (err) {
        next(err);
    }
});
router.post('/door/create/:entityId', middlewares.guardRoute(['create_door']), middlewares.getEntity, async (req, res, next) => {
    try {
        let entity = res.entity
        let body = req.body
        let patch = {}

        let password = passwordMan.randomString(8)
        let salt = passwordMan.randomString(16)
        let passwordHash = passwordMan.hashPassword(password, salt)

        lodash.set(patch, 'entityId', lodash.get(entity, '_id'))
        lodash.set(patch, 'name', lodash.get(body, 'name'))
        lodash.set(patch, 'type', lodash.get(body, 'type'))
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

router.get('/door/:doorId', middlewares.guardRoute(['read_door']), middlewares.getDoor, async (req, res, next) => {
    try {

        res.render('door/read.html', {
            door: res.door
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;