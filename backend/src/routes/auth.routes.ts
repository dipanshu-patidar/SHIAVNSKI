import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rate-limit.middleware.js';

export const authRouter = Router();

// Public Authentication Endpoints (Rate Limited)
authRouter.post('/register', authRateLimiter, (req, res, next) => authController.register(req, res, next));
authRouter.post('/login', authRateLimiter, (req, res, next) => authController.login(req, res, next));
authRouter.post('/logout', (req, res, next) => authController.logout(req, res, next));

// Protected User Identity Endpoint
authRouter.get('/me', requireAuth, (req, res, next) => authController.me(req, res, next));

export default authRouter;
