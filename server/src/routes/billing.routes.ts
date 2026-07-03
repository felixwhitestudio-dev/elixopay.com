import express from 'express';
import * as billingController from '../controllers/billing.controller';
import { verifyIdempotency } from '../middlewares/idempotency.middleware';

const router = express.Router();

/**
 * Public routes for Merchants using API Keys
 * Auth is handled inside the controllers by extracting the Bearer token.
 */
router.post('/products', verifyIdempotency, billingController.createProduct);
router.get('/products', billingController.getProducts);
router.delete('/products/:id', billingController.deleteProduct);

router.post('/prices', verifyIdempotency, billingController.createPrice);
router.get('/prices', billingController.getPrices);

router.post('/customers', verifyIdempotency, billingController.createCustomer);
router.get('/customers', billingController.getCustomers);

router.post('/subscriptions', verifyIdempotency, billingController.createSubscription);
router.get('/subscriptions', billingController.getSubscriptions);

export default router;
