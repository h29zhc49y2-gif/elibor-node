import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
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
import { initIO } from '../lib/socket.js';

const app = express();
const httpServer = createServer(app);
const io = initIO(httpServer);

app.use(cors());
app.use(express.json());
app.use(express.static('www'));

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/souls', soulRoutes);
app.use('/api/planet', planetRoutes);
app.use('/api/events', eventRoutes);

const PORT = parseInt(process.env.PORT || '3000');

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

export { io };
export let timeEngineInstance: TimeEngine;

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
                logger.info(`[Engine] Processing soul ${soul.id} (${soul.name})`);

                await behaviorEngine.updateNeeds(soul);

                const action = await behaviorEngine.decideAction(soul);
                logger.info(`[Engine] Soul ${soul.name} decided: ${action.type}`);

                await behaviorEngine.executeAction(soul, action);

                await economyEngine.processProduction(soul, action);
            } catch (error) {
                logger.error(`[Engine] Error processing soul ${soul.id}:`, error);
            }
        }

        await economyEngine.updatePlanetStats(activeSouls);

        await eventEngine.processRandomEvents(activeSouls);

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

const job = new CronJob('*/6 * * * *', engineTick);

httpServer.listen(PORT, () => {
    logger.info(`🚀 Elibor Web Server running on port ${PORT}`);
    logger.info(`📡 WebSocket server ready`);
    job.start();
    logger.info('[Engine] Worker started, running every 6 minutes...');
    engineTick();
});

process.on('SIGTERM', async () => {
    logger.info('[Server] Received SIGTERM, shutting down...');
    job.stop();
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('[Server] Received SIGINT, shutting down...');
    job.stop();
    await prisma.$disconnect();
    process.exit(0);
});
