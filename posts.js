const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');
const datastore = ds.datastore;
const POST = "Post";
const json2html = require('node-json2html');
const template = { '<>': 'ul', 'html': '{ "content": ${content}, "hashtag": ${hashtag}, "verification": ${verification}, "self": ${self} }' };
const FORBIDDEN_CHARS = "";
// const FORBIDDEN_CHARS = "~!@#$%^&*()_+";

const MAX_POST_LENGTH = 140;

router.use(bodyParser.json());
/* ------------- Begin Post Model Functions ------------- */

// Create a post
// TODO: maybe add public/private posts
function post_post(content, hashtag, verification) {
    var key = datastore.key(POST);
    const new_post = { "content": content, "hashtag": hashtag, "verification": verification };

    return datastore.save({ "key": key, "data": new_post }).then(() => {
        return { key, data: new_post }
    });
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

//TODO: remove forbidden chars
function check_content_and_length(content) {
    // Check for invalid content length
    let content_length = true;
    let content_chars = true;

    // For Patch post with no content
    if (content === undefined) {
        return [true, true];
    }

    if (content.length > MAX_POST_LENGTH) {
        content_length = false;
    }

    // Check for invalid characters in content
    for (let i = 0; i < content.length; i++) {
        for (let j = 0; j < FORBIDDEN_CHARS.length; j++) {
            if (content[i] === FORBIDDEN_CHARS[j]) {
                content_chars = false;
            }
        }
    }
    return [content_length, content_chars];
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
        let content_check = check_content_and_length(req.body.content);
        let is_valid_post_content = true;
        // Post's content exceeded acceptable length
        if (content_check[0] === false) {
            res.status(403).json({ 'Error': 'Posts may only be up to 140 characters long' }).end();
            is_valid_post_content = false;
        }
        // Post's content contains unacceptable character(s)
        if (content_check[1] === false) {
            res.status(403).json({ 'Error': 'The characters "~!@#$%^&*()_+" are not allowed in a post' }).end();
            is_valid_post_content = false;
        }

        if (is_valid_post_content) {
            const posts = get_posts()
                .then((posts) => {
                    // TODO: obv duplicate posts should be fine. just keeping these for now
                    // let is_duplicate_post_content = false;
                    // // Check for a post content that already exists
                    // for (let i = 0; i < posts.length; i++) {
                    //     if (req.body.content === posts[i].content) {
                    //         res.status(403).json({ 'Error': 'A post with that content already exists' });
                    //         is_duplicate_post_content = true;
                    //         break;
                    //     }
                    // }

                    // // Post content is valid and not a duplicate
                    // if (!is_duplicate_post_content) {
                    //     post_post(req.body.content, req.body.hashtag, req.body.verification)
                    //         .then(result => {

                    //             // Create new valid post
                    //             if (!is_duplicate_post_content) {
                    //                 const key = result.key;
                    //                 const data = result.data;
                    //                 const self_link = req.get("host") + req.baseUrl + "/" + key.id;
                    //                 const new_post = { "id": key.id, "content": data.content, "hashtag": data.hashtag, "verification": data.verification, "self": self_link };

                    //                 res.status(201).send(new_post);
                    //             }
                    //         });
                    // }
                    post_post(req.body.content, req.body.hashtag, req.body.verification)
                        .then(result => {
                            // Create new valid post
                            const key = result.key;
                            const data = result.data;
                            const self_link = req.get("host") + req.baseUrl + "/" + key.id;
                            const new_post = { "id": key.id, "content": data.content, "hashtag": data.hashtag, "verification": data.verification, "self": self_link };

                            res.status(201).send(new_post);

                        });
                })
        }
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
router.put('/:id', function (req, res) {
    const accepts = req.accepts(['application/json', 'text/html']);
    if (req.params.id < 1000000000000000 || req.params.id === 'null') {
        res.status(404).json({ 'Error': 'No post with this id exists' });
    } else if (req.body.content === undefined ||
        req.body.hashtag === undefined ||
        req.body.verification === undefined) {
        res.status(400).json({ 'Error': 'The request object is missing at least one of the required attributes' });
    } else if (!accepts) {
        res.status(406).send('Not Acceptable');
    } else if ((accepts === 'application/json') || (accepts === 'text/html')) {
        const posts = get_posts()
            .then((posts) => {
                let old_post;
                let is_duplicate_post_content = false;
                let is_valid_id = false;

                // TODO: don't need to check for duplicate content!
                // Check for a post content that already exists
                for (let i = 0; i < posts.length; i++) {
                    if (req.body.content === posts[i].content) {
                        // Cannot update a post's content to one that already exists
                        res.status(403).json({ 'Error': 'A post with that content already exists' });
                        is_duplicate_post_content = true;
                        break;
                    }
                    if (req.params.id === posts[i].id) {
                        // Found a valid post id and create old post object
                        old_post = posts[i];
                        is_valid_id = true;
                    }
                }

                // Update post
                if (!is_duplicate_post_content && is_valid_id) {

                    let content_check = check_content_and_length(req.body.content);
                    // Post's content exceeded acceptable length
                    if (content_check[0] === false) {
                        res.status(403).json({ 'Error': 'Posts may only be up to 140 characters long' }).end();
                    }
                    // TODO: get rid of this. Or maybe ban naughty words?
                    // Post's content contains unacceptable character(s)
                    if (content_check[1] === false) {
                        res.status(403).json({ 'Error': 'The characters "~!@#$%^&*()_+" are not allowed in a post' }).end();
                    }

                    if (content_check[0] && content_check[1]) {
                        put_post(req.params.id, req.body.content, req.body.hashtag, req.body.verification)
                            .then(result => {
                                const key = result.key;
                                const data = result.data;
                                const self_link = req.get("host") + req.baseUrl + "/" + key.id;
                                const updated_post = { "id": key.id, "content": data.content, "hashtag": data.hashtag, "verification": data.verification, "self": self_link };

                                // Send back the updated post as json or html
                                if (accepts === 'application/json') {
                                    res.status(303).set("Location", self_link).send(updated_post);
                                } else {
                                    let html_updated_post = json2html.render(updated_post, template);
                                    res.status(303).set("Location", self_link).send(html_updated_post);
                                }
                            })
                    }
                }
            })
    } else { res.status(500).send('Content type got messed up!'); }
});

// Edit a post
router.patch('/:id', function (req, res) {
    const accepts = req.accepts(['application/json', 'text/html']);
    if (req.params.id < 1000000000000000 || req.params.id === 'null') {
        res.status(404).json({ 'Error': 'No post with this id exists' });
    } else if (!accepts) {
        res.status(406).send('Not Acceptable');
    } else if ((accepts === 'application/json') || (accepts === 'text/html')) {
        const posts = get_posts()
            .then((posts) => {
                let old_post;
                let new_post_content = req.body.content;
                let new_post_hashtag = req.body.hashtag;
                let new_post_verification = req.body.verification;
                let is_duplicate_post_content = false;
                let is_valid_id = false;

                // Check for a post content that already exists
                for (let i = 0; i < posts.length; i++) {
                    if (req.body.content === posts[i].content) {
                        // Cannot update a post's content to one that already exists
                        res.status(403).json({ 'Error': 'A post with that content already exists' });
                        is_duplicate_post_content = true;
                        break;
                    }
                    if (req.params.id === posts[i].id) {
                        // Found a valid post id and create old post object
                        old_post = posts[i];
                        is_valid_id = true;
                    }
                }
                // Update post
                if (!is_duplicate_post_content && is_valid_id) {
                    if (new_post_content === undefined) {
                        new_post_content = posts[0].content;
                    }

                    if (new_post_hashtag === undefined) {
                        new_post_hashtag = posts[0].hashtag;
                    }

                    if (new_post_verification === undefined) {
                        new_post_verification = posts[0].verification;
                    }

                    let content_check = check_content_and_length(new_post_content);

                    // Post's content exceeded acceptable length
                    if (content_check[0] === false) {
                        res.status(403).json({ 'Error': 'Post contents may only be up to 140 characters long' }).end();
                        return;
                    }
                    // Post's content contains unacceptable character(s)
                    if (content_check[1] === false) {
                        res.status(403).json({ 'Error': 'The characters "~!@#$%^&*()_+" are not allowed in a post' }).end();
                        return;
                    }

                    // Update post with valid data
                    if (content_check[0] && content_check[1]) {
                        put_post(req.params.id, new_post_content, new_post_hashtag, new_post_verification)
                            .then(result => {
                                const key = result.key;
                                const data = result.data;
                                const self_link = req.get("host") + req.baseUrl + "/" + key.id;
                                const updated_post = { "id": key.id, "content": data.content, "hashtag": data.hashtag, "verification": data.verification, "self": self_link };

                                // Send back the updated post as json or html
                                if (accepts === 'application/json') {
                                    res.status(200).set("Location", self_link).send(updated_post);
                                } else {
                                    let html_updated_post = json2html.render(updated_post, template);
                                    res.status(200).set("Location", self_link).send(html_updated_post);
                                }
                            })
                    }

                } else if (!is_valid_id && !is_duplicate_post_content) {
                    res.status(403).json({ 'Error': 'A post with that id does not exist' }).end();
                }
            })
    } else { res.status(500).send('Content type got messed up!'); }
});

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