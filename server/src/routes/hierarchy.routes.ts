import express from 'express';
import { protect } from '../middlewares/auth.middleware';
import * as hierarchyController from '../controllers/hierarchy.controller';

const router = express.Router();

router.use(protect);

router.get('/', hierarchyController.getHierarchy);
router.post('/create', hierarchyController.createSubAccount);
router.put('/user/:id', hierarchyController.updateSubAccount);

export default router;
