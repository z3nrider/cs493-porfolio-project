const router = module.exports = require('express').Router();

router.use('/posts', require('./posts'));
router.use('/interactions', require('./interactions'));
router.use('/home', require('./home'));
