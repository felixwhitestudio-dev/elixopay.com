import express from 'express';
import * as kycController from '../controllers/kyc.controller';
import { protect, restrictTo } from '../middlewares/auth.middleware';

const router = express.Router();

// User Routes
router.post(
    '/upload',
    protect,
    kycController.upload.fields([
        { name: 'idCard', maxCount: 1 },       // passport
        { name: 'idCardFront', maxCount: 1 },  // Thai ID front
        { name: 'idCardBack', maxCount: 1 },   // Thai ID back
        { name: 'selfie', maxCount: 1 },        // Selfie with document
        { name: 'statement', maxCount: 1 }
    ]),
    kycController.uploadDocuments
);

// Admin Routes
router.get('/pending', protect, restrictTo('admin'), kycController.getPendingKyc);
router.get('/all', protect, restrictTo('admin'), kycController.getAllKyc);
router.put('/verify/:userId', protect, restrictTo('admin'), kycController.verifyKyc);

export default router;
