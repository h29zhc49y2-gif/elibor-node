import { Router, Request, Response } from 'express';
import prisma from '../../lib/database.js';
import { authMiddleware } from '../middleware/auth.js';
import logger from '../../lib/logger.js';

const router = Router();

// GET /api/souls
router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;

        const souls = await prisma.soul.findMany({
            where: { userId, status: 'alive' },
            select: {
                id: true,
                name: true,
                age: true,
                stage: true,
                profession: true,
                hunger: true,
                energy: true,
                social: true,
                learning: true,
                emotion: true,
                currentAction: true,
                location: true,
                totalContribution: true,
                birthDate: true,
            },
        });

        res.json({
            code: 200,
            message: 'success',
            data: souls,
        });
    } catch (error) {
        logger.error('Get souls error:', error);
        res.status(500).json({ error: 'Failed to get souls' });
    }
});

// GET /api/souls/:id
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const idParam = req.params.id;
        const soulId = typeof idParam === 'string' ? parseInt(idParam) : 0;

        const soul = await prisma.soul.findFirst({
            where: { id: soulId, userId },
            include: {
                resources: true,
                events: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
                memories: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });

        if (!soul) {
            return res.status(404).json({ error: 'Soul not found' });
        }

        res.json({
            code: 200,
            message: 'success',
            data: soul,
        });
    } catch (error) {
        logger.error('Get soul error:', error);
        res.status(500).json({ error: 'Failed to get soul' });
    }
});

// POST /api/souls
router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { name } = req.body;

        // Check max souls limit
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const soulCount = await prisma.soul.count({
            where: { userId, status: 'alive' },
        });

        if (soulCount >= user.maxSouls) {
            return res.status(400).json({ error: 'Maximum souls limit reached' });
        }

        // Create soul
        const soul = await prisma.soul.create({
            data: {
                userId,
                name: name || generateSoulName(),
                personality: JSON.stringify({
                    openness: Math.floor(Math.random() * 40) + 30,
                    conscientiousness: Math.floor(Math.random() * 40) + 30,
                    extraversion: Math.floor(Math.random() * 40) + 30,
                    agreeableness: Math.floor(Math.random() * 40) + 30,
                    neuroticism: Math.floor(Math.random() * 40) + 30,
                }),
            },
        });

        logger.info(`New soul created: ${soul.name} for user ${userId}`);

        res.status(201).json({
            code: 200,
            message: 'success',
            data: soul,
        });
    } catch (error) {
        logger.error('Create soul error:', error);
        res.status(500).json({ error: 'Failed to create soul' });
    }
});

// POST /api/souls/:id/intervene
router.post('/:id/intervene', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const idParam = req.params.id;
        const soulId = typeof idParam === 'string' ? parseInt(idParam) : 0;
        const { type } = req.body;

        // Validate intervention type
        const validTypes = ['feed', 'rest', 'social', 'learn', 'energy', 'medal', 'change_work', 'move'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Invalid intervention type' });
        }

        // Check soul belongs to user
        const soul = await prisma.soul.findFirst({
            where: { id: soulId, userId },
        });

        if (!soul) {
            return res.status(404).json({ error: 'Soul not found' });
        }

        // Check user has interventions left
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // TODO: Check daily intervention limit

        // Apply intervention effect
        const effect = getInterventionEffect(type);
        const accepted = Math.random() < 0.7; // 70% acceptance rate

        if (accepted) {
            await prisma.soul.update({
                where: { id: soulId },
                data: effect,
            });
        }

        // Record intervention
        await prisma.intervention.create({
            data: {
                userId,
                soulId,
                type,
                effect: JSON.stringify(effect),
                accepted,
            },
        });

        res.json({
            code: 200,
            message: 'success',
            data: {
                accepted,
                effect: accepted ? effect : null,
            },
        });
    } catch (error) {
        logger.error('Intervention error:', error);
        res.status(500).json({ error: 'Failed to intervene' });
    }
});

function getInterventionEffect(type: string): Record<string, number> {
    switch (type) {
        case 'feed':
            return { hunger: 20 };
        case 'rest':
            return { energy: 30 };
        case 'social':
            return { social: 20 };
        case 'learn':
            return { learning: 25 };
        case 'energy':
            return { energy: 50 };
        case 'medal':
            return { emotion: 30 };
        default:
            return {};
    }
}

function generateSoulName(): string {
    const names = [
        '小星', '阿木', '石儿', '水月', '火华',
        '林风', '山雨', '云飞', '雨落', '雪晴',
    ];
    return names[Math.floor(Math.random() * names.length)];
}

export default router;
