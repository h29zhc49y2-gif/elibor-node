import { Router, Request, Response } from 'express';
import prisma from '../../lib/database.js';
import { authMiddleware } from '../middleware/auth.js';
import logger from '../../lib/logger.js';
import { TimeEngine } from '../../engine/time-engine.js';

const router = Router();
const timeEngine = new TimeEngine(prisma);

// GET /api/planet/stats
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
    try {
        let stats = await prisma.planetStats.findFirst();

        if (!stats) {
            stats = await prisma.planetStats.create({
                data: {
                    industry: 10,
                    agriculture: 10,
                    housing: 10,
                    technology: 5,
                    energy: 10,
                    population: 0,
                    dayCount: 1,
                    year: 0,
                    month: 1,
                    hour: 6,
                    lastTickTime: new Date(),
                },
            });
        }

        const prosperity = calculateProsperity(stats);
        const planetTime = await timeEngine.getCurrentPlanetTime();

        res.json({
            code: 200,
            message: 'success',
            data: {
                ...stats,
                prosperity,
                planetTime,
            },
        });
    } catch (error) {
        logger.error('Get planet stats error:', error);
        res.status(500).json({ error: 'Failed to get planet stats' });
    }
});

// GET /api/planet/time
router.get('/time', authMiddleware, async (req: Request, res: Response) => {
    try {
        const planetTime = await timeEngine.getCurrentPlanetTime();

        res.json({
            code: 200,
            message: 'success',
            data: planetTime,
        });
    } catch (error) {
        logger.error('Get planet time error:', error);
        res.status(500).json({ error: 'Failed to get planet time' });
    }
});

// GET /api/planet/timeline
router.get('/timeline', authMiddleware, async (req: Request, res: Response) => {
    try {
        const events = await prisma.event.findMany({
            where: {
                type: { in: ['planet', 'system'] },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        res.json({
            code: 200,
            message: 'success',
            data: events,
        });
    } catch (error) {
        logger.error('Get planet timeline error:', error);
        res.status(500).json({ error: 'Failed to get planet timeline' });
    }
});

function calculateProsperity(stats: {
    industry: number;
    agriculture: number;
    housing: number;
    technology: number;
    energy: number;
}): number {
    return Math.round(
        stats.industry * 0.25 +
        stats.agriculture * 0.20 +
        stats.housing * 0.20 +
        stats.technology * 0.15 +
        stats.energy * 0.20
    );
}

export default router;
