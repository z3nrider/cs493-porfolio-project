const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const { auth } = require('express-openid-connect');
const bodyParser = require('body-parser');
const path = require('path');
const CLIENT_ID = 'CTnVpRETT7mPYgPOdZaaanVGt20dHnKl';
const userModelFunctions = require('./model/users-model');
app.use(bodyParser.json());

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

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use('/login', require('./controller/login-controller'));
app.use('/posts', require('./controller/posts-controller'));
app.use('/interactions', require('./controller/interactions-controller'));
app.use('/home', require('./view/home'));
app.use(auth(config));



/* ------------- Begin Controller Functions ------------- */

app.get('/', (req, res) => {
    if (req.oidc.isAuthenticated()) {
        let user = ({ "user": req.oidc.user, "jwt": req.oidc.idToken });
        // Check if user exists
        // If user does not exist in datastore:
        // userModelFunctions.getUser(r)
        // Otherwise:
        userModelFunctions.postUser(user)
            .then(result => {
                res.send(result.data);
            })

    } else {
        const filePath = path.resolve(__dirname, './view/index.html');
        res.sendFile(filePath);
    }
});

/* ------------- End Controller Functions ------------- */



/* ------------- Running Server ------------- */

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});