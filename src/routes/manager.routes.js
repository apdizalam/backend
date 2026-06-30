const express = require('express');
const router = express.Router();
const {
    listManagers,
    createManager,
    updateManager,
    deleteManager,
} = require('../controllers/manager.controller');

router.get('/', listManagers);
router.post('/', createManager);
router.put('/:id', updateManager);
router.delete('/:id', deleteManager);

module.exports = router;
