const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const commissionController = require('../controllers/commissionRuleController');

router.get('/', authenticate, commissionController.listCommissionRules);
router.post('/', authenticate, commissionController.createCommissionRule);
router.patch('/:id/deactivate', authenticate, commissionController.deactivateCommissionRule);

module.exports = router;