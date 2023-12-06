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
    if (req.body.repost === undefined ||
        req.body.like === undefined ||
        req.body.view === undefined ||
        req.body.postId === undefined) {
        res.status(400).json({ 'Error': 'The request object is missing at least one of the required attributes' });
    } else {
        interactionsModelFunctions.postInteraction(req.body.repost, req.body.like, req.body.view, req.body.postId)
            .then(result => {
                const key = result.key;
                const data = result.data;
                const selfLink = req.get("host") + req.baseUrl + "/" + key.id;
                const newInteraction = { "id": key.id, "repost": data.repost, "like": data.like, "view": data.view, "postId": data.postId, "self": selfLink };

                exPostsModelFunctions.putInteractWithExPost(data.postId, key.id, newInteraction)
                    .then(result2 => {
                        if (result2 === -1) {
                            // TODO: the interaction id can only be used once?
                            res.status(403).json({ 'Error': 'The interaction is already loaded on another eX Post' });
                        } else {
                            //TODO: is 204 right status to send?
                            const selfLink = req.get("host") + req.baseUrl + "/" + key.id;
                            const newInteraction = { "reposts": req.body.reposts, "likes": req.body.likes, "views": req.body.views, "postId": req.body.postId, "self": selfLink };

                            res.status(201).send(newInteraction);
                        }
                    })
                // res.status(201).send(newInteraction);
            });
    }
});

router.get('/', function (req, res) {
    const interactions = interactionsModelFunctions.getInteractions(req)
        .then((interactions) => {
            res.status(200).json(interactions);
        });
});

// get a new interaction
router.get('/:interactionId', function (req, res) {
    if (req.params.interactionId < 1000000000000000) {
        res.status(404).json({ 'Error': 'No interaction with this interactionId exists' });
    } else {
        interactionsModelFunctions.getInteraction(req.params.interactionId)
            .then(interaction => {
                if (interaction[0] === undefined || interaction[0] === null) {
                    res.status(404).json({ 'Error': 'No interaction with this interactionId exists' });
                } else {
                    const data = interaction[0];
                    const selfLink = req.get("host") + req.baseUrl + "/" + data.id;
                    const newInteraction = { "id": data.id, "volume": data.volume, "item": data.item, "creationDate": data.creationDate, "carrier": data.carrier, "self": selfLink };
                    res.status(200).send(newInteraction);
                }
            });
    }
});

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