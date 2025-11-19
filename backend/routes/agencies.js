const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const agencyController = require('../controllers/agencyController');

// List agencies (public authenticated)
router.get('/', authenticate, agencyController.listAgencies);
// Create agency (admin only handled inside controller)
router.post('/', authenticate, agencyController.createAgency);
// Get single agency
router.get('/:id', authenticate, agencyController.getAgency);
// Create sub agency
router.post('/:id/sub-agencies', authenticate, agencyController.createSubAgency);
// Members
router.get('/:id/members', authenticate, agencyController.listMembers);
router.post('/:id/members', authenticate, agencyController.addMember);

module.exports = router;