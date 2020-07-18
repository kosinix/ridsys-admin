//// Core modules

//// External modules
const mongoose = require('mongoose');

//// Code
let cred = CRED.mongodb.connections.main
let conf = CONFIG.mongodb.connections.main
let opts = conf.options
opts.promiseLibrary = Promise // Use ES6 Promise
opts.retryWrites = false

let main = mongoose.createConnection(`mongodb://${cred.username}:${cred.password}@${conf.host}/${conf.db}?retryWrites=false`, opts);

main.on('connected', () => {
    console.log('Database connected to', conf.host + '/' + conf.db);
});
main.catch((err) => {
    console.log('Connection error:', err.message);
});
main.on('disconnected', () => {
    console.log('Database disconnected from', conf.host + '/' + conf.db);
});

main.Address = main.model('Address', require('./models/address'));
main.App = main.model('App', require('./models/app'));
main.Application = main.model('Application', require('./models/application'));
main.Door = main.model('Door', require('./models/door'));
main.Entity = main.model('Entity', require('./models/entity'));
main.Log = main.model('Log', require('./models/log'));
main.Login = main.model('Login', require('./models/login'));
main.Pass = main.model('Pass', require('./models/pass'));
main.Permission = main.model('Permission', require('./models/permission'));
main.Person = main.model('Person', require('./models/person'), 'people');
main.Role = main.model('Role', require('./models/role'));
main.User = main.model('User', require('./models/user'));


module.exports = {
    mongoose: mongoose,
    main: main,
}