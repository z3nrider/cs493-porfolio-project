const ds = require('../database/datastore');
const datastore = ds.datastore;
const USER = "User";

function fromDatastore(item) {
    try {
        item.id = item[Datastore.KEY].id;
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

// Create an eX Post
function postUser(user) {
    let key = datastore.key(USER);

    const newUser = {
        "id": key.id,
        "name": user.user.name,
        "email": user.user.email,
        "nickname": user.user.nickname,
        "sub": user.user.sub,
        "jwt": user.jwt
    }

    return datastore.save({ "key": key, "data": newUser })
        .then(() => {
            return { key, data: newUser }
        });
}

/* ------------- End Model Functions ------------- */

module.exports = {
    getUser,
    postUser
}
