const ds = require('../database/datastore');
const datastore = ds.datastore;
const INTERACTION = "Interaction";

// Snippet taken from https://tecadmin.net/get-current-date-time-javascript/
function getDateTime() {
    let today = new Date();
    let date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    let dateTime = date + ' ' + time;

    return dateTime;
}

/* ------------- Begin interaction Model Functions ------------- */
function postInteraction(reposts, likes, views, postId) {
    var key = datastore.key(INTERACTION);
    let dateTime = getDateTime();

    const newInteraction = {
        "reposts": reposts,
        "likes": likes,
        "views": views,
        "postId": postId
    };

    return datastore.save({ "key": key, "data": newInteraction })
        .then(() => {
            return { key, data: newInteraction }
        });
}

function getInteractions(req) {
    var q = datastore.createQuery(INTERACTION).limit(3);
    const results = {};
    let prev;

    if (Object.keys(req.query).includes("cursor")) {
        prev = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + req.query.cursor;
        q = q.start(req.query.cursor);
    }

    return datastore.runQuery(q)
        .then((entities) => {
            results.items = entities[0].map(ds.fromDatastore);

            if (typeof prev !== 'undefined') {
                results.previous = prev;
            }

            if (entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS) {
                results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + entities[1].endCursor;
            }

            return results;
        });
}

function getInteraction(interactionId) {
    const key = datastore.key([INTERACTION, parseInt(interactionId, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            return entity.map(ds.fromDatastore);
        }
    });
}

function putInteraction(interactionId, editedInteractionProperties, originalInteractionProperties) {
    const key = datastore.key([INTERACTION, parseInt(interactionId, 10)]);

    const editedInteraction = {
        "repost": editedInteractionProperties.repost,
        "like": editedInteractionProperties.like,
        "view": originalInteractionProperties.view, // Cannot modify views
        "self": originalInteractionProperties.self
    };

    return datastore.save({ "key": key, "data": editedInteraction })
        .then(() => {
            return { key, data: editedInteraction }
        });
}

function patchInteraction(postId, editedExPostProperties) {
    const key = datastore.key([INTERACTION, parseInt(postId, 10)]);

    let editedInteraction = {
        "repost": editedInteractionProperties.repost,
        "like": editedInteractionProperties.like,
        "view": editedInteractionProperties.view, // Cannot modify views
        "self": editedInteractionProperties.self
    };

    return datastore.save({ "key": key, "data": editedInteraction })
        .then(() => {
            return { key, data: editedInteraction }
        });
}

// TODO: I want to delete an interaction but keep the post.
// make a new function called deleteInteractionPutPost() to handle this
// const exPostKey = datastore.key([POST, parseInt(postId, 10)]);

//     // const interactionKey = datastore.key([POST, parseInt(postId, 10)]);

//     // Get eX Post to be deleted
//     let exPost = getExPost(postId)
//         .then(result => {
//             // Iterate through associated interactions
//             for (let i = 0; i < exPost.interactions.length; i++) {
//                 // Decrement repost if reposted
//                 if (exPost.interactions.repost === true) {
//                     exPost.status.reposts -= 1;
//                 }

//                 // Decrement like if liked
//                 if (exPost.interactions.like === true) {
//                     exPost.status.likes -= 1;
//                 }

//                 // Views remain the same

//                 // Delete interaction entity from Interactions array
//                 modifyInteractionFunctions.deleteInteraction(exPost.interactions.interactionId);
//             }

//             return datastore.delete(exPostKey);
//         });

function deleteInteraction(interactionId) {
    const key = datastore.key([INTERACTION, parseInt(interactionId, 10)]);
    return datastore.delete(key);
}

/* ------------- End Model Functions ------------- */

module.exports = {
    getDateTime,
    postInteraction,
    getInteractions,
    getInteraction,
    putInteraction,
    deleteInteraction
}