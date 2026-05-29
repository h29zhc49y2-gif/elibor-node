import { PrismaClient, Soul } from '@prisma/client';
import logger from '../lib/logger.js';
import { ActionType, SoulAction, SoulPersonality } from '../types/soul.js';
import { io, timeEngineInstance } from '../web/server.js';
import { ContentEngine, EngineEvent } from './content-engine.js';

const contentEngine = new ContentEngine(new PrismaClient());

export class BehaviorEngine {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    private async emitEvent(soul: Soul, action: SoulAction): Promise<void> {
        const event: EngineEvent = {
            source: 'behavior',
            soulId: soul.id,
            soulName: soul.name,
            type: action.type,
            timestamp: new Date(),
            urgency: 'low',
            data: {
                location: soul.location,
                action: this.getActionDescription(action.type),
                output: action.output,
            },
        };

        await contentEngine.receive(event);
    }

    private getActionDescription(actionType: string): string {
        const descriptions: Record<string, string> = {
            working: '工作',
            resting: '休息',
            eating: '用餐',
            socializing: '社交',
            learning: '学习',
            exploring: '探索',
            sleeping: '睡觉',
            idle: '发呆',
        };
        return descriptions[actionType] || '某事';
    }

    async updateNeeds(soul: Soul): Promise<void> {
        const decay = {
            hunger: -3,
            energy: -2,
            social: -1,
            learning: -1,
            emotion: -1,
        };

        if (soul.currentAction === 'resting' || soul.currentAction === 'sleeping') {
            decay.energy = 10;
        }
        if (soul.currentAction === 'eating') {
            decay.hunger = 15;
        }
        if (soul.currentAction === 'socializing') {
            decay.social = 8;
        }
        if (soul.currentAction === 'learning') {
            decay.learning = 10;
        }

        await this.prisma.soul.update({
            where: { id: soul.id },
            data: {
                hunger: Math.max(0, Math.min(100, soul.hunger + decay.hunger)),
                energy: Math.max(0, Math.min(100, soul.energy + decay.energy)),
                social: Math.max(0, Math.min(100, soul.social + decay.social)),
                learning: Math.max(0, Math.min(100, soul.learning + decay.learning)),
                emotion: Math.max(0, Math.min(100, soul.emotion + decay.emotion)),
            },
        });
    }

    async decideAction(soul: Soul): Promise<SoulAction> {
        const personality = JSON.parse(soul.personality as string) as SoulPersonality;

        const driveState = await this.getDriveState(soul);
        const emotionState = await this.getEmotionState(soul);

        const scores = this.calculateActionScores(soul, personality, driveState, emotionState);

        const actionType = this.selectActionByScore(scores);
        const location = this.getLocationForAction(actionType, soul.profession);
        const output = this.calculateOutput(actionType, soul.profession, personality);

        return { type: actionType, location, duration: 1, output };
    }

    private async getDriveState(soul: Soul): Promise<Record<string, number>> {
        try {
            const driveState = await this.prisma.driveState.findUnique({
                where: { soulId: soul.id },
            });
            if (!driveState) {
                return {
                    survival: 0.5,
                    safety: 0.5,
                    belonging: 0.5,
                    esteem: 0.5,
                    selfAct: 0.5,
                };
            }
            return {
                survival: (driveState as any).survival || 0.5,
                safety: (driveState as any).safety || 0.5,
                belonging: (driveState as any).belonging || 0.5,
                esteem: (driveState as any).esteem || 0.5,
                selfAct: (driveState as any).selfAct || 0.5,
            };
        } catch {
            return {
                survival: 0.5,
                safety: 0.5,
                belonging: 0.5,
                esteem: 0.5,
                selfAct: 0.5,
            };
        }
    }

    private async getEmotionState(soul: Soul): Promise<Record<string, number>> {
        try {
            const emotionState = await this.prisma.emotionState.findUnique({
                where: { soulId: soul.id },
            });
            if (!emotionState) {
                return {
                    joy: 0.5,
                    sadness: 0,
                    anger: 0,
                    fear: 0.2,
                    trust: 0.5,
                    anticipation: 0.3,
                };
            }
            return {
                joy: (emotionState as any).joy || 0.5,
                sadness: (emotionState as any).sadness || 0,
                anger: (emotionState as any).anger || 0,
                fear: (emotionState as any).fear || 0.2,
                trust: (emotionState as any).trust || 0.5,
                anticipation: (emotionState as any).anticipation || 0.3,
            };
        } catch {
            return {
                joy: 0.5,
                sadness: 0,
                anger: 0,
                fear: 0.2,
                trust: 0.5,
                anticipation: 0.3,
            };
        }
    }

    private calculateActionScores(
        soul: Soul,
        personality: SoulPersonality,
        drives: Record<string, number>,
        emotions: Record<string, number>
    ): Record<string, number> {
        const scores: Record<string, number> = {
            eating: this.calculateNeedScore(soul.hunger, 30),
            sleeping: this.calculateNeedScore(soul.energy, 20),
            resting: this.calculateNeedScore(soul.energy, 40),
            socializing: this.calculateNeedScore(soul.social, 50),
            learning: this.calculateNeedScore(soul.learning, 60),
            working: this.calculateWorkScore(soul),
            exploring: this.calculateExploreScore(soul),
            idle: 10,
        };

        if (drives.survival < 0.3) {
            scores.eating *= 2;
        }
        if (drives.belonging < 0.4) {
            scores.socializing *= 1.5;
        }
        if (drives.selfAct < 0.3) {
            scores.learning *= 1.5;
        }
        if (emotions.joy > 0.7) {
            scores.working *= 1.2;
        }
        if (emotions.fear > 0.5) {
            scores.resting *= 1.3;
        }

        const hour = new Date().getHours();
        if (hour >= 22 || hour < 6) {
            scores.sleeping *= 2;
            scores.working *= 0.3;
        } else if (hour >= 6 && hour < 9) {
            scores.eating *= 1.5;
        } else if (hour >= 9 && hour < 18) {
            scores.working *= 1.5;
        }

        return scores;
    }

    private calculateNeedScore(value: number, threshold: number): number {
        if (value < threshold) {
            return 100 - value;
        }
        return Math.max(10, 50 - value * 0.3);
    }

    private calculateWorkScore(soul: Soul): number {
        return 60 - soul.energy * 0.3 + soul.hunger * 0.2;
    }

    private calculateExploreScore(soul: Soul): number {
        return 30 + soul.energy * 0.5 - soul.hunger * 0.3;
    }

    private selectActionByScore(scores: Record<string, number>): ActionType {
        let maxScore = -Infinity;
        let selectedAction: ActionType = 'idle';

        for (const [action, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                selectedAction = action as ActionType;
            }
        }

        return selectedAction;
    }

    private getLocationForAction(action: ActionType, profession: string): string {
        const locations: Record<string, string> = {
            working: 'mining_station',
            sleeping: 'capsule',
            resting: 'capsule',
            eating: 'cafeteria',
            socializing: 'common_area',
            learning: 'library',
            exploring: 'wilderness',
            idle: 'capsule',
        };
        return locations[action] || 'unknown';
    }

    private calculateOutput(action: ActionType, profession: string, personality: SoulPersonality): { resourceType: string; amount: number } | undefined {
        const outputs: Record<string, { resourceType: string; amount: number }> = {
            working: { resourceType: 'mineral', amount: 5 + Math.floor(Math.random() * 5) },
            learning: { resourceType: 'knowledge', amount: 2 + Math.floor(Math.random() * 3) },
            socializing: { resourceType: 'social', amount: 1 },
            exploring: { resourceType: 'discovery', amount: Math.floor(Math.random() * 3) },
        };
        return outputs[action];
    }

    async executeAction(soul: Soul, action: SoulAction): Promise<void> {
        const updates: Record<string, any> = {
            currentAction: action.type,
            location: action.location,
        };

        switch (action.type) {
            case 'eating':
                updates.hunger = Math.min(100, soul.hunger + 20);
                break;
            case 'sleeping':
            case 'resting':
                updates.energy = Math.min(100, soul.energy + 30);
                break;
            case 'socializing':
                updates.social = Math.min(100, soul.social + 15);
                updates.emotion = Math.min(100, soul.emotion + 5);
                break;
            case 'learning':
                updates.learning = Math.min(100, soul.learning + 20);
                break;
            case 'working':
                updates.energy = Math.max(0, soul.energy - 10);
                updates.totalContribution = soul.totalContribution + (action.output?.amount || 0);
                break;
            case 'exploring':
                updates.energy = Math.max(0, soul.energy - 5);
                updates.emotion = Math.min(100, soul.emotion + 10);
                break;
        }

        updates.age = soul.age + 1 / 24;
        updates.stage = this.getLifeStage(updates.age);

        await this.prisma.soul.update({
            where: { id: soul.id },
            data: updates,
        });

        await this.prisma.event.create({
            data: {
                soulId: soul.id,
                type: 'action',
                content: `${soul.name}${this.getActionDescription(action.type)}`,
                metadata: JSON.stringify(action),
            },
        });

        try {
            await this.emitEvent(soul, action);
        } catch (err) {
            logger.error('Failed to emit WebSocket event:', err);
        }

        if (action.output) {
            await this.updateResources(soul.id, action.output.resourceType, action.output.amount);
        }

        await this.recordMemory(soul, action);
    }

    private async recordMemory(soul: Soul, action: SoulAction): Promise<void> {
        try {
            const emotionState = await this.getEmotionState(soul);
            const dominantEmotion = this.getDominantEmotion(emotionState);

            const importance = action.type === 'working' ? 0.5 : action.type === 'socializing' ? 0.6 : 0.3;

            await this.prisma.episodicMemory.create({
                data: {
                    soulId: soul.id,
                    type: action.type === 'socializing' ? 'social' : 'self',
                    contentCn: `${soul.name}${this.getActionDescription(action.type)}`,
                    contentEn: `${soul.name} is ${action.type}`,
                    emotionTag: dominantEmotion,
                    importance,
                },
            });
        } catch (err) {
            logger.error('Failed to record memory:', err);
        }
    }

    private getDominantEmotion(emotions: Record<string, number>): string {
        let maxEmotion = 'joy';
        let maxValue = 0;

        for (const [emotion, value] of Object.entries(emotions)) {
            if (value > maxValue) {
                maxValue = value;
                maxEmotion = emotion;
            }
        }

        return maxEmotion;
    }

    private getLifeStage(age: number): string {
        if (age < 0.1) return 'child';
        if (age < 50) return 'adult';
        if (age < 55) return 'middle_aged';
        return 'ancient';
    }

    private async updateResources(soulId: number, resourceType: string, amount: number): Promise<void> {
        await this.prisma.soulResource.upsert({
            where: {
                soulId_resourceType: { soulId, resourceType },
            },
            update: { amount: { increment: amount } },
            create: { soulId, resourceType, amount },
        });
    }
}