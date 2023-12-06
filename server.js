const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use('/login', require('./controller/login-controller'));
app.use('/posts', require('./controller/posts-controller'));
app.use('/interactions', require('./controller/interactions-controller'));
app.use('/home', require('./view/home'));

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});