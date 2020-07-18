
//// Core modules

//// External modules
const access = require('acrb');
const lodash = require('lodash');

//// Modules
const db = require('./db');
const passwordMan = require('./password-man');
const uploader = require('./uploader');

let allowIp = async (req, res, next) => {
    try {
        if (CONFIG.ipCheck === false) {
            return next();
        }

        let ips = await db.main.AllowedIP.find(); // Get from db
        let allowed = lodash.map(ips, (ip) => { // Simplify
            return ip.address;
        })

        if (allowed.length <= 0) { // If none from db, get from config
            allowed = CONFIG.ip.allowed;
        }
        let ip = req.headers['x-real-ip'] || req.connection.remoteAddress;

        if (allowed.includes(ip) || allowed.length <= 0) {
            return next();
        }
        res.setHeader('X-IP', ip);
        res.status(400).send('Access denied from ' + ip)
    } catch (err) {
        next(err);
    }
}

let antiCsrfCheck = async (req, res, next) => {
    try {
        let acsrf = lodash.get(req, 'body.acsrf')

        if (lodash.get(req, 'session.acsrf') === acsrf) {
            return next();
        }
        res.status(400).send('Cross-site request forgery error')
    } catch (err) {
        next(err);
    }
}

let getUser = async (req, res, next) => {
    try {
        let userId = req.params.userId || "";
        let user = await db.main.User.findById(userId);
        if (!user) {
            return res.render('error.html', { error: "Sorry, user not found." })
        }
        next();
    } catch (err) {
        next(err);
    }
}

let handleExpressUploadMagic = async (req, res, next) => {
    try {
        let files = lodash.get(req, 'files', [])
        let localFiles = await uploader.handleExpressUploadLocalAsync(files, CONFIG.app.dirs.upload)
        let imageVariants = await uploader.resizeImagesAsync(localFiles, null, CONFIG.app.dirs.upload); // Resize uploaded images

        let uploadList = uploader.generateUploadList(imageVariants, localFiles)
        let saveList = uploader.generateSaveList(imageVariants, localFiles)
        await uploader.uploadToS3Async(uploadList)
        await uploader.deleteUploadsAsync(localFiles, imageVariants)
        req.localFiles = localFiles
        req.imageVariants = imageVariants
        req.saveList = saveList
        next()
    } catch (err) {
        next(err)
    }
}

let requireAuthUser = async (req, res, next) => {
    try {
        let authUserId = lodash.get(req, 'session.authUserId');
        if (!authUserId) {
            return res.redirect('/login')
        }
        let user = await db.main.User.findById(authUserId);
        if (!user) {
            return res.redirect('/login')
        }
        res.user = user;
        next();
    } catch (err) {
        next(err)
    }
}

let requireAuthDoor = async (req, res, next) => {
    try {
        let authDoorId = lodash.get(req, 'session.authDoorId');
        if (!authDoorId) {
            return res.redirect('/access-point/login')
        }
        let authDoor = await db.main.Door.findById(authDoorId);
        if (!authDoor) {
            return res.redirect('/access-point/login')
        }
        res.authDoor = authDoor;
        next();
    } catch (err) {
        next(err)
    }
}


module.exports = {
    api: {
        getAuthApp: async (req, res, next) => {
            try {
                // Uses Basic Auth for mambu compat
                let authorization = lodash.get(req, 'headers.authorization', '').replace('Basic', '').replace(' ', '')
                let decoded = Buffer.from(authorization, 'base64').toString();
                let split = decoded.split(':')
                let publicId = lodash.get(split, '0', '')
                let password = lodash.get(split, '1', '')

                if (!publicId || !password) {
                    throw new Error('Invalid credentials.')
                }

                if (!db.mongoose.Types.ObjectId.isValid(publicId)) {
                    throw new Error('Invalid credentials.')
                }

                let user = await db.main.App.findOne({
                    _id: publicId,
                    active: true
                });
                if (!user) {
                    throw new Error('App not found.')
                }

                // Check password
                let passwordHash = passwordMan.hashPassword(password, user.salt);
                if (passwordHash !== user.passwordHash) {
                    throw new Error('Incorrect password.')
                }

                res.authApp = user;

                next();
            } catch (err) {
                next(err);
            }
        },
    },
    allowIp: allowIp,
    antiCsrfCheck: antiCsrfCheck,
    guardRoute: (permissions) => {
        return async (req, res, next) => {
            try {
                let user = res.user
                let rolesList = await db.main.Role.find()
                if (!access.and(user, permissions, rolesList)) {
                    return res.render('error.html', {
                        error: `Access denied. Required permissions: ${permissions.join(', ')}.`
                    })
                }
                next()
            } catch (err) {
                next(err)
            }
        }
    },
    getEntity: async (req, res, next) => {
        try {
            let entityId = req.params.entityId || "";
            let entity = await db.main.Entity.findById(entityId);
            if (!entity) {
                return res.render('error.html', { error: "Sorry, entity not found." })
            }
            res.entity = entity
            next();
        } catch (err) {
            next(err);
        }
    },
    getDoor: async (req, res, next) => {
        try {
            let doorId = req.params.doorId || "";
            let door = await db.main.Door.findById(doorId);
            if (!door) {
                return res.render('error.html', { error: "Sorry, door not found." })
            }
            res.door = door
            next();
        } catch (err) {
            next(err);
        }
    },
    getPerson: async (req, res, next) => {
        try {
            let personId = req.params.personId || "";
            let person = await db.main.Person.findById(personId);
            if (!person) {
                return res.render('error.html', { error: "Sorry, person not found." })
            }
            res.person = person
            next();
        } catch (err) {
            next(err);
        }
    },
    getApplication: async (req, res, next) => {
        try {
            let applicationId = req.params.applicationId || "";
            let application = await db.main.Application.findById(applicationId);
            if (!application) {
                return res.render('error.html', { error: "Sorry, application not found." })
            }
            res.application = application
            next();
        } catch (err) {
            next(err);
        }
    },
    getUser: getUser,
    handleExpressUploadMagic: handleExpressUploadMagic,
    requireAuthUser: requireAuthUser,
    requireAuthDoor: requireAuthDoor,
}