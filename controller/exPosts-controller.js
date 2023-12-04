const express = require('express');
const bodyParser = require('body-parser');
const app = express();

const router = express.Router();
const login = express.Router();

const ds = require('../datastore');
const datastore = ds.datastore;
const POST = "Post";
const INTERACTION = "Interaction";
const json2html = require('node-json2html');
const { get } = require('request');
const template = { '<>': 'ul', 'html': '{ "content": ${content}, "hashtag": ${hashtag}, "verification": ${verification}, "self": ${self} }' };
const MAX_POST_LENGTH = 140;

/* ------------- Begin Controller Functions ------------- */

// login.get('/', function (req, res) {
//     res.send('youre gonna login some day');
// });
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

// Get all eX Posts
router.get('/', function (req, res) {
    const posts = getExPosts()
        .then((posts) => {
            let posts_without_interactions = []

            // Omit certain properties when requesting all eX Posts
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

// Get an eX Post
router.get('/:postId', function (req, res) {
    const exPost = getExPost(req.params.postId)
        .then(exPost => {
            const accepts = req.accepts(['application/json', 'text/html']);

            if (!accepts) {
                res.status(406).send('Not Acceptable');
            } else if (accepts === 'application/json') {
                const data = exPost[0];
                const selfLink = req.get("host") + req.baseUrl + "/" + data.id;

                const exPost = {
                    "id": data.id,
                    "content": data.content,  // Content of the eX post
                    "hashtag": data.hashtag,
                    "verification": data.verification,  // A boolean that shows user verification status
                    "dateTimeCreated": data.dateTimeCreated,
                    "dateTimeLastEdit": data.dateTimeLastEdit,
                    "interactions": data.interactions,  // An array of interactions that contain interaction events
                    "status": data.status,  // Cumulative interaction events
                    "self": selfLink
                }
                res.status(200).json(exPost);
            } else if (accepts === 'text/html') {
                const exPostHTML = JSON.stringify(exPost[0]);
                res.status(200).send(`<p>${exPostHTML}</p>`);
            } else { res.status(500).send('Content type got messed up!'); }

            // if (exPost[0] === undefined || exPost[0] === null) {
            //     res.status(404).json({ 'Error': 'No post with this id exists' });
            // }
        });
});

// Edit an eX post
router.put('/:postId', function (req, res) {
    const accepts = req.accepts(['application/json', 'text/html']);

    if (req.body.content === undefined ||
        req.body.hashtag === undefined ||
        req.body.verification === undefined) {
        res.status(400).json({ 'Error': 'The request object is missing at least one of the required attributes' });
    } else if (req.body.content.length > MAX_POST_LENGTH) {
        res.status(403).json({ 'Error': 'Posts may only be up to 140 characters long' });
    } else if (!accepts) {
        res.status(406).json({ 'Error': 'Not Acceptable' });
    } else if ((accepts === 'application/json') || (accepts === 'text/html')) {
        const originalExPost = getExPost(req.params.postId)
            .then(originalExPost => {
                originalExPost = originalExPost[0];

                if (originalExPost === undefined) {
                    res.status(404).end();
                } else if (originalExPost.verification === false) {
                    res.status(403).json({ 'Forbidden': 'Unverified users may not edit eX posts.' });
                } else {
                    let dateTimeLastEdit = getDateTime();
                    // Pass in remaining properties to edited post
                    let editedExPost = {
                        content: req.body.content,
                        hashtag: req.body.hashtag,
                        verification: req.body.verification,
                        dateTimeLastEdit: dateTimeLastEdit
                    }

                    putExPost(req.params.postId, editedExPost, originalExPost)
                        .then(result => {
                            const key = result.key;
                            const data = result.data;
                            const selfLink = req.get("host") + req.baseUrl + "/" + key.id;
                            const editedExPost = {
                                "id": key.id,
                                "content": data.content,
                                "hashtag": data.hashtag,
                                "verification": data.verification,
                                "dateTimeCreated": originalExPost.dateTimeCreated,
                                "dateTimeLastEdit": dateTimeLastEdit,
                                "status": originalExPost.status,
                                "self": selfLink
                            };

                            // Send back the updated post as json or html
                            if (accepts === 'application/json') {
                                res.status(303).set("Location", selfLink).send(editedExPost);
                            } else {
                                let htmlUpdateExPost = json2html.render(editedExPost, template);
                                res.status(303).set("Location", selfLink).send(htmlUpdateExPost);
                            }
                        })
                }
            })
    } else { res.status(500).send('Content type got messed up!'); }
});

// Edit an eX post
router.patch('/:postId', function (req, res) {
    const accepts = req.accepts(['application/json', 'text/html']);
    let contentLength;

    // Handle ex Post edits that do not update content
    try {
        contentLength = req.body.content.length;
    } catch {
        contentLength = 0;
    }

    if (contentLength > MAX_POST_LENGTH) {
        res.status(403).json({ 'Error': 'Posts may only be up to 140 characters long' });
    } if (!accepts) {
        res.status(406).json({ 'Error': 'Not Acceptable' });
    } else if ((accepts === 'application/json') || (accepts === 'text/html')) {
        const originalExPost = getExPost(req.params.postId)
            .then(originalExPost => {
                originalExPost = originalExPost[0];

                if (originalExPost === undefined) {
                    res.status(404).end();
                } else if (originalExPost.verification === false) {
                    res.status(403).json({ 'Forbidden': 'Unverified users may not edit eX posts.' });
                } else {
                    let dateTimeLastEdit = getDateTime();
                    let editedExPost;
                    // Pass in remaining properties to edited post


                    if (req.body.conent !== undefined) {
                        originalExPost.conent = req.body.content;
                    }

                    if (req.body.hashtag !== undefined) {
                        originalExPost.hashtag = req.body.hashtag;
                    }

                    if (req.body.verification !== undefined) {
                        originalExPost.verification = req.body.verification;
                    }

                    originalExPost.dateTimeLastEdit = dateTimeLastEdit;
                    editedExPost = originalExPost;

                    patchExPost(req.params.postId, editedExPost)
                        .then(result => {
                            const key = result.key;
                            const data = result.data;
                            const selfLink = req.get("host") + req.baseUrl + "/" + key.id;
                            const editedExPost = {
                                "id": key.id,
                                "content": data.content,
                                "hashtag": data.hashtag,
                                "verification": data.verification,
                                "dateTimeCreated": originalExPost.dateTimeCreated,
                                "dateTimeLastEdit": dateTimeLastEdit,
                                "status": originalExPost.status,
                                "self": selfLink
                            };

                            // Send back the updated post as json or html
                            if (accepts === 'application/json') {
                                res.status(303).set("Location", selfLink).send(editedExPost);
                            } else {
                                let htmlUpdateExPost = json2html.render(editedExPost, template);
                                res.status(303).set("Location", selfLink).send(htmlUpdateExPost);
                            }
                        })
                }
            })
    } else { res.status(500).send('Content type got messed up!'); }
});

// Edit an eX post's interactions (unlike or unrepost)
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
    const exPost = getExPost(req.params.postId)
        .then(exPost => {
            const data = exPost[0];

            if (data === undefined) {
                res.status(404).end();
            } else {
                //TODO: need to delete associated interactions here
                deleteExPost(req.params.postId)
                    .then(result => {
                        res.status(204).end();
                    })
            }
        })
});

// Delete all eX Posts (attempt)
router.delete('/', function (req, res) {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

// Edit all eX Posts (attempt)
router.put('/', function (req, res) {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

// Edit all eX Posts (attempt)
router.patch('/', function (req, res) {
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

/* ------------- End Controller Functions ------------- */

module.exports = router;