const express = require('express');
const app = express();

app.use('/posts', require('./posts'));
app.use('/interactions', require('./interactions'));
app.use('/home', require('./home'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}...`);
});