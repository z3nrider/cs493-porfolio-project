const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const login = express.Router();
const { auth } = require('express-openid-connect');

const CLIENT_ID = 'CTnVpRETT7mPYgPOdZaaanVGt20dHnKl';
const CLIENT_SECRET = '48lZkwEYbiAjOTgbPG6DYserEeA5z-hV4uanysS4PZdcE9tnMSOBjrqSLP6GuoWD';
const DOMAIN = 'dev-gblxtkrkmbzldfsv.us.auth0.com';

// A function that generates state
// From Stack Overflow:
//https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
function makeState(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
        counter += 1;
    }
    return result;
}
let secret = makeState(20);
const config = {
    authRequired: false,
    auth0Logout: true,
    baseURL: 'http://localhost:3000',
    clientID: CLIENT_ID,
    issuerBaseURL: 'https://dev-gblxtkrkmbzldfsv.us.auth0.com',
    secret: secret
};

login.use(bodyParser.json());


// auth router attaches /login, /logout, and /callback routes to the baseURL
// login.use(auth(config));

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
            res.send(body);
        }
    });

});


/*----------------------------- */

login.use('/login', login);

module.exports = login;
