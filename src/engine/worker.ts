import { CronJob } from 'cron';
import prisma from '../lib/database.js';
import logger from '../lib/logger.js';
import { TimeEngine } from './time-engine.js';
import { BehaviorEngine } from './behavior-engine.js';
import { EconomyEngine } from './economy-engine.js';
import { EventEngine } from './event-engine.js';
import { DriveEngine } from './drive-engine.js';
import { MemoryEngine } from './memory-engine.js';
import { WeatherEngine } from './weather-engine.js';
import { MeteorEngine } from './meteor-engine.js';
import { FacilityEngine } from './facility-engine.js';
import { SocialEngine } from './social-engine.js';
import { terraformingEngine } from './terraforming-engine.js';

const timeEngine = new TimeEngine(prisma);
const behaviorEngine = new BehaviorEngine(prisma);
const economyEngine = new EconomyEngine(prisma);
const eventEngine = new EventEngine(prisma);
const driveEngine = new DriveEngine(prisma);
const memoryEngine = new MemoryEngine(prisma);
const weatherEngine = new WeatherEngine(prisma);
const meteorEngine = new MeteorEngine(prisma);
const facilityEngine = new FacilityEngine(prisma);
const socialEngine = new SocialEngine(prisma);

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

                await driveEngine.tick(soul);

                await behaviorEngine.updateNeeds(soul);

                const action = await behaviorEngine.decideAction(soul);
                logger.info(`[Engine] Soul ${soul.name} decided: ${action.type}`);

                await behaviorEngine.executeAction(soul, action);

                await economyEngine.processProduction(soul, action);

                await driveEngine.satisfyDrive(soul.id, await driveEngine.getDominantDrive(soul.id), 0.05);
            } catch (error) {
                logger.error(`[Engine] Error processing soul ${soul.id}:`, error);
            }
        }

        await economyEngine.updatePlanetStats(activeSouls);

        await weatherEngine.tick();
        await meteorEngine.tick();

        if (activeSouls.length >= 2 && Math.random() < 0.1) {
            const soulA = activeSouls[Math.floor(Math.random() * activeSouls.length)];
            const soulB = activeSouls[Math.floor(Math.random() * activeSouls.length)];
            if (soulA.id !== soulB.id) {
                await socialEngine.processSocialInteraction(soulA.id, soulB.id, 'conversation');
            }
        }

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

job.start();
logger.info('[Engine] Worker started, running every 6 minutes...');
logger.info('[Engine] Time scale: 6 minutes = 1 planet hour');

engineTick();

process.on('SIGTERM', async () => {
    logger.info('[Engine] Received SIGTERM, shutting down...');
    job.stop();
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('[Engine] Received SIGINT, shutting down...');
    job.stop();
    await prisma.$disconnect();
    process.exit(0);
});