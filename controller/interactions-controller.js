const express = require('express');
const bodyParser = require('body-parser');
const app = express();

const router = express.Router();

const modelFunctions = require('../model/interactions-model');

const ds = require('../database/datastore');

router.use(bodyParser.json());

/* ------------- Begin Controller Functions ------------- */

router.post('/', function (req, res) {
    if (req.body.reposts === undefined ||
        req.body.likes === undefined ||
        req.body.views === undefined ||
        req.body.postId === undefined) {
        res.status(400).json({ 'Error': 'The request object is missing at least one of the required attributes' });
    } else {
        modelFunctions.postInteraction(req.body.reposts, req.body.likes, req.body.views, req.body.postId)
            .then(result => {
                const key = result.key;
                const data = result.data;
                const selfLink = req.get("host") + req.baseUrl + "/" + key.id;
                const newInteraction = { "id": key.id, "reposts": data.reposts, "likes": data.likes, "views": data.views, "postId": data.postId, "self": selfLink };
                res.status(201).send(newInteraction);
            });
    }
});

router.get('/', function (req, res) {
    const interactions = modelFunctions.getInteractions(req)
        .then((interactions) => {
            res.status(200).json(interactions);
        });
});

// get a new interaction
router.get('/:interactionId', function (req, res) {
    if (req.params.interactionId < 1000000000000000) {
        res.status(404).json({ 'Error': 'No interaction with this interactionId exists' });
    } else {
        modelFunctions.getInteraction(req.params.interactionId)
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
    modelFunctions.putInteraction(req.params.interactionId, req.body.name)
        .then(res.status(200).end());
});

router.delete('/:interactionId', function (req, res) {
    const interactionId = req.params.id;

    if (interactionId < 1000000000000000) {
        res.status(404).json({ 'Error': 'No interaction with this interactionId exists' });
    } else {
        modelFunctions.deleteInteraction(req.params.interactionId).then(res.status(204).end())
    }
});

/* ------------- End Controller Functions ------------- */

module.exports = router;