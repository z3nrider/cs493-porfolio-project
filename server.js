const express = require('express');
const app = express();

// app.use('/exPosts-controller', require('./controller/exPosts-controller.js'));
// app.use('/exPosts-model', require('./model/exPosts-model.js'));
app.use('/posts', require('./controller/posts-controller'));

app.use('/interactions', require('./controller/interactions-controller'));
app.use('/home', require('./home'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});