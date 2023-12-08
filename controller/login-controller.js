const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const usersModelFunctions = require('../model/users-model');

const login = express.Router();

const CLIENT_ID = 'CTnVpRETT7mPYgPOdZaaanVGt20dHnKl';
const CLIENT_SECRET = '48lZkwEYbiAjOTgbPG6DYserEeA5z-hV4uanysS4PZdcE9tnMSOBjrqSLP6GuoWD';
const DOMAIN = 'dev-gblxtkrkmbzldfsv.us.auth0.com';

login.use(bodyParser.json());

login.post('/', function (req, res) {
    const username = req.body.username;
    const password = req.body.password;
    var options = {
        method: 'POST',
        url: `https://${DOMAIN}/oauth/token`,
        headers: { 'content-type': 'application/json' },
        body:
        {
            grant_type: 'password',
            username: username,
            password: password,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET
        },
        json: true
    };
    request(options, (error, response, body) => {
        if (error) {
            res.status(500).send(error);
        } else {
            usersModelFunctions.postUser(body.id_token)
                .then(result => {
                    res.send(body);
                })
        }
    });

});


/*----------------------------- */

login.use('/login', login);

module.exports = login;
