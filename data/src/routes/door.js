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
const s3 = require('../aws-s3');

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

router.get('/door/create', middlewares.guardRoute(['create_door']), async (req, res, next) => {
    try {

        res.render('door/create.html', {
        });
    } catch (err) {
        next(err);
    }
});
router.post('/door/create', middlewares.guardRoute(['create_door']), async (req, res, next) => {
    try {
        let body = req.body
        let patch = {}
        lodash.set(patch, 'firstName', lodash.get(body, 'firstName'))
        lodash.set(patch, 'middleName', lodash.get(body, 'middleName'))
        lodash.set(patch, 'lastName', lodash.get(body, 'lastName'))
        lodash.set(patch, 'suffix', lodash.get(body, 'suffix'))
        lodash.set(patch, 'birthDate', lodash.get(body, 'birthDate'))
        lodash.set(patch, 'gender', lodash.get(body, 'gender'))
        // lodash.set(patch, 'addresses.0._id', db.mongoose.Types.ObjectId())
        // lodash.set(patch, 'addresses.0.unit', lodash.get(body, 'unit1'))
        // lodash.set(patch, 'addresses.0.brgyDistrict', lodash.get(body, 'brgyDistrict1'))
        // lodash.set(patch, 'addresses.0.cityMun', lodash.get(body, 'cityMun1'))
        // lodash.set(patch, 'addresses.0.province', lodash.get(body, 'province1'))
        // lodash.set(patch, 'addresses.0.region', lodash.get(body, 'region1'))
        // lodash.set(patch, 'addresses.1._id', db.mongoose.Types.ObjectId())
        // lodash.set(patch, 'addresses.1.unit', lodash.get(body, 'unit2'))
        // lodash.set(patch, 'addresses.1.brgyDistrict', lodash.get(body, 'brgyDistrict2'))
        // lodash.set(patch, 'addresses.1.cityMun', lodash.get(body, 'cityMun2'))
        // lodash.set(patch, 'addresses.1.province', lodash.get(body, 'province2'))
        // lodash.set(patch, 'addresses.1.region', lodash.get(body, 'region2'))
        // lodash.set(patch, 'addressPermanent', lodash.get(patch, 'addresses.0._id'))
        // lodash.set(patch, 'addressPresent', lodash.get(patch, 'addresses.1._id'))
        // if(body.addressSame === 'true'){
        //     patch.addresses.splice(1,1) // Remove second array
        //     lodash.set(patch, 'addressPresent', lodash.get(patch, 'addresses.0._id'))
        // }

        // TODO: Check duplicate

        let person = new db.main.Person(patch)
        await person.save()
        flash.ok(req, 'door', `Added ${person.firstName} ${person.lastName}.`)
        res.redirect(`/door/address/${person._id}`)
    } catch (err) {
        next(err);
    }
});


module.exports = router;