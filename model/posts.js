const express = require('express');
const bodyParser = require('body-parser');
const app = express();

// const router = express.Router();
const login = express.Router();

const ds = require('../datastore');
const datastore = ds.datastore;
const POST = "Post";
const INTERACTION = "Interaction";


// Snippet taken from https://tecadmin.net/get-current-date-time-javascript/
function getDateTime() {
    let today = new Date();
    let date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    let dateTime = date + ' ' + time;

    return dateTime;
}

// router.use(bodyParser.json());

/* ------------- Begin Post Model Functions ------------- */

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

    return datastore.save({ "key": key, "data": newExPost }).then(() => {
        return { key, data: newExPost }
    });
}

// View all eX Posts
function getExPosts() {
    const q = datastore.createQuery(POST);
    return datastore.runQuery(q).then((entities) => {
        return entities[0].map(ds.fromDatastore);
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

    return datastore.save({ "key": key, "data": editedExPost }).then(() => {
        return { key, data: editedExPost }
    });
}

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

    return datastore.save({ "key": key, "data": editedExPost }).then(() => {
        return { key, data: editedExPost }
    });
}

// Interact with an eX Post
function putInteractWithExPost(postId, interactionId, body) {
    const exPostKey = datastore.key([POST, parseInt(postId, 10)]);
    const interactionKey = datastore.key([INTERACTION, parseInt(interactionId, 10)]);

    return datastore.get(exPostKey)
        .then((exPost) => {

            let newInteraction = { interactionId: interactionId, repost: body.repost, like: body.like, view: body.view }
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

// Delete an associated interaction
function deleteInteraction(interactionId) {
    const key = datastore.key([INTERACTION, parseInt(interactionId, 10)]);
    return datastore.delete(key);
}

// Delete an eX Post
function deleteExPost(postId) {
    const key = datastore.key([POST, parseInt(postId, 10)]);
    return datastore.delete(key);
}

/* ------------- End Model Functions ------------- */



app.use('/login', login);
// module.exports = router;