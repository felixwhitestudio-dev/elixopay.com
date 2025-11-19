const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const merchantController = require('../controllers/merchantSiteController');

router.get('/', authenticate, merchantController.listMerchantSites);
router.post('/', authenticate, merchantController.createMerchantSite);
router.get('/:id', authenticate, merchantController.getMerchantSite);
router.patch('/:id', authenticate, merchantController.updateMerchantSite);

module.exports = router;