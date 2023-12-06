const express = require('express');
const bodyParser = require('body-parser');
const app = express();

const router = express.Router();

const exPostsModelFunctions = require('../model/posts-model');
const interactionsModelFunctions = require('../model/interactions-model');

const ds = require('../database/datastore');
const datastore = ds.datastore;

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

// get a new interaction
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
    interactionsModelFunctions.putInteraction(req.params.interactionId, req.body.name)
        .then(res.status(200).end());
});

router.delete('/:interactionId', function (req, res) {
    // const interactionId = req.params.interactionId;
    interactionsModelFunctions.deleteInteraction(req.params.interactionId).then(res.status(204).end());
});

/* ------------- End Controller Functions ------------- */

module.exports = router;