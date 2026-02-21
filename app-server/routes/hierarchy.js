const express = require('express');
const router = express.Router();
const hierarchyController = require('../controllers/hierarchyController');
const { authenticate } = require('../middleware/auth');

// All routes are protected
router.use(authenticate);

router.get('/', hierarchyController.getHierarchy);
router.post('/create', hierarchyController.createSubAccount);
router.put('/user/:id', hierarchyController.updateSubAccount);

module.exports = router;
