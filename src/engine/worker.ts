import { CronJob } from 'cron';
import prisma from '../lib/database.js';
import logger from '../lib/logger.js';
import { TimeEngine } from './time-engine.js';
import { BehaviorEngine } from './behavior-engine.js';
import { EconomyEngine } from './economy-engine.js';
import { EventEngine } from './event-engine.js';

const timeEngine = new TimeEngine(prisma);
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
        // 1. 更新时间（每6分钟 = 星球1小时）
        const currentTime = await timeEngine.advance();

        // 2. 获取所有活跃栖人
        const activeSouls = await prisma.soul.findMany({
            where: { status: 'alive' },
        });

        logger.info(`[Engine] Processing ${activeSouls.length} souls`);

        // 3. 批量处理栖人行为
        for (const soul of activeSouls) {
            try {
                // 需求衰减
                await behaviorEngine.updateNeeds(soul);

                // 行为决策（OCEAN个性 + 记忆 + 需求）
                const action = await behaviorEngine.decideAction(soul);

                // 执行行为
                await behaviorEngine.executeAction(soul, action);

                // 经济产出
                await economyEngine.processProduction(soul, action);
            } catch (error) {
                logger.error(`[Engine] Error processing soul ${soul.id}:`, error);
            }
        }

        // 4. 更新星球指数
        await economyEngine.updatePlanetStats(activeSouls);

        // 5. 处理随机事件
        await eventEngine.processRandomEvents(activeSouls);

        // 6. 处理社交事件
        await eventEngine.processSocialEvents(activeSouls);

        // 7. 检查是否需要生成每日播报
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
const job = new CronJob('*/6 * * * *', engineTick);

// 启动引擎
job.start();
logger.info('[Engine] Worker started, running every 6 minutes...');
logger.info('[Engine] Time scale: 6 minutes = 1 planet hour');

// 立即执行第一次
engineTick();

// 优雅关闭
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
