import { PrismaClient } from '@prisma/client';
import logger from '../lib/logger.js';

export type MemoryLayer = 'episodic' | 'semantic' | 'narrative';

export interface EpisodicMemory {
    id: number;
    soulId: number;
    type: 'social' | 'environmental' | 'self' | 'milestone';
    contentCn: string;
    contentEn: string;
    emotionTag: string;
    importance: number;
    timestamp: Date;
}

export interface SemanticRelation {
    id: number;
    soulId: number;
    targetSoulId: number;
    trust: number;
    intimacy: number;
    familiarity: number;
    labels: string[];
    interactionCount: number;
}

export interface NarrativeMemory {
    id: number;
    soulId: number;
    descriptionCn: string;
    descriptionEn: string;
    emotionTag: string;
    importance: number;
    timestamp: Date;
}

export class MemoryEngine {
    private prisma: PrismaClient;
    private readonly EPISODIC_MAX = 1000;
    private readonly SEMANTIC_MAX = 500;
    private readonly NARRATIVE_MAX = 100;
    private readonly IMPORTANCE_THRESHOLD = 0.7;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async recordEpisodic(
        soulId: number,
        type: 'social' | 'environmental' | 'self' | 'milestone',
        contentCn: string,
        contentEn: string,
        emotionTag: string,
        importance: number
    ): Promise<void> {
        await this.prisma.episodicMemory.create({
            data: {
                soulId,
                type,
                contentCn,
                contentEn,
                emotionTag,
                importance,
            },
        });

        if (importance >= this.IMPORTANCE_THRESHOLD) {
            await this.promoteToNarrative(soulId, contentCn, contentEn, emotionTag, importance);
        }

        await this.pruneEpisodic(soulId);
    }

    async updateSemantic(
        soulId: number,
        targetSoulId: number,
        trustDelta: number,
        intimacyDelta: number,
        labels?: string[]
    ): Promise<void> {
        const existing = await this.prisma.semanticRelation.findUnique({
            where: {
                soulId_targetSoulId: { soulId, targetSoulId }
            }
        });

        if (existing) {
            await this.prisma.semanticRelation.update({
                where: { id: existing.id },
                data: {
                    trust: Math.max(0, Math.min(1, existing.trust + trustDelta)),
                    intimacy: Math.max(0, Math.min(1, existing.intimacy + intimacyDelta)),
                    familiarity: Math.min(1, existing.familiarity + 0.01),
                    interactionCount: existing.interactionCount + 1,
                },
            });
        } else {
            await this.prisma.semanticRelation.create({
                data: {
                    soulId,
                    targetSoulId,
                    trust: 0.5 + trustDelta,
                    intimacy: Math.max(0, intimacyDelta),
                    familiarity: 0.1,
                    interactionCount: 1,
                    labels: labels || [],
                },
            });
        }
    }

    async getRelationship(soulId: number, targetSoulId: number): Promise<SemanticRelation | null> {
        const relation = await this.prisma.semanticRelation.findUnique({
            where: {
                soulId_targetSoulId: { soulId, targetSoulId }
            }
        });
        return relation as SemanticRelation | null;
    }

    async getSoulRelationships(soulId: number): Promise<{
        friends: SemanticRelation[];
        rivals: SemanticRelation[];
        acquaintances: SemanticRelation[];
    }> {
        const relations = await this.prisma.semanticRelation.findMany({
            where: { soulId },
        });

        const friends = relations.filter(r => r.trust > 0.7 && r.intimacy > 0.5);
        const rivals = relations.filter(r => r.trust < 0.3);
        const acquaintances = relations.filter(r => !friends.includes(r) && !rivals.includes(r));

        return { friends, rivals, acquaintances };
    }

    async getNarrativeMemories(soulId: number): Promise<NarrativeMemory[]> {
        const memories = await this.prisma.narrativeMemory.findMany({
            where: { soulId },
            orderBy: { timestamp: 'desc' },
            take: 50,
        });
        return memories as NarrativeMemory[];
    }

    async generateBiography(soulId: number): Promise<{
        cn: string;
        en: string;
    }> {
        const narrativeMemories = await this.getNarrativeMemories(soulId);

        if (narrativeMemories.length === 0) {
            return {
                cn: '这颗星球上曾有生命存在过，留下了无尽的回忆。',
                en: 'Life once existed on this planet, leaving behind endless memories.'
            };
        }

        const sortedMemories = narrativeMemories.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const cnParts = sortedMemories.map(m => m.descriptionCn);
        const enParts = sortedMemories.map(m => m.descriptionEn);

        return {
            cn: cnParts.join('。') + '。',
            en: enParts.join('. ') + '.',
        };
    }

    private async promoteToNarrative(
        soulId: number,
        contentCn: string,
        contentEn: string,
        emotionTag: string,
        importance: number
    ): Promise<void> {
        await this.prisma.narrativeMemory.create({
            data: {
                soulId,
                descriptionCn: contentCn,
                descriptionEn: contentEn,
                emotionTag,
                importance,
            },
        });

        await this.pruneNarrative(soulId);
    }

    private async pruneEpisodic(soulId: number): Promise<void> {
        const count = await this.prisma.episodicMemory.count({
            where: { soulId },
        });

        if (count > this.EPISODIC_MAX) {
            const toDelete = count - this.EPISODIC_MAX;
            const oldest = await this.prisma.episodicMemory.findMany({
                where: { soulId },
                orderBy: { timestamp: 'asc' },
                take: toDelete,
            });

            await this.prisma.episodicMemory.deleteMany({
                where: {
                    id: { in: oldest.map(m => m.id) },
                },
            });
        }
    }

    private async pruneNarrative(soulId: number): Promise<void> {
        const count = await this.prisma.narrativeMemory.count({
            where: { soulId },
        });

        if (count > this.NARRATIVE_MAX) {
            const toDelete = count - this.NARRATIVE_MAX;
            const lowest = await this.prisma.narrativeMemory.findMany({
                where: { soulId },
                orderBy: { importance: 'asc' },
                take: toDelete,
            });

            await this.prisma.narrativeMemory.deleteMany({
                where: {
                    id: { in: lowest.map(m => m.id) },
                },
            });
        }
    }

    async extractPatterns(soulId: number): Promise<{
        frequentEmotions: string[];
        keyRelationships: { targetId: number; trust: number }[];
        lifeThemes: string[];
    }> {
        const recentMemories = await this.prisma.episodicMemory.findMany({
            where: { soulId },
            orderBy: { timestamp: 'desc' },
            take: 100,
        });

        const emotionCounts: Record<string, number> = {};
        for (const memory of recentMemories) {
            emotionCounts[memory.emotionTag] = (emotionCounts[memory.emotionTag] || 0) + 1;
        }

        const frequentEmotions = Object.entries(emotionCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([emotion]) => emotion);

        const relations = await this.prisma.semanticRelation.findMany({
            where: { soulId },
            orderBy: { trust: 'desc' },
            take: 5,
        });

        const keyRelationships = relations.map(r => ({
            targetId: r.targetSoulId,
            trust: r.trust,
        }));

        const lifeThemes = this.inferLifeThemes(frequentEmotions);

        return { frequentEmotions, keyRelationships, lifeThemes };
    }

    private inferLifeThemes(emotions: string[]): string[] {
        const themeMap: Record<string, string> = {
            joy: '乐观的一生',
            sadness: '充满感慨',
            fear: '充满挑战',
            trust: '充满友情',
            anticipation: '不断前进',
        };

        return emotions.map(e => themeMap[e] || '平凡而真实');
    }
}

export const memoryEngine = new MemoryEngine(new PrismaClient());