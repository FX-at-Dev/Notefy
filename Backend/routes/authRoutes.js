import { registerUser, loginUser, googleCallback } from '../controllers/authController.js';

async function authRoutes(fastify, options) {
  fastify.post('/register', registerUser);
  fastify.post('/login', loginUser);
  fastify.get('/google/callback', googleCallback);
}

export default authRoutes;
