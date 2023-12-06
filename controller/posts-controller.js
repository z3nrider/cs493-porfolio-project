const express = require('express');
const bodyParser = require('body-parser');
const app = express();

const router = express.Router();
const login = express.Router();
const users = express.Router();

const exPostsModelFunctions = require('../model/posts-model');
const interactionsModelFunctions = require('../model/interactions-model');
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const ds = require('../database/datastore');

const DOMAIN = 'dev-gblxtkrkmbzldfsv.us.auth0.com';
const { auth } = require('express-openid-connect');


const json2html = require('node-json2html');
const template = { '<>': 'ul', 'html': '{ "content": ${content}, "hashtag": ${hashtag}, "verification": ${verification}, "self": ${self} }' };
const MAX_POST_LENGTH = 140;

router.use(bodyParser.json());

const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${DOMAIN}/.well-known/jwks.json`
    }),

    // Validate the audience and the issuer.
    issuer: `https://${DOMAIN}/`,
    algorithms: ['RS256']
});

/* ------------- Begin Controller Functions ------------- */


app.get('/', function (req, res) {
    res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
});

users.get('/:userId/posts', checkJwt, function (req, res) {
    let exPostsArr = [];

    exPostsModelFunctions.getOwnerExPosts(req.params.userId)
        .then((posts) => {
            // Iterate over array of posts for specified user
            for (let i = 0; i < posts.length; i++) {
                // Boat is public if true
                if (posts[i].public === true) {
                    exPostsArr.push(posts[i]);
                }
            }

            const accepts = req.accepts(['application/json', 'text/html']);
            if (posts.owner && posts.owner !== req.user.sub) {
                res.status(403).send('Forbidden');
            } else if (!accepts) {
                res.status(406).send('Not Acceptable');
            } else if (accepts === 'application/json') {
                res.status(200).json(exPostsArr);
            } else if (accepts === 'text/html') {
                res.status(200).send(json2html(exPostsArr).slice(1, -1));
            } else { res.status(500).send('Content type got messed up!'); }
        });
});
// Create an eX Post
router.post('/', checkJwt, function (req, res) {
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

        exPostsModelFunctions.postExPost(exPostContents)
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
router.get('/', checkJwt, function (req, res) {
    exPostsModelFunctions.getExPosts(req)
        .then((exPosts) => {
            let exPostsWithoutInteractions = []
            let exPostsArr = exPosts.items;

            // Omit certain properties when requesting all eX Posts
            for (let i = 0; i < exPostsArr.length; i++) {
                let currentExPost = {
                    id: exPostsArr[i].id,
                    content: exPostsArr[i].content,
                    hashtag: exPostsArr[i].hashtag,
                    status: exPostsArr[i].status,
                    self: exPostsArr[i].self
                };
                exPostsWithoutInteractions.push(currentExPost);
            }
            // Append next link to array
            exPostsWithoutInteractions.push(exPosts.next);
            res.status(200).json(exPostsWithoutInteractions);
        });
});

// Get an eX Post
router.get('/:postId', checkJwt, function (req, res) {
    exPostsModelFunctions.getExPost(req.params.postId)
        .then(exPost => {
            if (exPost[0] === undefined || exPost[0] === null) {
                res.status(404).json({ 'Error': 'No post with this id exists' });
            } else {
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
            }


        });
});

// Edit an eX post
router.put('/:postId', checkJwt, function (req, res) {
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
        exPostsModelFunctions.getExPost(req.params.postId)
            .then(originalExPost => {
                originalExPost = originalExPost[0];

                if (originalExPost === undefined) {
                    res.status(404).end();
                } else if (originalExPost.verification === false) {
                    res.status(403).json({ 'Forbidden': 'Unverified users may not edit eX posts.' });
                } else {
                    let dateTimeLastEdit = exPostsModelFunctions.getDateTime();
                    // Pass in remaining properties to edited post
                    let editedExPost = {
                        content: req.body.content,
                        hashtag: req.body.hashtag,
                        verification: req.body.verification,
                        dateTimeLastEdit: dateTimeLastEdit
                    }

                    exPostsModelFunctions.putExPost(req.params.postId, editedExPost, originalExPost)
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
router.patch('/:postId', checkJwt, function (req, res) {
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
        const originalExPost = exPostsModelFunctions.getExPost(req.params.postId)
            .then(originalExPost => {
                originalExPost = originalExPost[0];

                if (originalExPost === undefined) {
                    res.status(404).end();
                } else if (originalExPost.verification === false) {
                    res.status(403).json({ 'Forbidden': 'Unverified users may not edit eX posts.' });
                } else {
                    let dateTimeLastEdit = exPostsModelFunctions.getDateTime();
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

                    exPostsModelFunctions.patchExPost(req.params.postId, editedExPost)
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
router.put('/:postId/interactions/:interactionId', checkJwt, function (req, res) {
    // validate eX post id first
    const postId = req.params.postId;
    const interactionId = req.params.interactionId;

    // Get original eX Post to be updated
    exPostsModelFunctions.getExPost(postId)
        .then(originalExPost => {
            originalExPost = originalExPost[0];

            if (originalExPost === undefined) {
                res.status(404).end();
            } else {
                // Iterate over interactions to find matching interaction
                for (let i = 0; i < originalExPost.interactions.length; i++) {
                    if (originalExPost.interactions[i].interactionId === req.params.interactionId) {
                        // Update associated interaction properties
                        let updatedInteraction = {
                            interactionId: req.params.interactionId,
                            repost: req.body.repost,
                            like: req.body.like,
                            view: req.body.view
                        }
                        exPostsModelFunctions.putExPostInteraction(req.params.postId, updatedInteraction, originalExPost)
                            .then(result => {

                                // Update associated interaction's properties
                                interactionsModelFunctions.putInteraction(req.params.interactionId, req.body)
                                    .then(result => {
                                        //TODO: is 204 right status to send?
                                        res.status(204).end();
                                    })
                            })
                    }
                }
            }
        }
        )
}
);

// Delete an eX Post
router.delete('/:postId', checkJwt, function (req, res) {
    exPostsModelFunctions.deleteExPost(req.params.postId).then(res.status(204).end());
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

app.use('/login', login);
app.use('/users', users);

module.exports = router;