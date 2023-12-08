const express = require('express');
const bodyParser = require('body-parser');

const router = express.Router();

const exPostsModelFunctions = require('../model/posts-model');
const interactionsModelFunctions = require('../model/interactions-model');

const ds = require('../database/datastore');

router.use(bodyParser.json());

/* ------------- Begin Controller Functions ------------- */

router.post('/', function (req, res) {
    if (req.get('content-type') !== 'application/json') {
        res.status(415).end();
    } else if (req.body.repost === undefined ||
        req.body.like === undefined ||
        req.body.view === undefined ||
        req.body.postId === undefined) {
        res.status(400).json({ 'Error': 'The request object is missing at least one of the required attributes' });
    } else {
        let repost = req.body.repost;
        let like = req.body.like;
        let view = req.body.view;
        let postId = req.body.postId;

        // Create the interaction
        interactionsModelFunctions.postInteraction(repost, like, view, postId)
            .then(result => {
                const key = result.key;
                const data = result.data;
                const selfLink = req.get("host") + req.baseUrl + "/" + key.id;
                const newInteraction = {
                    "id": key.id,
                    "repost": data.repost,
                    "like": data.like,
                    "view": data.view,
                    "postId": data.postId,
                    "self": selfLink
                };

                // Update the associated eX Post interaction
                exPostsModelFunctions.putInteractWithExPost(data.postId, key.id, newInteraction)
                    .then(result => {
                        const selfLink = req.get("host") + req.baseUrl + "/" + key.id;
                        const newInteraction = {
                            "id": key.id,
                            "repost": req.body.repost,
                            "like": req.body.like,
                            "view": req.body.view,
                            "postId": req.body.postId,
                            "self": selfLink
                        };

                        res.status(201).send(newInteraction);
                    }
                    )
            });
    }
});

router.get('/', function (req, res) {
    interactionsModelFunctions.getInteractions(req)
        .then((interactions) => {
            res.status(200).json(interactions);
        });
});

router.get('/unprotected', function (req, res) {
    interactionsModelFunctions.getInteractions(req)
        .then((interactions) => {
            res.status(200).json(interactions);
        });
});

router.get('/:interactionId', function (req, res) {
    interactionsModelFunctions.getInteraction(req.params.interactionId)
        .then(interaction => {
            if (interaction[0] === undefined || interaction[0] === null) {
                res.status(404).json({ 'Error': 'No interaction with this id exists' });
            } else {
                const accepts = req.accepts(['application/json', 'text/html']);

                if (!accepts) {
                    res.status(406).send('Not Acceptable');
                } else if (accepts === 'application/json') {
                    const data = interaction[0];
                    const selfLink = req.get("host") + req.baseUrl + "/" + data.id;

                    const newInteraction = {
                        "repost": data.repost,
                        "like": data.like,
                        "view": data.view,
                        "postId": data.postId,
                        "self": selfLink
                    };
                    res.status(200).json(newInteraction);
                } else if (accepts === 'text/html') {
                    const interactionHTML = JSON.stringify(interaction[0]);
                    res.status(200).send(`<p>${interactionHTML}</p>`);
                } else { res.status(500).send('Content type got messed up!'); }
            }
        });
}
);

router.put('/:interactionId', function (req, res) {
    interactionsModelFunctions.putInteraction(req.params.interactionId, req.body)
        .then(res.status(200).end());
});

router.patch('/:interactionId', function (req, res) {
    interactionsModelFunctions.getInteraction(req.params.interactionId)
        .then(originalInteraction => {
            originalInteraction = originalInteraction[0];
            const accepts = req.accepts(['application/json', 'text/html']);
            if (originalInteraction === undefined) {
                res.status(404).end();
            } else {
                let editedInteraction;
                // Pass in remaining properties to edited interaction


                if (req.body.repost !== undefined) {
                    originalInteraction.repost = req.body.repost;
                }

                if (req.body.like !== undefined) {
                    originalInteraction.like = req.body.like;
                }

                if (req.body.view !== undefined) {
                    originalInteraction.view = req.body.view;
                }

                editedInteraction = originalInteraction;

                interactionsModelFunctions.patchInteraction(req.params.interactionId, editedInteraction)
                    .then(result => {
                        const key = result.key;
                        const data = result.data;
                        const selfLink = req.get("host") + req.baseUrl + "/" + key.id;
                        const editedInteraction = {
                            "id": key.id,
                            "repost": data.repost,
                            "like": data.like,
                            "view": data.view,
                            "self": selfLink
                        };

                        // Send back the updated post as json or html
                        if (accepts === 'application/json') {
                            res.status(200).set("Location", selfLink).send(editedInteraction);
                        } else {
                            let htmlUpdateExPost = json2html.render(editedInteraction, template);
                            res.status(200).set("Location", selfLink).send(htmlUpdateExPost);
                        }
                    })
            }
        })
});

router.delete('/:interactionId', function (req, res) {
    interactionsModelFunctions.deleteInteraction(req.params.interactionId).then(res.status(204).end());
});

/* ------------- End Controller Functions ------------- */

module.exports = router;