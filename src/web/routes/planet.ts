import { Router, Request, Response } from 'express';
import prisma from '../../lib/database.js';
import { authMiddleware } from '../middleware/auth.js';
import logger from '../../lib/logger.js';
import { TimeEngine } from '../../engine/time-engine.js';

const router = Router();
const timeEngine = new TimeEngine(prisma);

router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
    try {
        let stats = await prisma.planetStats.findFirst();

        if (!stats) {
            stats = await prisma.planetStats.create({
                data: {
                    oxygen: 0,
                    climate: 5,
                    water: 0,
                    biomass: 0,
                    tir: 5,
                    stage: 1,
                    population: 0,
                    dayCount: 1,
                    year: 0,
                    month: 1,
                    hour: 6,
                    lastTickTime: new Date(),
                },
            });
        }

        const planetTime = await timeEngine.getCurrentPlanetTime();

        res.json({
            code: 200,
            message: 'success',
            data: {
                ...stats,
                planetTime,
            },
        });
    } catch (error) {
        logger.error('Get planet stats error:', error);
        res.status(500).json({ error: 'Failed to get planet stats' });
    }
});

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

export default router;