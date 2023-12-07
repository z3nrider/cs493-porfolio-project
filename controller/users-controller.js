const express = require('express');
const bodyParser = require('body-parser');

const router = express.Router();
const users = express.Router();

const userModelFunctions = require('../model/users-model');
const interactionsModelFunctions = require('../model/interactions-model');
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const ds = require('../database/datastore');

const DOMAIN = 'dev-gblxtkrkmbzldfsv.us.auth0.com';
const { auth } = require('express-openid-connect');


const json2html = require('node-json2html');
const template = { '<>': 'ul', 'html': '{ "content": ${content}, "hashtag": ${hashtag}, "verification": ${verification}, "self": ${self} }' };
const MAX_POST_LENGTH = 140;

users.use(bodyParser.json());

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

// Get all users uprotected
users.get('/', function (req, res) {
    userModelFunctions.getUsersUnprotected(req)
        .then((users) => {
            res.status(200).json(users);
        });
});

// Create a user entity
users.post('/', checkJwt, function (req, res) {
    if (req.get('content-type') !== 'application/json') {
        res.status(415).end();
    } else if (req.body.name === undefined) {
        res.status(400).json({ 'Error': 'The request object is missing at least one of the required attributes' });
    } else {

        let user = {
            name: req.body.name
        }

        userModelFunctionslFunctions.postExPost(user)
            .then(result => {
                // Create a new eX post of acceptable length
                const key = result.key;
                const data = result.data;
                const selfLink = req.get("host") + req.baseUrl + "/" + key.id;
                const newUser = {
                    "id": key.id,
                    "content": data.name,
                };

                res.status(201).send(newUser);
            })
    }
});


/* ------------- End Controller Functions ------------- */

// app.use('/users', users);

module.exports = users;