import { PrismaClient, Soul } from '@prisma/client';
import { ActionType } from '../types/soul.js';

export type DriveType = 'survival' | 'safety' | 'belonging' | 'esteem' | 'selfAct';

export interface ActionScore {
    action: ActionType;
    drive: DriveType;
    score: number;
    reason: string;
}

export interface PlanetNeeds {
    oxygen: number;
    climate: number;
    water: number;
    biomass: number;
}

const DRIVE_NEED_MATRIX: Record<DriveType, Record<string, number>> = {
    survival: {
        building_oxygen: 0.9,
        collecting_water: 0.8,
        building_warmth: 0.6,
        exploring_food: 0.5,
    },
    safety: {
        building_shelter: 0.9,
        rest: 0.7,
        staying_indoor: 0.6,
        cooperating: 0.5,
    },
    belonging: {
        socializing: 0.9,
        cooperating: 0.8,
        helping: 0.7,
        sharing: 0.6,
    },
    esteem: {
        working_hard: 0.9,
        teaching: 0.7,
        leading: 0.6,
        achieving: 0.8,
    },
    selfAct: {
        exploring: 0.9,
        researching: 0.8,
        creating: 0.7,
        discovering: 0.6,
    },
};

const ACTION_DRIVE_MAP: Record<string, { drive: DriveType; need: string }> = {
    gathering: { drive: 'survival', need: 'gathering' },
    crafting: { drive: 'survival', need: 'crafting' },
    working: { drive: 'survival', need: 'working' },
    building_oxygen: { drive: 'survival', need: 'building_oxygen' },
    building_warmth: { drive: 'survival', need: 'building_warmth' },
    collecting_water: { drive: 'survival', need: 'collecting_water' },
    exploring: { drive: 'selfAct', need: 'exploring' },
    researching: { drive: 'selfAct', need: 'researching' },
    creating: { drive: 'selfAct', need: 'creating' },
    discovering: { drive: 'selfAct', need: 'discovering' },
    socializing: { drive: 'belonging', need: 'socializing' },
    cooperating: { drive: 'belonging', need: 'cooperating' },
    resting: { drive: 'safety', need: 'rest' },
    sleeping: { drive: 'safety', need: 'sleeping' },
    building_shelter: { drive: 'safety', need: 'building_shelter' },
    eating: { drive: 'survival', need: 'eating' },
    idle: { drive: 'selfAct', need: 'idle' },
};

export class DriveBehaviorEngine {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async decideAction(soul: Soul): Promise<ActionScore> {
        const drives = await this.getDrives(soul.id);
        const planetNeeds = await this.getPlanetNeeds();
        const emotion = await this.getDominantEmotion(soul.id);
        const time = this.getTimeOfDay();

        const scores = this.calculateActionScores(drives, planetNeeds, emotion, time);
        const selected = this.selectAction(scores);

        return selected;
    }

    private async getDrives(soulId: number): Promise<Record<DriveType, number>> {
        try {
            const state = await this.prisma.driveState.findUnique({
                where: { soulId },
            });
            return {
                survival: (state as any)?.survival || 0.5,
                safety: (state as any)?.safety || 0.5,
                belonging: (state as any)?.belonging || 0.5,
                esteem: (state as any)?.esteem || 0.5,
                selfAct: (state as any)?.selfAct || 0.5,
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

    private async getPlanetNeeds(): Promise<PlanetNeeds> {
        const stats = await this.prisma.planetStats.findFirst();
        return {
            oxygen: (stats as any)?.oxygen || 0,
            climate: (stats as any)?.climate || 5,
            water: (stats as any)?.water || 0,
            biomass: (stats as any)?.biomass || 0,
        };
    }

    private async getDominantEmotion(soulId: number): Promise<string> {
        try {
            const state = await this.prisma.emotionState.findUnique({
                where: { soulId },
            });
            const emotions = {
                joy: (state as any)?.joy || 0,
                sadness: (state as any)?.sadness || 0,
                fear: (state as any)?.fear || 0,
            };
            let maxEmotion = 'neutral';
            let maxValue = 0;
            for (const [emotion, value] of Object.entries(emotions)) {
                if (value > maxValue) {
                    maxValue = value;
                    maxEmotion = emotion;
                }
            }
            return maxEmotion;
        } catch {
            return 'neutral';
        }
    }

    private getTimeOfDay(): 'day' | 'night' | 'morning' | 'evening' {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 9) return 'morning';
        if (hour >= 9 && hour < 18) return 'day';
        if (hour >= 18 && hour < 22) return 'evening';
        return 'night';
    }

    private calculateActionScores(
        drives: Record<DriveType, number>,
        needs: PlanetNeeds,
        emotion: string,
        time: string
    ): ActionScore[] {
        const scores: ActionScore[] = [];

        for (const [action, config] of Object.entries(ACTION_DRIVE_MAP)) {
            const driveScore = 1 - drives[config.drive];
            const needScore = this.getNeedScore(config.need, needs);
            const emotionBonus = this.getEmotionBonus(emotion, config.drive);
            const timeBonus = this.getTimeBonus(action, time);

            const totalScore = driveScore * 0.5 + needScore * 0.3 + emotionBonus * 0.1 + timeBonus * 0.1;

            scores.push({
                action: action as ActionType,
                drive: config.drive,
                score: totalScore,
                reason: this.getReason(config.drive, config.need, drives[config.drive]),
            });
        }

        return scores.sort((a, b) => b.score - a.score);
    }

    private getNeedScore(need: string, needs: PlanetNeeds): number {
        const needMatrix: Record<string, number> = {
            gathering: 0.9,
            crafting: 0.8,
            working: 0.7,
            building_oxygen: needs.oxygen < 50 ? 0.9 : 0.3,
            collecting_water: needs.water < 30 ? 0.8 : 0.2,
            building_warmth: needs.climate < 30 ? 0.7 : 0.2,
            building_shelter: 0.5,
            researching: needs.biomass < 20 ? 0.8 : 0.3,
            creating: 0.5,
            discovering: 0.6,
            socializing: 0.5,
            cooperating: 0.5,
            exploring: 0.5,
            teaching: 0.4,
            leading: 0.3,
            achieving: 0.5,
        };
        return needMatrix[need] || 0.5;
    }

    private getEmotionBonus(emotion: string, drive: DriveType): number {
        if (emotion === 'joy' && drive === 'esteem') return 0.3;
        if (emotion === 'fear' && drive === 'safety') return 0.4;
        if (emotion === 'sadness' && drive === 'belonging') return 0.2;
        return 0;
    }

    private getTimeBonus(action: string, time: string): number {
        if (action === 'sleeping' && time === 'night') return 0.5;
        if (action === 'working' && time === 'day') return 0.3;
        if (action === 'exploring' && time === 'evening') return 0.2;
        if (action === 'resting' && time === 'night') return 0.4;
        return 0;
    }

    private getReason(drive: DriveType, need: string, driveValue: number): string {
        const driveNames: Record<DriveType, string> = {
            survival: '生存需求',
            safety: '安全需求',
            belonging: '归属需求',
            esteem: '尊重需求',
            selfAct: '自我实现需求',
        };
        return `${driveNames[drive]}紧迫度: ${(driveValue * 100).toFixed(0)}%`;
    }

    private selectAction(scores: ActionScore[]): ActionScore {
        return scores[0];
    }

    getAvailableActions(): ActionType[] {
        return Object.keys(ACTION_DRIVE_MAP) as ActionType[];
    }
}

export const driveBehaviorEngine = new DriveBehaviorEngine(new PrismaClient());