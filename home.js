const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const path = require('path');

router.use(bodyParser.json());

router.get('/', function (req, res) {
    const filePath = path.resolve(__dirname, './index.html');
    res.sendFile(filePath);
});

module.exports = router;