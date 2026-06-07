import express from 'express';
import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

// Import database config
import { connectDB } from './config/db';

// Import routers
import authRouter from './routes/auth';
import businessRouter from './routes/business';
import knowledgeRouter from './routes/knowledge';
import webhookRouter from './routes/webhook';
import conversationRouter from './routes/conversation';
import broadcastRouter, { initBroadcastCron } from './routes/broadcast';
import billingRouter from './routes/billing';

// Import error handler middleware
import { errorHandler } from './middleware/errorHandler';

dotenv.config({ override: true });

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.set('io', io);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB (only if not testing)
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

// Register routes
app.use('/api/auth', authRouter);
app.use('/api/business', businessRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api/conversations', conversationRouter);
app.use('/api/broadcast', broadcastRouter);
app.use('/api/billing', billingRouter);

app.get('/', (req, res) => {
  res.json({
    name: 'BizReply Backend Service',
    version: '1.0.0',
    status: 'Running',
    mockMode: process.env.MOCK_SERVICES === 'true'
  });
});

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('joinBusiness', (businessId: string) => {
    if (businessId) {
      socket.join(businessId);
      console.log(`[Socket] Socket ${socket.id} joined room for business: ${businessId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Initialize Cron broadcast job
initBroadcastCron();

// Global Error Handler Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Export server and app for Jest testing purposes
export { app, server };

// Only listen if not loaded by a test runner (jest defines describe) or verification script
if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'verify') {
  server.listen(PORT, () => {
    console.log(`[Server] BizReply server listening on port ${PORT}`);
  });
}
