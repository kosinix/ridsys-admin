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
        res.render('access-point/index.html')
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

        let log = new db.main.Log({
            personId: person._id,
            doorId: authDoor._id,
            inside: true,
            timeIn: new Date()
        })

        let prevLog = await db.main.Log.findOne({
            personId: person._id,
            doorId: authDoor._id,
        }).sort({createdAt: -1})

        if(prevLog){
            if(prevLog.inside){
                prevLog.inside = false
                prevLog.timeOut = new Date()
                log = prevLog
            }
        }

        await log.save()

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