const ds = require('../database/datastore');
const datastore = ds.datastore;
const POST = "Post";
const INTERACTION = "Interaction";

function fromDatastore(item) {
    try {
        item.id = item[datastore.KEY].id;
        return item;
    } catch {
        return -1;
    }
}

// Snippet taken from https://tecadmin.net/get-current-date-time-javascript/
function getDateTime() {
    let today = new Date();
    let date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    let dateTime = date + ' ' + time;

    return dateTime;
}

/* ------------- Begin Post Model Functions ------------- */

function getOwnerExPosts(owner) {
    const q = datastore.createQuery(POST);
    return datastore.runQuery(q).then((entities) => {
        return entities[0].map(fromDatastore).filter(item => item.owner === owner);
    });
}

function getOwnerExPost(postId) {
    const key = datastore.key([POST, parseInt(postId, 10)]);
    return datastore.get(key).then((data) => {
        return fromDatastore(data[0]);
    }
    );
}

// Create an eX Post
function postExPost(exPostContents) {
    let key = datastore.key(POST);
    let dateTime = getDateTime();

    const newExPost = {
        "content": exPostContents.content,  // Content of the eX post
        "hashtag": exPostContents.hashtag,
        "verification": exPostContents.verification,  // A boolean that shows user verification status
        "dateTimeCreated": dateTime,
        "dateTimeLastEdit": null,
        "interactions": [],  // An array of interactions that contain interaction events
        "status": { reposts: 0, likes: 0, views: 0 }  // Cumulative interaction events
    }

    return datastore.save({ "key": key, "data": newExPost })
        .then(() => {
            return { key, data: newExPost }
        });
}

// View all eX Posts
function getExPosts(req) {
    let q = datastore.createQuery(POST).limit(5);
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

// View all eX Posts unprotected
function getExPostsUnprotected() {
    const q = datastore.createQuery(POST);
    return datastore.runQuery(q).then((entities) => {
        return entities[0].map(fromDatastore);
    });
}

// View an eX post
function getExPost(postId) {
    const key = datastore.key([POST, parseInt(postId, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            return entity.map(ds.fromDatastore);
        }
    });
}

// Edit an eX Post
function putExPost(postId, editedExPostProperties, originalExPostProperties) {
    const key = datastore.key([POST, parseInt(postId, 10)]);

    let editedExPost = {
        "content": editedExPostProperties.content,
        "hashtag": editedExPostProperties.hashtag,
        "verification": editedExPostProperties.verification,
        "dateTimeCreated": originalExPostProperties.dateTimeCreated,
        "dateTimeLastEdit": editedExPostProperties.dateTimeLastEdit,
        "interactions": originalExPostProperties.interactions,
        "status": originalExPostProperties.status,
        "self": originalExPostProperties.self
    };

    return datastore.save({ "key": key, "data": editedExPost })
        .then(() => {
            return { key, data: editedExPost }
        });
}

// Edit an eX Post's associated Interaction
function putExPostInteraction(postId, updatedInteraction, originalExPostProperties) {
    const key = datastore.key([POST, parseInt(postId, 10)]);

    for (let i = 0; i < originalExPostProperties.interactions.length; i++) {
        if (originalExPostProperties.interactions[i].interactionId === updatedInteraction.interactionId) {
            // Update repost count
            if (originalExPostProperties.interactions[i].repost === true) {
                if (updatedInteraction.repost === false) {
                    // Decrement reposts count
                    let repostsCount = originalExPostProperties.status.reposts;
                    // Reposts cannot go below 0
                    if (repostsCount > 0) {
                        originalExPostProperties.status.reposts -= 1;
                    }
                }
            } else {
                if (updatedInteraction.repost === true) {
                    // Increment reposts count
                    originalExPostProperties.status.reposts += 1;
                }
            }

            // Update like count
            if (originalExPostProperties.interactions[i].like === true) {
                if (updatedInteraction.like === false) {
                    // Decrement reposts count
                    let likesCount = originalExPostProperties.status.likes;
                    // Reposts cannot go below 0
                    if (likesCount > 0) {
                        originalExPostProperties.status.likes -= 1;
                    }
                }
            } else {
                if (updatedInteraction.like === true) {
                    // Increment reposts count
                    originalExPostProperties.status.likes += 1;
                }
            }
            break;
        }
    }
    let editedExPost = originalExPostProperties;


    return datastore.save({ "key": key, "data": editedExPost })
        .then(() => {
            return { key, data: editedExPost }
        });
}

//TODO: double check that I'm modifying all these properties
// Edit an eX Post
function patchExPost(postId, editedExPostProperties) {
    const key = datastore.key([POST, parseInt(postId, 10)]);

    let editedExPost = {
        "content": editedExPostProperties.content,
        "hashtag": editedExPostProperties.hashtag,
        "verification": editedExPostProperties.verification,
        "dateTimeCreated": editedExPostProperties.dateTimeCreated,
        "dateTimeLastEdit": editedExPostProperties.dateTimeLastEdit,
        "interactions": editedExPostProperties.interactions,
        "status": editedExPostProperties.status,
        "self": editedExPostProperties.self
    };

    return datastore.save({ "key": key, "data": editedExPost })
        .then(() => {
            return { key, data: editedExPost }
        });
}

// Interact with an eX Post
function putInteractWithExPost(postId, interactionId, body) {
    const exPostKey = datastore.key([POST, parseInt(postId, 10)]);
    const interactionKey = datastore.key([INTERACTION, parseInt(interactionId, 10)]);

    return datastore.get(exPostKey)
        .then((exPost) => {

            let newInteraction = {
                interactionId: interactionId,
                repost: body.repost,
                like: body.like,
                view: body.view
            }
            exPost[0].interactions.push(newInteraction);

            previousReposts = exPost[0].status.reposts;
            previousLikes = exPost[0].status.likes;
            previousViews = exPost[0].status.views;

            // Update number of reposts if reposted
            if (body.repost === true) {
                let currentReposts = previousReposts += body.repost;
                exPost[0].status.reposts = currentReposts;
            }

            // Update number of likes if liked
            if (body.like === true) {
                currentLikes = previousLikes += body.like;
                exPost[0].status.likes = currentLikes;
            }

            // Views always increment
            exPost[0].status.views = previousViews += 1;

            console.log("Interacted with eX Post:\n", exPost[0]);
            return datastore.save({ "key": exPostKey, "data": exPost[0] });
        })
}

// Delete an eX Post
function deleteExPost(postId) {
    const exPostKey = datastore.key([POST, parseInt(postId, 10)]);

    return datastore.delete(exPostKey);
}

/* ------------- End Model Functions ------------- */

module.exports = {
    getOwnerExPosts,
    getOwnerExPost,
    getDateTime,
    postExPost,
    getExPosts,
    getExPostsUnprotected,
    getExPost,
    putExPost,
    putExPostInteraction,
    patchExPost,
    putInteractWithExPost,
    deleteExPost
}
