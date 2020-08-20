//// Core modules

//// External modules
const express = require('express')
const flash = require('kisapmata')
const lodash = require('lodash')

//// Modules
const db = require('../db');
const middlewares = require('../middlewares');
const passwordMan = require('../password-man');

// Router
let router = express.Router()


router.get('/access-point/login', async (req, res, next) => {
    try {
        console.log(req.session)
        let ip = req.headers['x-real-ip'] || req.connection.remoteAddress;
        res.render('access-point/login.html', {
            flash: flash.get(req, 'login'),
            ip: ip,
        });
    } catch (err) {
        next(err);
    }
});
router.post('/access-point/login', async (req, res, next) => {
    try {
        let post = req.body;

        let uid = lodash.get(post, 'username', '');
        let password = lodash.get(post, 'password', '');

        let door = await db.main.Door.findOne({ uid: uid });
        if (!door) {
            throw new Error('Incorrect ID.')
        }

        if (!door.active) {
            throw new Error('Access point is deactivated.');
        }

        // Check password
        let passwordHash = passwordMan.hashPassword(password, door.salt);
        if (passwordHash !== door.passwordHash) {
            throw new Error('Incorrect password.');
        }

        // Save ID to session
        lodash.set(req, 'session.authDoorId', door._id);

        // Security: Anti-CSRF token.
        let antiCsrfToken = await passwordMan.randomStringAsync(16)
        lodash.set(req, 'session.acsrf', antiCsrfToken);

        return res.redirect('/access-point');
    } catch (err) {
        flash.error(req, 'login', err.message);
        return res.redirect('/access-point/login');
    }
});

router.get('/access-point/logout', async (req, res, next) => {
    try {
        lodash.set(req, 'session.authDoorId', null);
        lodash.set(req, 'session.acsrf', null);
        lodash.set(req, 'session.flash', null);
        res.clearCookie(CONFIG.session.name, CONFIG.session.cookie);

        res.redirect('/access-point/login');
    } catch (err) {
        next(err);
    }
});

router.get('/access-point', middlewares.requireAuthDoor, async (req, res, next) => {
    try {
        res.render('access-point/index.html', {
            door: res.authDoor
        })
    } catch (err) {
        next(err);
    }
});

router.get('/access-point/find', middlewares.requireAuthDoor, async (req, res, next) => {
    try {
        let authDoor = res.authDoor
        let code = lodash.get(req, 'query.code')

        let person = await db.main.Person.findOne({
            uid: code
        })

        if(!person){
            throw new Error('Person not found.')
        }


        if(authDoor.type === 1) { // Entrance
            // Check if already entered 
            let entered = await db.main.Log.findOne({
                personId: person._id,
                entityId: authDoor.entityId,
                inside: true,
            })
            if(entered){
                throw new Error('Person already entered.')
            }

        } else if(authDoor.type === 2) { // Exit
            // Check if already exited
            let exited = await db.main.Log.findOne({
                personId: person._id,
                entityId: authDoor.entityId,
                inside: false,
            })
            if(exited){
                throw new Error('Person already exited.')
            }
        } else { 
            throw new Error(`Invalid door type "${authDoor.type}".`)
        }

        // check if entered or exit
        let log = await db.main.Log.findOne({
            personId: person._id,
            entityId: authDoor.entityId,
            enteredAt: {
                $ne: null
            },
            exitedAt: null
        }).sort({_id:-1})
        if(!log){
            log = new db.main.Log({
                personId: person._id,
                entityId: authDoor.entityId,
                inside: true,
                enteredOn: authDoor._id,
                enteredAt: new Date(),
            })
            await log.save()

        } else {
            log.exitedOn = authDoor._id
            log.exitedAt = new Date()
            log.inside = false
            await log.save()

        }
        

        res.render('access-point/check-in.html',{
            authDoor: authDoor.toObject(),
            person: person,
            log: log,
        })

    } catch (err) {
        next(err);
    }
});

module.exports = router;