const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');
const datastore = ds.datastore;
const POST = "Post";
const INTERACTION = "Interaction";
const json2html = require('node-json2html');
const template = { '<>': 'ul', 'html': '{ "content": ${content}, "hashtag": ${hashtag}, "verification": ${verification}, "self": ${self} }' };

const MAX_POST_LENGTH = 140;

router.use(bodyParser.json());
/* ------------- Begin Post Model Functions ------------- */

// Create a post
// TODO: maybe add public/private posts
function post_post(content, hashtag, verification) {
    var key = datastore.key(POST);
    const new_post = { "content": content, "hashtag": hashtag, "verification": verification, "interactions": [0, 0, 0] };

    return datastore.save({ "key": key, "data": new_post }).then(() => {
        return { key, data: new_post }
    });
}

// Interact with a post
function put_interaction_with_post(post_id, interaction_id, body) {
    const post_key = datastore.key([POST, parseInt(post_id, 10)]);
    const interaction_key = datastore.key([INTERACTION, parseInt(interaction_id, 10)]);

    return datastore.get(post_key)
        .then((post) => {
            if (typeof (post[0].interactions) === 'undefined') {
                post[0].interactions = [];
            }

            for (let i = 0; i < post[0].interactions.length; i++) {
                if (post[0].interactions[i] === interaction_id) {
                    return -1;
                }
            }

            //TODO: need to push load, not load_id
            prev_reposts = post[0].interactions[0];
            prev_likes = post[0].interactions[1];
            post[0].interactions[0] = body.reposts;
            post[0].interactions[1] = body.likes;
            post[0].interactions[2] = body.views += 1;

            return datastore.save({ "key": post_key, "data": post[0] });
        })
}

// Delete a post
function delete_post(id) {
    const key = datastore.key([POST, parseInt(id, 10)]);
    return datastore.delete(key);
}

// Edit a post
// TODO: allow user to edit post only if they are "verified" via subscription
function put_post(id, content, hashtag, verification) {
    const key = datastore.key([POST, parseInt(id, 10)]);
    const updated_post = { "content": content, "hashtag": hashtag, "verification": verification };

    return datastore.save({ "key": key, "data": updated_post }).then(() => {
        return { key, data: updated_post }
    });
}

// View posts
function get_posts() {
    const q = datastore.createQuery(POST);
    return datastore.runQuery(q).then((entities) => {
        return entities[0].map(ds.fromDatastore);
    });
}

// View a post
function get_post(id) {
    const key = datastore.key([POST, parseInt(id, 10)]);
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


// Create a post
router.post('/', function (req, res) {
    if (req.get('content-type') !== 'application/json') {
        //res.status(415).send('Server only accepts application/json data.').end();
        res.status(415).end();
    } else if (req.body.content === undefined ||
        req.body.hashtag === undefined ||
        req.body.verification === undefined) {
        res.status(400).json({ 'Error': 'The request object is missing at least one of the required attributes' });
    } else {
        if (req.body.content.length > MAX_POST_LENGTH) {
            res.status(403).json({ 'Error': 'Posts may only be up to 140 characters long' }).end();
        } else {
            const posts = get_posts()
                .then((posts) => {
                    post_post(req.body.content, req.body.hashtag, req.body.verification)
                        .then(result => {
                            // Create new post of acceptable length
                            const key = result.key;
                            const data = result.data;
                            const self_link = req.get("host") + req.baseUrl + "/" + key.id;
                            const new_post = { "id": key.id, "content": data.content, "hashtag": data.hashtag, "verification": data.verification, "interactions": data.interactions, "self": self_link };

                            res.status(201).send(new_post);

                        });
                })
        }
    }
});

router.put('/:post_id/interactions/:interaction_id', function (req, res) {
    // validate post id first
    const post_id = req.params.post_id;
    const interaction_id = req.params.interaction_id;

    if (post_id < 1000000000000000 || interaction_id < 1000000000000000) {
        res.status(404).json({ 'Error': 'The specified post and/or interaction does not exist' });
    } else {
        put_interaction_with_post(req.params.post_id, req.params.interaction_id, req.body)
            .then(result => {
                // console.log(result);
                if (result === -1) {
                    res.status(403).json({ 'Error': 'The interaction is already loaded on another post' });
                } else {
                    res.status(204).end();
                }
            })
    }
});

// Delete a post
router.delete('/:id', function (req, res) {
    if ((req.params.id < 1000000000000000) || req.params.id === 'null') {
        res.status(404).end();
    } else {
        const posts = get_posts()
            .then((posts) => {
                delete_post(req.params.id)
                    .then(result => {
                        let is_valid_id = false;

                        // There are no posts to be deleted
                        if (posts.length === 0) {
                            res.status(404).end();
                        }

                        else {
                            for (let i = 0; i < posts.length; i++) {
                                if (req.params.id === posts[i].id) {
                                    // Found a valid post id and create old post object
                                    old_post = posts[i];
                                    is_valid_id = true;
                                }
                                if (is_valid_id) {
                                    res.status(204).end();
                                }
                                else {
                                    res.status(404).end();
                                }
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
// router.put('/:id', function (req, res) {
//     const accepts = req.accepts(['application/json', 'text/html']);
//     if (req.params.id < 1000000000000000 || req.params.id === 'null') {
//         res.status(404).json({ 'Error': 'No post with this id exists' });
//     } else if (req.body.content === undefined ||
//         req.body.hashtag === undefined ||
//         req.body.verification === undefined) {
//         res.status(400).json({ 'Error': 'The request object is missing at least one of the required attributes' });
//     } else if (!accepts) {
//         res.status(406).send('Not Acceptable');
//     } else if ((accepts === 'application/json') || (accepts === 'text/html')) {
//         const posts = get_posts()
//             .then((posts) => {
//                 let old_post;
//                 let is_duplicate_post_content = false;
//                 let is_valid_id = false;

//                 // TODO: don't need to check for duplicate content!
//                 // Check for a post content that already exists
//                 for (let i = 0; i < posts.length; i++) {
//                     if (req.body.content === posts[i].content) {
//                         // Cannot update a post's content to one that already exists
//                         res.status(403).json({ 'Error': 'A post with that content already exists' });
//                         is_duplicate_post_content = true;
//                         break;
//                     }
//                     if (req.params.id === posts[i].id) {
//                         // Found a valid post id and create old post object
//                         old_post = posts[i];
//                         is_valid_id = true;
//                     }
//                 }

//                 // Update post
//                 if (!is_duplicate_post_content && is_valid_id) {

//                     // Post's content exceeded acceptable length
//                     if (!(content.length > MAX_POST_LENGTH)) {
//                         res.status(403).json({ 'Error': 'Posts may only be up to 140 characters long' }).end();
//                     } else {
//                         put_post(req.params.id, req.body.content, req.body.hashtag, req.body.verification)
//                             .then(result => {
//                                 const key = result.key;
//                                 const data = result.data;
//                                 const self_link = req.get("host") + req.baseUrl + "/" + key.id;
//                                 const updated_post = { "id": key.id, "content": data.content, "hashtag": data.hashtag, "verification": data.verification, "self": self_link };

//                                 // Send back the updated post as json or html
//                                 if (accepts === 'application/json') {
//                                     res.status(303).set("Location", self_link).send(updated_post);
//                                 } else {
//                                     let html_updated_post = json2html.render(updated_post, template);
//                                     res.status(303).set("Location", self_link).send(html_updated_post);
//                                 }
//                             })
//                     }
//                 }
//             })
//     } else { res.status(500).send('Content type got messed up!'); }
// });

// Edit a post
// router.patch('/:id', function (req, res) {
//     const accepts = req.accepts(['application/json', 'text/html']);
//     if (req.params.id < 1000000000000000 || req.params.id === 'null') {
//         res.status(404).json({ 'Error': 'No post with this id exists' });
//     } else if (!accepts) {
//         res.status(406).send('Not Acceptable');
//     } else if ((accepts === 'application/json') || (accepts === 'text/html')) {
//         const posts = get_posts()
//             .then((posts) => {
//                 let old_post;
//                 let new_post_content = req.body.content;
//                 let new_post_hashtag = req.body.hashtag;
//                 let new_post_verification = req.body.verification;
//                 let is_duplicate_post_content = false;
//                 let is_valid_id = false;

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
//                 //         old_post = posts[i];
//                 //         is_valid_id = true;
//                 //     }
//                 // }
//                 // Update post
//                 if (!is_duplicate_post_content && is_valid_id) {
//                     if (new_post_content === undefined) {
//                         new_post_content = posts[0].content;
//                     }

//                     if (new_post_hashtag === undefined) {
//                         new_post_hashtag = posts[0].hashtag;
//                     }

//                     if (new_post_verification === undefined) {
//                         new_post_verification = posts[0].verification;
//                     }

//                     let content_checcheck_content_and_length(new_post_content);

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
//                         put_post(req.params.id, new_post_content, new_post_hashtag, new_post_verification)
//                             .then(result => {
//                                 const key = result.key;
//                                 const data = result.data;
//                                 const self_link = req.get("host") + req.baseUrl + "/" + key.id;
//                                 const updated_post = { "id": key.id, "content": data.content, "hashtag": data.hashtag, "verification": data.verification, "self": self_link };

//                                 // Send back the updated post as json or html
//                                 if (accepts === 'application/json') {
//                                     res.status(200).set("Location", self_link).send(updated_post);
//                                 } else {
//                                     let html_updated_post = json2html.render(updated_post, template);
//                                     res.status(200).set("Location", self_link).send(html_updated_post);
//                                 }
//                             })
//                     }

//                 } else if (!is_valid_id && !is_duplicate_post_content) {
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
    const posts = get_posts()
        .then((posts) => {
            res.status(200).json(posts);
        });
});

// Get a post
router.get('/:id', function (req, res) {
    if (req.params.id < 1000000000000000 || req.params.id === 'null') {
        res.status(404).json({ 'Error': 'No post with this id exists' });
    } else {
        const posts = get_post(req.params.id)
            .then(post => {
                const accepts = req.accepts(['application/json', 'text/html']);

                if (!accepts) {
                    res.status(406).send('Not Acceptable');
                } else if (accepts === 'application/json') {
                    const data = post[0];
                    const self_link = req.get("host") + req.baseUrl + "/" + data.id;
                    const new_post = { "id": data.id, "content": data.content, "hashtag": data.hashtag, "verification": data.verification, "self": self_link };
                    res.status(200).json(new_post);
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