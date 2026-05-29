import { Router, Request, Response } from 'express';
import prisma from '../../lib/database.js';
import { authMiddleware } from '../middleware/auth.js';
import logger from '../../lib/logger.js';

const router = Router();

// GET /api/events
router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const limit = parseInt(req.query.limit as string) || 20;

        // Get user's soul IDs
        const souls = await prisma.soul.findMany({
            where: { userId },
            select: { id: true },
        });

        const soulIds = souls.map(s => s.id);

        // Get events for user's souls
        const events = await prisma.event.findMany({
            where: {
                soulId: { in: soulIds },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                soul: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        res.json({
            code: 200,
            message: 'success',
            data: events,
        });
    } catch (error) {
        logger.error('Get events error:', error);
        res.status(500).json({ error: 'Failed to get events' });
    }
});

// GET /api/events/daily-report
router.get('/daily-report', authMiddleware, async (req: Request, res: Response) => {
    try {
        // Get the latest daily report
        const report = await prisma.dailyReport.findFirst({
            orderBy: { dayCount: 'desc' },
        });

        if (!report) {
            return res.json({
                code: 200,
                message: 'success',
                data: null,
            });
        }

        res.json({
            code: 200,
            message: 'success',
            data: report,
        });
    } catch (error) {
        logger.error('Get daily report error:', error);
        res.status(500).json({ error: 'Failed to get daily report' });
    }
});

// GET /api/events/monuments
router.get('/monuments', authMiddleware, async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;

        const monuments = await prisma.monument.findMany({
            orderBy: { contribution: 'desc' },
            take: limit,
        });

        res.json({
            code: 200,
            message: 'success',
            data: monuments,
        });
    } catch (error) {
        logger.error('Get monuments error:', error);
        res.status(500).json({ error: 'Failed to get monuments' });
    }
});

export default router;

// GET /api/events/feed - Get historical feed content
router.get('/feed', authMiddleware, async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const type = req.query.type as string;

        const where: any = {};
        if (type === 'soul') {
            where.soulId = { not: null };
        } else if (type === 'planet') {
            where.soulId = null;
        }

        const feeds = await prisma.feedContent.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: limit,
        });

        const formatted = feeds.map(f => ({
            id: f.id,
            type: f.type,
            soulId: f.soulId,
            soulName: f.soulName,
            icon: f.icon,
            message: f.messageCn,
            messageEn: f.messageEn,
            planetTime: f.planetTime,
            urgency: f.urgency,
            timestamp: f.timestamp,
        }));

        res.json({
            code: 200,
            message: 'success',
            data: formatted,
        });
    } catch (error) {
        logger.error('Get feed error:', error);
        res.status(500).json({ error: 'Failed to get feed' });
    }
});
