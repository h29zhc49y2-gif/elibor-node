import { Router, Request, Response } from 'express';
import prisma from '../../lib/database.js';
import { hashPassword, verifyPassword, generateToken } from '../../lib/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import logger from '../../lib/logger.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Create user
        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
            },
        });

        // Create initial soul for the user
        const soul = await prisma.soul.create({
            data: {
                userId: user.id,
                name: generateSoulName(),
                personality: JSON.stringify({
                    openness: Math.floor(Math.random() * 40) + 30,
                    conscientiousness: Math.floor(Math.random() * 40) + 30,
                    extraversion: Math.floor(Math.random() * 40) + 30,
                    agreeableness: Math.floor(Math.random() * 40) + 30,
                    neuroticism: Math.floor(Math.random() * 40) + 30,
                }),
            },
        });

        // Generate token
        const token = generateToken({ userId: user.id, email: user.email });

        logger.info(`New user registered: ${email}`);

        res.status(201).json({
            code: 200,
            message: 'success',
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    level: user.level,
                    credits: user.credits,
                },
                soul: {
                    id: soul.id,
                    name: soul.name,
                },
            },
        });
    } catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = generateToken({ userId: user.id, email: user.email });

        logger.info(`User logged in: ${email}`);

        res.json({
            code: 200,
            message: 'success',
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    level: user.level,
                    credits: user.credits,
                },
            },
        });
    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                souls: {
                    where: { status: 'alive' },
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
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            code: 200,
            message: 'success',
            data: {
                id: user.id,
                email: user.email,
                level: user.level,
                maxSouls: user.maxSouls,
                dailyInterventions: user.dailyInterventions,
                credits: user.credits,
                souls: user.souls,
            },
        });
    } catch (error) {
        logger.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

function generateSoulName(): string {
    const names = [
        '小星', '阿木', '石儿', '水月', '火华',
        '林风', '山雨', '云飞', '雨落', '雪晴',
        '春风', '秋实', '冬雪', '夏阳', '明月',
    ];
    return names[Math.floor(Math.random() * names.length)];
}

export default router;
