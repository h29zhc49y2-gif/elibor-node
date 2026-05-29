import { PrismaClient, Soul } from '@prisma/client';
import logger from '../lib/logger.js';

export type DriveType = 'survival' | 'safety' | 'belonging' | 'esteem' | 'selfAct';
export type EmotionType = 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'disgust' | 'trust' | 'anticipation';

export interface DriveState {
    survival: number;
    safety: number;
    belonging: number;
    esteem: number;
    selfAct: number;
}

export interface EmotionState {
    joy: number;
    sadness: number;
    anger: number;
    fear: number;
    surprise: number;
    disgust: number;
    trust: number;
    anticipation: number;
}

const DRIVE_DECAY_RATES: Record<DriveType, number> = {
    survival: 0.02,
    safety: 0.01,
    belonging: 0.005,
    esteem: 0.003,
    selfAct: 0.001,
};

const DRIVE_EMOTION_MAP: Record<DriveType, { positive: EmotionType[]; negative: string[] }> = {
    survival: { positive: ['anticipation'], negative: ['fear', 'anger'] },
    safety: { positive: ['trust'], negative: ['fear'] },
    belonging: { positive: ['joy', 'trust'], negative: ['sadness'] },
    esteem: { positive: ['joy'], negative: ['sadness', 'anger'] },
    selfAct: { positive: ['joy', 'anticipation'], negative: ['sadness'] },
};

export class DriveEngine {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async initSoulDrives(soulId: number): Promise<void> {
        const existing = await this.prisma.driveState.findUnique({
            where: { soulId },
        });

        if (existing) return;

        await this.prisma.driveState.create({
            data: {
                soulId,
                survival: 0.8,
                safety: 0.7,
                belonging: 0.5,
                esteem: 0.5,
                selfAct: 0.3,
            },
        });

        await this.prisma.emotionState.create({
            data: {
                soulId,
                joy: 0.3,
                sadness: 0,
                anger: 0,
                fear: 0.2,
                surprise: 0,
                disgust: 0,
                trust: 0.5,
                anticipation: 0.3,
            },
        });

        logger.info(`[Drive] Initialized drives for soul ${soulId}`);
    }

    async tick(soul: Soul): Promise<void> {
        await this.updateDrives(soul);
        await this.updateEmotions(soul);
    }

    async updateDrives(soul: Soul): Promise<void> {
        const driveState = await this.prisma.driveState.findUnique({
            where: { soulId: soul.id },
        });

        if (!driveState) {
            await this.initSoulDrives(soul.id);
            return;
        }

        let needs = soul.hunger / 100;
        let social = soul.social / 100;
        let emotion = soul.emotion / 100;
        let learning = soul.learning / 100;

        const survivalDecay = DRIVE_DECAY_RATES.survival * (1 - needs);
        const belongingDecay = DRIVE_DECAY_RATES.belonging * (1 - social);
        const esteemDecay = DRIVE_DECAY_RATES.esteem * (1 - emotion);
        const selfActDecay = DRIVE_DECAY_RATES.selfAct * (1 - learning);
        const safetyDecay = DRIVE_DECAY_RATES.safety * 0.1;

        await this.prisma.driveState.update({
            where: { soulId: soul.id },
            data: {
                survival: Math.max(0, Math.min(1, (driveState as any).survival - survivalDecay)),
                safety: Math.max(0, Math.min(1, (driveState as any).safety - safetyDecay)),
                belonging: Math.max(0, Math.min(1, (driveState as any).belonging - belongingDecay)),
                esteem: Math.max(0, Math.min(1, (driveState as any).esteem - esteemDecay)),
                selfAct: Math.max(0, Math.min(1, (driveState as any).selfAct - selfActDecay)),
            },
        });
    }

    async updateEmotions(soul: Soul): Promise<void> {
        const driveState = await this.prisma.driveState.findUnique({
            where: { soulId: soul.id },
        });

        if (!driveState) return;

        const emotionState = await this.prisma.emotionState.findUnique({
            where: { soulId: soul.id },
        });

        if (!emotionState) return;

        const ds = driveState as any;
        const es = emotionState as any;

        let joyDelta = 0;
        let sadnessDelta = 0;
        let fearDelta = 0;
        let trustDelta = 0;

        if (ds.survival > 0.7) {
            joyDelta += 0.01;
        } else if (ds.survival < 0.3) {
            fearDelta += 0.02;
            sadnessDelta += 0.01;
        }

        if (ds.belonging > 0.6) {
            joyDelta += 0.01;
            trustDelta += 0.005;
        } else if (ds.belonging < 0.3) {
            sadnessDelta += 0.02;
        }

        if (ds.esteem > 0.6) {
            joyDelta += 0.01;
        } else if (ds.esteem < 0.3) {
            sadnessDelta += 0.01;
        }

        joyDelta = Math.max(-0.05, Math.min(0.05, joyDelta));
        sadnessDelta = Math.max(-0.03, Math.min(0.03, sadnessDelta));
        fearDelta = Math.max(-0.02, Math.min(0.02, fearDelta));
        trustDelta = Math.max(-0.02, Math.min(0.02, trustDelta));

        await this.prisma.emotionState.update({
            where: { soulId: soul.id },
            data: {
                joy: Math.max(0, Math.min(1, es.joy + joyDelta)),
                sadness: Math.max(0, Math.min(1, es.sadness + sadnessDelta)),
                fear: Math.max(0, Math.min(1, es.fear + fearDelta)),
                trust: Math.max(0, Math.min(1, es.trust + trustDelta)),
            },
        });
    }

    async satisfyDrive(soulId: number, drive: DriveType, amount: number): Promise<void> {
        const driveState = await this.prisma.driveState.findUnique({
            where: { soulId },
        });

        if (!driveState) return;

        const updates: Record<string, number> = {};
        updates[drive] = Math.min(1, (driveState as any)[drive] + amount);

        await this.prisma.driveState.update({
            where: { soulId },
            data: updates,
        });

        logger.info(`[Drive] ${drive} satisfied for soul ${soulId} (+${amount})`);
    }

    async getDominantDrive(soulId: number): Promise<DriveType> {
        const driveState = await this.prisma.driveState.findUnique({
            where: { soulId },
        });

        if (!driveState) return 'survival';

        const driveKeys: DriveType[] = ['survival', 'safety', 'belonging', 'esteem', 'selfAct'];
        let minDrive: DriveType = 'survival';
        let minValue = 1;

        for (const key of driveKeys) {
            const value = (driveState as any)[key];
            if (value < minValue) {
                minValue = value;
                minDrive = key;
            }
        }

        return minDrive;
    }

    async getDominantEmotion(soulId: number): Promise<EmotionType> {
        const emotionState = await this.prisma.emotionState.findUnique({
            where: { soulId },
        });

        if (!emotionState) return 'joy';

        const emotions = emotionState as any;
        let maxEmotion: EmotionType = 'joy';
        let maxValue = 0;

        const emotionKeys: EmotionType[] = ['joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'trust', 'anticipation'];

        for (const key of emotionKeys) {
            if (emotions[key] > maxValue) {
                maxValue = emotions[key];
                maxEmotion = key;
            }
        }

        return maxEmotion;
    }

    async getSoulDrives(soulId: number): Promise<DriveState | null> {
        const driveState = await this.prisma.driveState.findUnique({
            where: { soulId },
        });

        if (!driveState) return null;

        return driveState as any;
    }

    async getSoulEmotions(soulId: number): Promise<EmotionState | null> {
        const emotionState = await this.prisma.emotionState.findUnique({
            where: { soulId },
        });

        if (!emotionState) return null;

        return emotionState as any;
    }
}

export const driveEngine = new DriveEngine(new PrismaClient());