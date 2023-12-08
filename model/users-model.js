const ds = require('../database/datastore');

const datastore = ds.datastore;
const USER = "User";

function fromDatastore(item) {
    try {
        item.id = item[datastore.KEY].id;
        return item;
    } catch {
        return -1;
    }
}

/* ------------- Begin User Model Functions ------------- */

function getUser(user) {
    const q = datastore.createQuery(USER);
    return datastore.runQuery(q).then((entities) => {
        return entities[0].map(fromDatastore).filter(item => item.user === user);
    });
}

// View all users unprotected
function getUsersUnprotected(req) {
    const q = datastore.createQuery(USER);
    return datastore.runQuery(q).then((entities) => {
        return entities[0].map(fromDatastore);
    });
}

// Create an eX User
function postUser(jwt) {
    let key = datastore.key(USER);

    const newUser = {
        "jwt": jwt,
    }

    return datastore.save({ "key": key, "data": newUser })
        .then(() => {
            return { key, data: newUser }
        });
}

/* ------------- End Model Functions ------------- */

module.exports = {
    getUser,
    postUser,
    getUsersUnprotected
}
