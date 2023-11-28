const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();

const ds = require('./datastore');

const datastore = ds.datastore;

const INTERACTION = "Interaction";

router.use(bodyParser.json());


/* ------------- Begin interaction Model Functions ------------- */
function post_interaction(reposts, likes, views, post_id) {
    var key = datastore.key(INTERACTION);
    const new_interaction = { "reposts": reposts, "likes": likes, "views": views, "post_id": post_id };

    return datastore.save({ "key": key, "data": new_interaction }).then(() => {
        return { key, data: new_interaction }
    });
}

function get_interactions(req) {
    var q = datastore.createQuery(INTERACTION).limit(3);
    const results = {};
    var prev;
    if (Object.keys(req.query).includes("cursor")) {
        prev = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + req.query.cursor;
        q = q.start(req.query.cursor);
    }
    return datastore.runQuery(q).then((entities) => {
        results.items = entities[0].map(ds.fromDatastore);
        if (typeof prev !== 'undefined') {
            results.previous = prev;
        }
        if (entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS) {
            results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + entities[1].endCursor;
        }
        return results;
    });
}

function get_interaction(interaction_id) {
    const key = datastore.key([INTERACTION, parseInt(interaction_id, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            return entity.map(ds.fromDatastore);
        }
    });
}

// function put_interaction(id, name) {
//     const key = datastore.key([INTERACTION, parseInt(id, 10)]);
//     const interaction = { "name": name };
//     return datastore.save({ "key": key, "data": interaction });
// }

function delete_interaction(id) {
    const key = datastore.key([INTERACTION, parseInt(id, 10)]);
    return datastore.delete(key);
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

router.get('/', function (req, res) {
    const interactions = get_interactions(req)
        .then((interactions) => {
            res.status(200).json(interactions);
        });
});

// get a new interaction
router.get('/:id', function (req, res) {
    if (req.params.id < 1000000000000000) {
        res.status(404).json({ 'Error': 'No interaction with this interaction_id exists' });
    } else {
        get_interaction(req.params.id)
            .then(interaction => {
                if (interaction[0] === undefined || interaction[0] === null) {
                    res.status(404).json({ 'Error': 'No interaction with this interaction_id exists' });
                } else {
                    const data = interaction[0];
                    const self_link = req.get("host") + req.baseUrl + "/" + data.id;
                    const new_interaction = { "id": data.id, "volume": data.volume, "item": data.item, "creation_date": data.creation_date, "carrier": data.carrier, "self": self_link };
                    res.status(200).send(new_interaction);
                }
            });
    }
});

router.post('/', function (req, res) {
    if (req.body.reposts === undefined ||
        req.body.likes === undefined ||
        req.body.views === undefined ||
        req.body.post_id === undefined) {
        res.status(400).json({ 'Error': 'The request object is missing at least one of the required attributes' });
    } else {
        post_interaction(req.body.reposts, req.body.likes, req.body.views, req.body.post_id)
            .then(result => {
                const key = result.key;
                const data = result.data;
                const self_link = req.get("host") + req.baseUrl + "/" + key.id;
                const new_interaction = { "id": key.id, "reposts": data.reposts, "likes": data.likes, "views": data.views, "post_id": data.post_id, "self": self_link };
                res.status(201).send(new_interaction);
            });
    }
});

router.put('/:id', function (req, res) {
    put_interaction(req.params.id, req.body.name)
        .then(res.status(200).end());
});

router.delete('/:id', function (req, res) {
    const interaction_id = req.params.id;

    if (interaction_id < 1000000000000000) {
        res.status(404).json({ 'Error': 'No interaction with this interaction_id exists' });
    } else {
        delete_interaction(req.params.id).then(res.status(204).end())
    }
});

/* ------------- End Controller Functions ------------- */

module.exports = router;