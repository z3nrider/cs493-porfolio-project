const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const router = express.Router();

router.use(bodyParser.json());

router.get('/', function (req, res) {
    const filePath = path.resolve(__dirname, './index.html');
    res.sendFile(filePath);
});

module.exports = router;