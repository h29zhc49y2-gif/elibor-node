import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import logger from '../lib/logger.js';
import authRoutes from './routes/auth.js';
import soulRoutes from './routes/souls.js';
import planetRoutes from './routes/planet.js';
import eventRoutes from './routes/events.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
});

const PORT = parseInt(process.env.PORT || '3000');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('www'));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/souls', soulRoutes);
app.use('/api/planet', planetRoutes);
app.use('/api/events', eventRoutes);

// Socket.IO
io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.on('join', (room: string) => {
        socket.join(room);
        logger.info(`Client ${socket.id} joined room: ${room}`);
    });

    socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
    });
});

// Export io for use in other modules
export { io };

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

httpServer.listen(PORT, () => {
    logger.info(`🚀 Elibor Web Server running on port ${PORT}`);
    logger.info(`📡 WebSocket server ready`);
});

export default app;
