const ds = require('../database/datastore');
const datastore = ds.datastore;
const INTERACTION = "Interaction";
const exPostsModelFunctions = require('../model/posts-model');


// Snippet taken from https://tecadmin.net/get-current-date-time-javascript/
function getDateTime() {
    let today = new Date();
    let date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    let dateTime = date + ' ' + time;

    return dateTime;
}

/* ------------- Begin interaction Model Functions ------------- */
function postInteraction(repost, like, view, postId) {
    let key = datastore.key(INTERACTION);

    const newInteraction = {
        "repost": repost,
        "like": like,
        "view": view,
        "postId": postId
    };

    return datastore.save({ "key": key, "data": newInteraction })
        .then(() => {
            return { key, data: newInteraction }
        });
}

function getInteractions(req) {
    var q = datastore.createQuery(INTERACTION).limit(5);
    let results = {};
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

function deleteInteraction(interactionId) {
    const key = datastore.key([INTERACTION, parseInt(interactionId, 10)]);

    const interaction = getInteraction(interactionId)
        .then(result => {

            // Get eX Post to be deleted
            let exPost = exPostsModelFunctions.getExPost(result[0].postId)
                .then(result => {
                    let exPostInteractionsArr = result[0].interactions;

                    // Iterate through associated interactions
                    for (let i = 0; i < exPostInteractionsArr.length; i++) {

                        // Found associated interaction to be removed from eX Post
                        if (exPostInteractionsArr[i].interactionId === interactionId) {
                            // Decrement repost if reposted
                            if (exPostInteractionsArr[i].repost === true) {
                                result[0].status.reposts -= 1;
                            }

                            // Decrement like if liked
                            if (exPostInteractionsArr[i].like === true) {
                                result[0].status.likes -= 1;
                            }
                            // Views remain the same

                            result[0].interactions.splice(i, 1); // remove associated interaction from post

                            // Patch eX Post
                            let postId = result[0].id;
                            let editedExPostProperties = result[0];
                            let updatedExPost = exPostsModelFunctions.patchExPost(postId, editedExPostProperties)
                                .then(final => {
                                    return datastore.save({ "key": key, "data": updatedExPost })
                                        .then(() => {
                                            return { key, data: updatedExPost }
                                        });
                                })
                        }
                    }
                });
        })
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