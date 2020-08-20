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

router.use('/scanner', middlewares.requireAuthUser )

router.get('/scanner/all', middlewares.guardRoute(['read_all_scanner', 'read_scanner']), async (req, res, next) => {
    try {
        let page = parseInt(lodash.get(req, 'query.page', 1))
        let perPage = parseInt(lodash.get(req, 'query.perPage', 10))
        let sortBy = lodash.get(req, 'query.sortBy', '_id')
        let sortOrder = parseInt(lodash.get(req, 'query.sortOrder', 1))
        let customSort = parseInt(lodash.get(req, 'query.customSort'))

        let query = {}
        let projection = {}

        // Pagination
        let totalDocs = await db.main.Scanner.countDocuments(query)
        let pagination = paginator.paginate(
            page,
            totalDocs,
            perPage,
            '/scanner/all',
            req.query
        )

        let options = { skip: (page - 1) * perPage, limit: perPage };
        let sort = {}
        sort = lodash.set(sort, sortBy, sortOrder)

        console.log(query, projection, options, sort)

        let scanners = await db.main.Scanner.find(query, projection, options).sort(sort).lean()

        let entities = []
        scanners.forEach((scanner)=>{
            entities.push(db.main.Entity.findById(scanner.entityId))
        })
        entities = await Promise.all(entities)
        scanners.forEach((scanner, i)=>{
            scanner.entity = entities[i]
        })

        res.render('scanner/all.html', {
            flash: flash.get(req, 'scanner'),
            scanners: scanners,
            pagination: pagination,
            query: req.query,
        });
    } catch (err) {
        next(err);
    }
});

router.get('/scanner/create/:entityId', middlewares.guardRoute(['create_scanner']), middlewares.getEntity, async (req, res, next) => {
    try {

        res.render('scanner/create.html', {
            entity: res.entity
        });
    } catch (err) {
        next(err);
    }
});
router.post('/scanner/create/:entityId', middlewares.guardRoute(['create_scanner']), middlewares.getEntity, async (req, res, next) => {
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

        let scanner = new db.main.Scanner(patch)
        await scanner.save()

        flash.ok(req, 'entity', `Added ${scanner.name}. ID is "${scanner.uid}" and password is "${password}". You will only see your password once so please save it in a secure place.`)

        res.redirect(`/entity/${entity._id}`)
    } catch (err) {
        next(err);
    }
});

router.get('/scanner/:scannerId', middlewares.guardRoute(['read_scanner']), middlewares.getScanner, async (req, res, next) => {
    try {

        res.render('scanner/read.html', {
            flash: flash.get(req, 'scanner'),
            scanner: res.scanner
        });
    } catch (err) {
        next(err);
    }
});

router.get('/scanner/:scannerId/code', middlewares.guardRoute(['read_scanner']), middlewares.getScanner, async (req, res, next) => {
    try {

        res.render('scanner/code.html', {
            scanner: res.scanner
        });
    } catch (err) {
        next(err);
    }
});

router.post('/scanner/:scannerId/code', middlewares.guardRoute(['read_scanner']), middlewares.getScanner, async (req, res, next) => {
    try {

        let scanner = res.scanner

        let patch = {}

        let password = passwordMan.randomString(8)
        let salt = scanner.salt
        let passwordHash = passwordMan.hashPassword(password, salt)

        lodash.set(patch, 'passwordHash', passwordHash)

        lodash.merge(scanner, patch)
        await scanner.save()

        flash.ok(req, 'scanner', `Reset access code for ${scanner.name}. ID is "${scanner.uid}" and password is "${password}". You will only see your password once so please save it in a secure place.`)

        res.redirect(`/scanner/${res.scanner._id}`)
    } catch (err) {
        next(err);
    }
});

module.exports = router;