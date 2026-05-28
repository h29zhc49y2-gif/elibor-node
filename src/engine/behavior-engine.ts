import { PrismaClient, Soul } from '@prisma/client';
import logger from '../lib/logger.js';
import { ActionType, SoulAction, SoulPersonality } from '../types/soul.js';

export class BehaviorEngine {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async updateNeeds(soul: Soul): Promise<void> {
        // 需求衰减（每小时）
        const decay = {
            hunger: -3,
            energy: -2,
            social: -1,
            learning: -1,
            emotion: -1,
        };

        // 根据当前行为调整衰减
        if (soul.currentAction === 'resting' || soul.currentAction === 'sleeping') {
            decay.energy = 10; // 休息时恢复精力
        }
        if (soul.currentAction === 'eating') {
            decay.hunger = 15; // 吃东西时恢复饥饿
        }
        if (soul.currentAction === 'socializing') {
            decay.social = 8; // 社交时恢复社交需求
        }
        if (soul.currentAction === 'learning') {
            decay.learning = 10; // 学习时恢复学习需求
        }

        // 更新需求值（限制在 0-100 范围）
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

        // 计算每个行为的优先级分数
        const scores: Record<ActionType, number> = {
            eating: this.calculateNeedScore(soul.hunger, 30, personality),
            sleeping: this.calculateNeedScore(soul.energy, 20, personality),
            resting: this.calculateNeedScore(soul.energy, 40, personality),
            socializing: this.calculateNeedScore(soul.social, 50, personality),
            learning: this.calculateNeedScore(soul.learning, 60, personality),
            working: this.calculateWorkScore(soul, personality),
            exploring: this.calculateExploreScore(soul, personality),
            idle: 10,
        };

        // 根据时间段调整分数
        const hour = new Date().getHours();
        if (hour >= 22 || hour < 6) {
            scores.sleeping *= 2;
            scores.working *= 0.3;
        } else if (hour >= 6 && hour < 9) {
            scores.eating *= 1.5;
        } else if (hour >= 9 && hour < 18) {
            scores.working *= 1.5;
        }

        // 选择最高分的行为
        const actionType = this.selectActionByScore(scores);

        // 确定位置
        const location = this.getLocationForAction(actionType, soul.profession);

        // 计算产出
        const output = this.calculateOutput(actionType, soul.profession, personality);

        return {
            type: actionType,
            location,
            duration: 1, // 1小时
            output,
        };
    }

    async executeAction(soul: Soul, action: SoulAction): Promise<void> {
        // 更新栖人状态
        const updates: Record<string, any> = {
            currentAction: action.type,
            location: action.location,
        };

        // 根据行为更新需求
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

        // 更新年龄（每24小时 = 1天）
        // 简化：每次 tick 增加 1/24 天
        updates.age = soul.age + 1 / 24;

        // 检查生命阶段
        updates.stage = this.getLifeStage(updates.age);

        await this.prisma.soul.update({
            where: { id: soul.id },
            data: updates,
        });

        // 记录事件
        await this.prisma.event.create({
            data: {
                soulId: soul.id,
                type: 'action',
                content: this.getActionDescription(soul.name, action),
                metadata: JSON.stringify(action),
            },
        });

        // 如果有产出，更新资源
        if (action.output) {
            await this.updateResources(soul.id, action.output.resourceType, action.output.amount);
        }
    }

    private calculateNeedScore(value: number, threshold: number, personality: SoulPersonality): number {
        // 需求越低，分数越高
        if (value < threshold) {
            return 100 - value;
        }
        return Math.max(0, 50 - value / 2);
    }

    private calculateWorkScore(soul: Soul, personality: SoulPersonality): number {
        // 尽责性高的栖人更愿意工作
        const conscientiousnessBonus = personality.conscientiousness / 20;
        // 精力充足时更愿意工作
        const energyBonus = soul.energy > 50 ? 20 : 0;
        // 饥饿时减少工作意愿
        const hungerPenalty = soul.hunger < 30 ? -30 : 0;

        return 40 + conscientiousnessBonus + energyBonus + hungerPenalty;
    }

    private calculateExploreScore(soul: Soul, personality: SoulPersonality): number {
        // 开放性高的栖人更愿意探索
        const opennessBonus = personality.openness / 10;
        return 20 + opennessBonus;
    }

    private selectActionByScore(scores: Record<ActionType, number>): ActionType {
        const entries = Object.entries(scores) as [ActionType, number][];
        const totalScore = entries.reduce((sum, [_, score]) => sum + Math.max(0, score), 0);
        let random = Math.random() * totalScore;

        for (const [action, score] of entries) {
            random -= Math.max(0, score);
            if (random <= 0) {
                return action;
            }
        }

        return 'idle';
    }

    private getLocationForAction(action: ActionType, profession: string): string {
        switch (action) {
            case 'working':
                return this.getWorkLocation(profession);
            case 'sleeping':
            case 'resting':
                return 'home';
            case 'eating':
                return 'kitchen';
            case 'socializing':
                return 'square';
            case 'learning':
                return 'library';
            case 'exploring':
                return 'wilderness';
            default:
                return 'home';
        }
    }

    private getWorkLocation(profession: string): string {
        switch (profession) {
            case 'farmer':
                return 'farm';
            case 'miner':
                return 'mine';
            case 'engineer':
                return 'workshop';
            case 'architect':
                return 'construction';
            case 'scientist':
                return 'lab';
            case 'healer':
                return 'clinic';
            case 'energy_engineer':
                return 'power_plant';
            case 'teacher':
                return 'school';
            default:
                return 'workshop';
        }
    }

    private calculateOutput(action: ActionType, profession: string, personality: SoulPersonality): { resourceType: string; amount: number } | undefined {
        if (action !== 'working') {
            return undefined;
        }

        // 基础产出
        let baseAmount = 5;

        // 尽责性加成
        baseAmount += personality.conscientiousness / 20;

        // 随机波动 (0.8 - 1.2)
        const randomFactor = 0.8 + Math.random() * 0.4;
        const amount = Math.round(baseAmount * randomFactor);

        // 根据职业确定资源类型
        const resourceType = this.getResourceTypeForProfession(profession);

        return { resourceType, amount };
    }

    private getResourceTypeForProfession(profession: string): string {
        switch (profession) {
            case 'farmer':
                return 'food';
            case 'miner':
                return 'ore';
            case 'engineer':
                return 'material';
            case 'architect':
                return 'material';
            case 'scientist':
                return 'research';
            case 'healer':
                return 'material';
            case 'energy_engineer':
                return 'energy';
            case 'teacher':
                return 'research';
            default:
                return 'material';
        }
    }

    private getLifeStage(age: number): string {
        if (age < 10) return 'child';
        if (age < 25) return 'youth';
        if (age < 50) return 'adult';
        if (age < 70) return 'elder';
        return 'ancient';
    }

    private getActionDescription(name: string, action: SoulAction): string {
        const actionDesc: Record<string, string> = {
            working: '正在辛勤工作',
            resting: '正在休息',
            eating: '正在享用美食',
            socializing: '正在与他人交流',
            learning: '正在学习新知识',
            exploring: '正在探索未知区域',
            sleeping: '正在睡觉',
            idle: '正在发呆',
        };

        return `${name}${actionDesc[action.type] || '正在做某事'}`;
    }

    private async updateResources(soulId: number, resourceType: string, amount: number): Promise<void> {
        await this.prisma.soulResource.upsert({
            where: {
                soulId_resourceType: {
                    soulId,
                    resourceType,
                },
            },
            update: {
                amount: { increment: amount },
            },
            create: {
                soulId,
                resourceType,
                amount,
            },
        });
    }
}
