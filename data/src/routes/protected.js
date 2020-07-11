//// Core modules

//// External modules
const express = require('express')
const lodash = require('lodash')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const s3 = require('../aws-s3');

// Router
let router = express.Router()

router.get('/', middlewares.requireAuthUser, async (req, res, next) => {
    try {
        console.log(req.session)

        res.render('home.html');
    } catch (err) {
        next(err);
    }
});

router.use('/check', middlewares.requireAuthUser, middlewares.guardRoute([
    'read_all_resident',
    'create_resident',
    'read_resident',
    'update_resident',
    'delete_resident',

    'read_all_pass',
    'create_pass',
    'read_pass',
    'update_pass',
    'delete_pass',
]))

router.get('/check', async (req, res, next) => {
    try {

        res.render('check.html');
    } catch (err) {
        next(err);
    }
});

// View s3 object using html page
router.get('/file-viewer/:bucket/:prefix/:key', middlewares.requireAuthUser, async (req, res, next) => {
    try {
        let bucket = lodash.get(req, "params.bucket", "");
        let prefix = lodash.get(req, "params.prefix", "");
        let key = lodash.get(req, "params.key", "");

        let url = s3.getSignedUrl('getObject', {
            Bucket: bucket,
            Key: prefix + '/' + key
        })

        res.render('file-viewer.html', {
            url: url,
        });
    } catch (err) {
        next(err);
    }
});

// Get s3 object content
router.get('/file-getter/:bucket/:prefix/:key', middlewares.requireAuthUser, async (req, res, next) => {
    try {
        let bucket = lodash.get(req, "params.bucket", "");
        let prefix = lodash.get(req, "params.prefix", "");
        let key = lodash.get(req, "params.key", "");

        let url = s3.getSignedUrl('getObject', {
            Bucket: bucket,
            Key: prefix + '/' + key,
        })

        res.redirect(url);
    } catch (err) {
        next(err);
    }
});

router.get('/address',  middlewares.requireAuthUser, async (req, res, next) => {
    try {
        let search = lodash.get(req, 'query.s', '');
        let keys = search.split(',')
        keys = lodash.map(keys, (o) => {
            o = lodash.trim(o)
            o = o.replace(/(brgy\.)|(brgy)/, 'Barangay')
            return new RegExp(o, "i")

        })

        // Our address returned starts from bgy level
        let query = {
            level: 'Bgy'
        }
        if(keys.length === 0){

        }
        if(keys.length === 1){

            query = {
                $or: [
                    {
                        $and: [
                            {name: keys[0]},
                            {level: 'Bgy'},
                        ]
                    },
                    {
                        $and: [
                            {cityMunName: keys[0]},
                            {level: 'Bgy'},
                        ]
                    },
                    {
                        $and: [
                            {provName: keys[0]},
                            {level: 'Bgy'},
                        ]
                    }
                ]
            }

            if(keys[0].source.match(/([\w]+ city)/i)){
                let custom = keys[0].source.replace(/ city/i, '')
                custom = `City of ${custom}`
                query.$or.push({
                    $and: [
                        {cityMunName: new RegExp(custom, 'i')},
                        {level: 'Bgy'},
                    ]
                })
            }

        } else if (keys.length === 2){
            query = {
                $or: [
                    {
                        $and: [
                            {name: keys[0]},
                            {level: 'Bgy'},
                            {cityMunName: keys[1]}
                        ],
                    },
                    {
                        $and: [

                            {level: 'Bgy'},
                            {cityMunName: keys[0]},
                            {provName: keys[1]}
                        ],
                    },
                ]
            }
        } else {
            query = {
                $or: [
                    {
                        $and: [
                            {name: keys[0]},
                            {level: 'Bgy'},
                            {cityMunName: keys[1]},
                            {provName: keys[2]},
                        ],
                    },
                    {
                        $and: [
                            {name: keys[0]},
                            {level: 'Bgy'},
                            {cityMunName: keys[1]},
                        ],
                    },
                ]
            }
        }
        // console.log(util.inspect(query, false, null, true /* enable colors */))
        // raw ops
        let addresses = await db.main.Address.collection.find(query).limit(10).toArray()
        addresses = lodash.map(addresses, (o)=>{
            let full = [o.name]
            if(o.cityMunName){
                full.push(o.cityMunName)
            }
            if(o.provName){
                full.push(o.provName)
            }
            return {
                id: o.code,
                name: full.join(', ')
            }
        })
        return res.send(addresses)
        
    } catch (err) {
        next(err);
    }
});
module.exports = router;