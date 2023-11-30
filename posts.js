const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');
const datastore = ds.datastore;
const POST = "Post";
const INTERACTION = "Interaction";
const json2html = require('node-json2html');
const { get } = require('request');
const template = { '<>': 'ul', 'html': '{ "content": ${content}, "hashtag": ${hashtag}, "verification": ${verification}, "self": ${self} }' };
const MAX_POST_LENGTH = 140;

// Snippet taken from https://tecadmin.net/get-current-date-time-javascript/
function getDateTime() {
    let today = new Date();
    let date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    let dateTime = date + ' ' + time;

    return dateTime;
}

router.use(bodyParser.json());

/* ------------- Begin Post Model Functions ------------- */

// Create an eX Post
// TODO: maybe add public/private posts
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

// Interact with an eX Post
function putInteractWithExPost(postId, interactionId, body) {
    const exPostKey = datastore.key([POST, parseInt(postId, 10)]);
    //TODO: should i keep this?
    const interactionKey = datastore.key([INTERACTION, parseInt(interactionId, 10)]);

    return datastore.get(exPostKey)
        .then((exPost) => {
            // if (typeof (exPost[0].interactions) === null) {
            //     exPost[0].interactions = [];
            // }

            // for (let i = 0; i < exPost[0].interactions.length; i++) {
            //     if (exPost[0].interactions[i] === interactionId) {
            //         return -1;
            //     }
            // }
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

// Delete an eX Post
function deleteExPost(postId) {
    const key = datastore.key([POST, parseInt(postId, 10)]);
    return datastore.delete(key);
}

//TODO: change interactionId to postId
// Delete a an associated interaction
function deleteInteraction(interactionId) {
    const key = datastore.key([INTERACTION, parseInt(interactionId, 10)]);
    return datastore.delete(key);
}

// Edit an eX Post
function putExPost(postId, editedExPostProperties, originalExPostProperties) {
    const key = datastore.key([POST, parseInt(postId, 10)]);

    let updatedExPost = {
        "content": editedExPostProperties.content,
        "hashtag": editedExPostProperties.hashtag,
        "verification": editedExPostProperties.verification,
        "dateTimeCreated": originalExPostProperties.dateTimeCreated,
        "dateTimeLastEdit": editedExPostProperties.dateTimeLastEdit,
        "interactions": originalExPostProperties.interactions,
        "status": originalExPostProperties.status,
        "self": originalExPostProperties.self
    };

    return datastore.save({ "key": key, "data": updatedExPost }).then(() => {
        return { key, data: updatedExPost }
    });
}

// View all eX posts
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

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */


// Create an eX Post
router.post('/', function (req, res) {
    if (req.get('content-type') !== 'application/json') {
        res.status(415).end();
    } else if (req.body.content === undefined ||
        req.body.hashtag === undefined ||
        req.body.verification === undefined) {
        res.status(400).json({ 'Error': 'The request object is missing at least one of the required attributes' });
    } else if (req.body.content.length > MAX_POST_LENGTH) {
        res.status(403).json({ 'Error': 'Posts may only be up to 140 characters long' }).end();
    } else {

        let exPostContents = {
            content: req.body.content,
            hashtag: req.body.hashtag,
            verification: req.body.verification
        }

        postExPost(exPostContents)
            .then(result => {
                // Create a new eX post of acceptable length
                const key = result.key;
                const data = result.data;
                const selfLink = req.get("host") + req.baseUrl + "/" + key.id;
                const newExPost = {
                    "id": key.id,
                    "content": data.content,
                    "hashtag": data.hashtag,
                    "verification": data.verification,
                    "dateTimeCreated": data.dateTimeCreated,
                    "dateTimeLastEdit": data.dateTimeLastEdit,
                    "interactions": data.interactions,
                    "status": data.status,
                    "self": selfLink
                };

                res.status(201).send(newExPost);
            })
    }
});

router.put('/:postId/interactions/:interactionId', function (req, res) {
    // validate eX post id first
    const postId = req.params.postId;
    const interactionId = req.params.interactionId;

    if (postId < 1000000000000000 || interactionId < 1000000000000000) {
        res.status(404).json({ 'Error': 'The specified eX Post and/or interaction does not exist' });
    } else {
        //TODO: verify that interactionId is a valid id. Right now, I can PUT any num on a post.
        putInteractWithExPost(req.params.postId, req.params.interactionId, req.body)
            .then(result => {
                if (result === -1) {
                    // TODO: the interaction id can only be used once?
                    res.status(403).json({ 'Error': 'The interaction is already loaded on another eX Post' });
                } else {
                    //TODO: is 204 right status to send?
                    res.status(204).end();
                }
            })
    }
});

// Delete an eX Post
router.delete('/:postId', function (req, res) {
    if ((req.params.postId < 1000000000000000) || req.params.postId === 'null') {
        res.status(404).end();
    } else {
        const exPosts = getExPosts()
            .then((exPosts) => {
                deleteExPost(req.params.postId)
                    .then(result => {
                        let isValidPostId = false;

                        // There are no posts to be deleted
                        if (exPosts.length === 0) {
                            res.status(404).end();
                        }

                        else {
                            // Iterate over all posts to find the eX post to be deleted
                            for (let i = 0; i < exPosts.length; i++) {
                                //TODO: is this id or postId???
                                if (req.params.postId === exPosts[i].id) {
                                    // Found a valid eX post id and create old eX post object
                                    originalExPost = exPosts[i];
                                    //TODO: iterate through every interaction and delete those interactions
                                    for (let j = 0; j < originalExPost.interactions.length; j++) {
                                        deleteInteraction(originalExPost.interactions[j].interactionId);
                                    }
                                    isValidPostId = true;
                                    break;
                                }
                            }
                            if (isValidPostId) {
                                //TODO: delete interaction associated with post
                                res.status(204).end();
                            }
                            else {
                                res.status(404).end();
                            }

                        }
                    }
                    )
            })
    }
});

// Delete posts attempt
router.delete('/', function (req, res) {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

// Edit a post
// TODO: only edit if verified user
router.put('/:postId', function (req, res) {
    const accepts = req.accepts(['application/json', 'text/html']);
    if (req.params.postId < 1000000000000000 || req.params.postId === 'null') {
        res.status(404).json({ 'Error': 'No eX post with this id exists' });
    } else if (req.body.content === undefined ||
        req.body.hashtag === undefined ||
        req.body.verification === undefined) {
        res.status(400).json({ 'Error': 'The request object is missing at least one of the required attributes' });
    } else if (!accepts) {
        res.status(406).send('Not Acceptable');
    } else if ((accepts === 'application/json') || (accepts === 'text/html')) {
        const exPosts = getExPosts()
            .then((exPosts) => {
                let isValidPostId = false;

                // Iterate over all posts to find matching post id
                for (let i = 0; i < exPosts.length; i++) {
                    if (exPosts[i].id === req.params.postId) {
                        isValidPostId = true;
                    }
                }
                // Update post
                if (isValidPostId) {

                    // Post's content exceeded acceptable length
                    if (req.body.content.length > MAX_POST_LENGTH) {
                        res.status(403).json({ 'Error': 'Posts may only be up to 140 characters long' }).end();
                    } else {
                        originalExPost = getExPost(req.params.postId)
                            .then(originalExPost => {
                                originalExPostProperties = originalExPost[0];
                                let dateTimeLastEdit = getDateTime();
                                // Pass in remaining properties to edited post
                                let editedExPostProperties = {
                                    content: req.body.content,
                                    hashtag: req.body.hashtag,
                                    verification: req.body.verification,
                                    dateTimeLastEdit: dateTimeLastEdit
                                }

                                putExPost(req.params.postId, editedExPostProperties, originalExPostProperties)
                                    .then(result => {
                                        originalExPost = originalExPost[0];
                                        const key = result.key;
                                        const data = result.data;
                                        const selfLink = req.get("host") + req.baseUrl + "/" + key.id;
                                        const updatedExPost = {
                                            "id": key.id,
                                            "content": data.content,
                                            "hashtag": data.hashtag,
                                            "verification": data.verification,
                                            "dateTimeCreated": originalExPost.dateTimeCreated,
                                            "dateTimeLastEdit": dateTimeLastEdit,
                                            "interactions": originalExPost.interactions,
                                            "status": originalExPost.status,
                                            "self": selfLink
                                        };

                                        // Send back the updated post as json or html
                                        if (accepts === 'application/json') {
                                            res.status(303).set("Location", selfLink).send(updatedExPost);
                                        } else {
                                            let htmlUpdateExPost = json2html.render(updatedExPost, template);
                                            res.status(303).set("Location", selfLink).send(htmlUpdateExPost);
                                        }
                                    })

                            });

                    }
                }
            })
    } else { res.status(500).send('Content type got messed up!'); }
});

// Edit a post
// router.patch('/:id', function (req, res) {
//     const accepts = req.accepts(['application/json', 'text/html']);
//     if (req.params.id < 1000000000000000 || req.params.id === 'null') {
//         res.status(404).json({ 'Error': 'No post with this id exists' });
//     } else if (!accepts) {
//         res.status(406).send('Not Acceptable');
//     } else if ((accepts === 'application/json') || (accepts === 'text/html')) {
//         const posts = getExPosts()
//             .then((posts) => {
//                 let originalExPost;
//                 let newExPost_content = req.body.content;
//                 let newExPost_hashtag = req.body.hashtag;
//                 let newExPost_verification = req.body.verification;
//                 let is_duplicate_post_content = false;
//                 let isValidPostId = false;

//                 // // Check for a post content that already exists
//                 // for (let i = 0; i < posts.length; i++) {
//                 //     if (req.body.content === posts[i].content) {
//                 //         // Cannot update a post's content to one that already exists
//                 //         res.status(403).json({ 'Error': 'A post with that content already exists' });
//                 //         is_duplicate_post_content = true;
//                 //         break;
//                 //     }
//                 //     if (req.params.id === posts[i].id) {
//                 //         // Found a valid post id and create old post object
//                 //         originalExPost = posts[i];
//                 //         isValidPostId = true;
//                 //     }
//                 // }
//                 // Update post
//                 if (!is_duplicate_post_content && isValidPostId) {
//                     if (newExPost_content === undefined) {
//                         newExPost_content = posts[0].content;
//                     }

//                     if (newExPost_hashtag === undefined) {
//                         newExPost_hashtag = posts[0].hashtag;
//                     }

//                     if (newExPost_verification === undefined) {
//                         newExPost_verification = posts[0].verification;
//                     }

//                     let content_checcheck_content_and_length(newExPost_content);

//                     // Post's content exceeded acceptable length
//                     if (content_check[0] === false) {
//                         res.status(403).json({ 'Error': 'Post contents may only be up to 140 characters long' }).end();
//                         return;
//                     }
//                     // Post's content contains unacceptable character(s)
//                     if (content_check[1] === false) {
//                         res.status(403).json({ 'Error': 'The characters "~!@#$%^&*()_+" are not allowed in a post' }).end();
//                         return;
//                     }

//                     // Update post with valid data
//                     if (content_check[0] && content_check[1]) {
//                         putExPost(req.params.id, newExPost_content, newExPost_hashtag, newExPost_verification)
//                             .then(result => {
//                                 const key = result.key;
//                                 const data = result.data;
//                                 const selfLink = req.get("host") + req.baseUrl + "/" + key.id;
//                                 const updatedExPost = { "id": key.id, "content": data.content, "hashtag": data.hashtag, "verification": data.verification, "self": selfLink };

//                                 // Send back the updated post as json or html
//                                 if (accepts === 'application/json') {
//                                     res.status(200).set("Location", selfLink).send(updatedExPost);
//                                 } else {
//                                     let htmlUpdateExPost = json2html.render(updatedExPost, template);
//                                     res.status(200).set("Location", selfLink).send(htmlUpdateExPost);
//                                 }
//                             })
//                     }

//                 } else if (!isValidPostId && !is_duplicate_post_content) {
//                     res.status(403).json({ 'Error': 'A post with that id does not exist' }).end();
//                 }
//             })
//     } else { res.status(500).send('Content type got messed up!'); }
// });

// Edit posts attempt
router.put('/', function (req, res) {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

// Edit posts attempt
router.patch('/', function (req, res) {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

// Get posts
router.get('/', function (req, res) {
    const posts = getExPosts()
        .then((posts) => {
            let posts_without_interactions = []
            for (let i = 0; i < posts.length; i++) {
                let curr_post = {
                    id: posts[i].id,
                    content: posts[i].content,
                    hashtag: posts[i].hashtag,
                    status: posts[i].status
                };
                posts_without_interactions.push(curr_post);
            }
            res.status(200).json(posts_without_interactions);
        });
});

// Get a post
router.get('/:postId', function (req, res) {
    if (req.params.postId < 1000000000000000 || req.params.postId === 'null') {
        res.status(404).json({ 'Error': 'No post with this id exists' });
    } else {
        const posts = getExPost(req.params.postId)
            .then(post => {
                const accepts = req.accepts(['application/json', 'text/html']);

                if (!accepts) {
                    res.status(406).send('Not Acceptable');
                } else if (accepts === 'application/json') {
                    const data = post[0];
                    const selfLink = req.get("host") + req.baseUrl + "/" + data.id;
                    const newExPost = { "id": data.id, "content": data.content, "hashtag": data.hashtag, "verification": data.verification, "self": selfLink };
                    res.status(200).json(newExPost);
                } else if (accepts === 'text/html') {
                    res.status(200).send(json2html(post).slice(1, -1));
                } else { res.status(500).send('Content type got messed up!'); }

                if (post[0] === undefined || post[0] === null) {
                    res.status(404).json({ 'Error': 'No post with this id exists' });
                }
            });
    }

});

/* ------------- End Controller Functions ------------- */

module.exports = router;