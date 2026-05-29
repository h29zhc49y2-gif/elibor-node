import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { CronJob } from 'cron';
import logger from '../lib/logger.js';
import prisma from '../lib/database.js';
import authRoutes from './routes/auth.js';
import soulRoutes from './routes/souls.js';
import planetRoutes from './routes/planet.js';
import eventRoutes from './routes/events.js';
import { TimeEngine } from '../engine/time-engine.js';
import { BehaviorEngine } from '../engine/behavior-engine.js';
import { EconomyEngine } from '../engine/economy-engine.js';
import { EventEngine } from '../engine/event-engine.js';

const app = express();
const httpServer = createServer(app);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

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

// Export io and timeEngine for use in other modules
export { io };
export let timeEngineInstance: TimeEngine;

// Engine Integration
const timeEngine = new TimeEngine(prisma);
timeEngineInstance = timeEngine;
const behaviorEngine = new BehaviorEngine(prisma);
const economyEngine = new EconomyEngine(prisma);
const eventEngine = new EventEngine(prisma);

let isProcessing = false;

async function engineTick() {
    if (isProcessing) {
        logger.warn('[Engine] Previous tick still processing, skipping...');
        return;
    }

    isProcessing = true;
    const startTime = Date.now();
    logger.info('[Engine] Tick started');

    try {
        const currentTime = await timeEngine.advance();
        const activeSouls = await prisma.soul.findMany({
            where: { status: 'alive' },
        });

        logger.info(`[Engine] Processing ${activeSouls.length} souls`);

        for (const soul of activeSouls) {
            try {
                await behaviorEngine.updateNeeds(soul);
                const action = await behaviorEngine.decideAction(soul);
                await behaviorEngine.executeAction(soul, action);
                await economyEngine.processProduction(soul, action);
            } catch (error) {
                logger.error(`[Engine] Error processing soul ${soul.id}:`, error);
            }
        }

        await economyEngine.updatePlanetStats(activeSouls);
        await eventEngine.processRandomEvents(activeSouls);
        await eventEngine.processSocialEvents(activeSouls);

        if (currentTime.hour === 0 && currentTime.minute < 6) {
            await eventEngine.generateDailyReport(currentTime.day);
        }

        const duration = Date.now() - startTime;
        logger.info(`[Engine] Tick completed in ${duration}ms`);
    } catch (error) {
        logger.error('[Engine] Tick failed:', error);
    } finally {
        isProcessing = false;
    }
}

// 每6分钟执行一次（星球1小时）
const engineJob = new CronJob('*/6 * * * *', engineTick);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

httpServer.listen(PORT, () => {
    logger.info(`🚀 Elibor Web Server running on port ${PORT}`);
    logger.info(`📡 WebSocket server ready`);
    logger.info('[Engine] Starting engine worker...');
    engineJob.start();
    logger.info('[Engine] Worker started, running every 6 minutes...');
    logger.info('[Engine] Time scale: 6 minutes = 1 planet hour');
    engineTick();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('[Server] Received SIGTERM, shutting down...');
    engineJob.stop();
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('[Server] Received SIGINT, shutting down...');
    engineJob.stop();
    await prisma.$disconnect();
    process.exit(0);
});

export default app;
