import { PrismaClient, Soul } from '@prisma/client';

export interface DialogueContext {
    soulId: number;
    soulName: string;
    recentMemories: { contentCn: string; contentEn: string; emotionTag: string }[];
    dominantEmotion: string;
    dominantDrive: string;
    relationships: { name: string; tag: string; trust: number }[];
    currentAction: string;
}

const DIALOGUE_TEMPLATES = {
    working: [
        { cn: '"今天的产出不错，继续努力。"', en: '"Good output today, keep it up."', emotion: 'joy' },
        { cn: '"这块矿石真硬，费了不少力气。"', en: '"This ore is tough, quite exhausting."', emotion: 'neutral' },
        { cn: '"汗水滴落在沙土上，这就是我们的使命。"', en: '"Sweat drips onto the sand, this is our mission."', emotion: 'determination' },
        { cn: '"看着产出一点点增加，心里踏实。"', en: '"Watching the output grow gives me peace."', emotion: 'satisfaction' },
    ],
    resting: [
        { cn: '"难得清闲一会儿。"', en: '"A rare moment of rest."', emotion: 'peace' },
        { cn: '"闭上眼睛，思绪飘向远方..."', en: '"Closing my eyes, thoughts drift to distant places..."', emotion: 'nostalgia' },
        { cn: '"疲惫的身体需要休息。"', en: '"The tired body craves rest."', emotion: 'exhaustion' },
        { cn: '"聚栖星球的天空，格外宁静。"', en: '"The Elibor sky is unusually peaceful."', emotion: 'calm' },
    ],
    socializing: [
        { cn: '"最近过得怎么样？"', en: '"How have you been lately?"', emotion: 'curiosity' },
        { cn: '"今天遇到了什么事？"', en: '"What happened today?"', emotion: 'interest' },
        { cn: '"一起聊聊吧。"', en: '"Let us chat for a while."', emotion: 'friendliness' },
        { cn: '"有你在真好。"', en: '"It is good to have you around."', emotion: 'joy' },
    ],
    exploring: [
        { cn: '"前面好像有什么..."', en: '"Something seems to be ahead..."', emotion: 'curiosity' },
        { cn: '"这个世界还有很多未知等着我们。"', en: '"Many unknowns await us in this world."', emotion: 'wonder' },
        { cn: '"每一步都是探索。"', en: '"Every step is an exploration."', emotion: 'adventure' },
        { cn: '"你看到了吗？那边有不一样的光。"', en: '"Do you see it? There is different light over there."', emotion: 'excitement' },
    ],
    idle: [
        { cn: '"望着天空发呆..."', en: '"Staring at the sky idly..."', emotion: 'contemplation' },
        { cn: '"在想什么呢？"', en: '"What are you thinking about?"', emotion: 'curiosity' },
        { cn: '"有时候觉得，时间过得好慢。"', en: '"Sometimes time seems to crawl."', emotion: 'melancholy' },
        { cn: '"这片星空，真美。"', en: '"This starry sky is truly beautiful."', emotion: 'awe' },
    ],
};

const EMOTION_DIALOGUES: Record<string, { cn: string; en: string }[]> = {
    joy: [
        { cn: '"今天心情真好！"', en: '"I am in a great mood today!"' },
        { cn: '"什么事情让你这么开心？"', en: '"What made you so happy?"' },
    ],
    sadness: [
        { cn: '"有些事情想不通..."', en: '"There are things I cannot understand..."' },
        { cn: '"我只想静静待一会儿。"', en: '"I just want to be alone for a while."' },
    ],
    fear: [
        { cn: '"不知道为什么，总觉得不安..."', en: '"I do not know why, but I feel uneasy..."' },
        { cn: '"你会保护我的，对吧？"', en: '"You will protect me, right?"' },
    ],
    trust: [
        { cn: '"我相信你。"', en: '"I trust you."' },
        { cn: '"有你在，我不怕。"', en: '"With you here, I am not afraid."' },
    ],
    anticipation: [
        { cn: '"期待明天会更好。"', en: '"I look forward to a better tomorrow."' },
        { cn: '"有什么值得期待的呢？"', en: '"What is there to look forward to?"' },
    ],
};

const MEMORY_RECALL_CHANCE = 0.3;
const EMOTION_EXPRESS_CHANCE = 0.2;

export class DialogueEngine {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async generateDialogue(soul: Soul): Promise<{ cn: string; en: string } | null> {
        const context = await this.buildContext(soul);

        if (Math.random() < MEMORY_RECALL_CHANCE && context.recentMemories.length > 0) {
            const memory = context.recentMemories[Math.floor(Math.random() * context.recentMemories.length)];
            return {
                cn: this.recallMemoryDialogue(memory),
                en: this.recallMemoryDialogueEn(memory),
            };
        }

        if (Math.random() < EMOTION_EXPRESS_CHANCE) {
            const emotionDialogues = EMOTION_DIALOGUES[context.dominantEmotion];
            if (emotionDialogues && emotionDialogues.length > 0) {
                const dialogue = emotionDialogues[Math.floor(Math.random() * emotionDialogues.length)];
                return dialogue;
            }
        }

        const actionDialogues = DIALOGUE_TEMPLATES[context.currentAction as keyof typeof DIALOGUE_TEMPLATES];
        if (actionDialogues) {
            const dialogue = actionDialogues[Math.floor(Math.random() * actionDialogues.length)];
            return { cn: dialogue.cn.replace('{name}', soul.name), en: dialogue.en.replace('{name}', soul.name) };
        }

        return null;
    }

    private recallMemoryDialogue(memory: { contentCn: string; emotionTag: string }): string {
        const templates = [
            `"${memory.contentCn}，那件事我一直记得。"`,
            `"还记得${memory.contentCn}吗？"`,
            `"忽然想起${memory.contentCn}..."`,
        ];
        return templates[Math.floor(Math.random() * templates.length)];
    }

    private recallMemoryDialogueEn(memory: { contentEn: string }): string {
        const templates = [
            `"${memory.contentEn}, I always remember that."`,
            `"Do you remember ${memory.contentEn}?"`,
            `"Suddenly I recall ${memory.contentEn}..."`,
        ];
        return templates[Math.floor(Math.random() * templates.length)];
    }

    async generateSocialDialogue(soulA: Soul, soulB: Soul, trust: number): Promise<{ cn: string; en: string } | null> {
        const intimacyLevel = this.getIntimacyLevel(trust);

        const socialDialogues: Record<string, { cn: string; en: string }[]> = {
            stranger: [
                { cn: '"你好。"', en: '"Hello."' },
                { cn: '"你是新来的吗？"', en: '"Are you new here?"' },
                { cn: '"很高兴认识你。"', en: '"Nice to meet you."' },
            ],
            colleague: [
                { cn: '"今天的任务完成得怎么样？"', en: '"How is today\'s task going?"' },
                { cn: '"一起加油吧。"', en: '"Let us do our best together."' },
                { cn: '"有什么需要帮忙的吗？"', en: '"Do you need any help?"' },
            ],
            friend: [
                { cn: '"好久不见，想死你了！"', en: '"Long time no see, I missed you!"' },
                { cn: '"有什么开心的事吗？"', en: '"What made you happy?"' },
                { cn: '"走，一起去转转。"', en: '"Come on, let us explore together."' },
            ],
            rival: [
                { cn: '"哼，别以为你多厉害。"', en: '"Hmph, do not think you are so great."' },
                { cn: '"等着瞧吧。"', en: '"Wait and see."' },
            ],
        };

        const dialogues = socialDialogues[intimacyLevel];
        if (dialogues) {
            return dialogues[Math.floor(Math.random() * dialogues.length)];
        }

        return socialDialogues.stranger[Math.floor(Math.random() * socialDialogues.stranger.length)];
    }

    private getIntimacyLevel(trust: number): string {
        if (trust >= 0.7) return 'friend';
        if (trust >= 0.4) return 'colleague';
        if (trust <= 0.2) return 'rival';
        return 'stranger';
    }

    private async buildContext(soul: Soul): Promise<DialogueContext> {
        const recentMemories = await this.getRecentMemories(soul.id);
        const dominantEmotion = await this.getDominantEmotion(soul.id);
        const dominantDrive = await this.getDominantDrive(soul.id);
        const relationships = await this.getRelationships(soul.id);

        return {
            soulId: soul.id,
            soulName: soul.name,
            recentMemories,
            dominantEmotion,
            dominantDrive,
            relationships,
            currentAction: soul.currentAction,
        };
    }

    private async getRecentMemories(soulId: number): Promise<{ contentCn: string; contentEn: string; emotionTag: string }[]> {
        try {
            const memories = await this.prisma.episodicMemory.findMany({
                where: { soulId },
                orderBy: { timestamp: 'desc' },
                take: 5,
            });
            return memories.map(m => ({
                contentCn: m.contentCn,
                contentEn: m.contentEn,
                emotionTag: m.emotionTag,
            }));
        } catch {
            return [];
        }
    }

    private async getDominantEmotion(soulId: number): Promise<string> {
        try {
            const state = await this.prisma.emotionState.findUnique({
                where: { soulId },
            });
            if (!state) return 'neutral';

            const emotions = {
                joy: (state as any).joy || 0,
                sadness: (state as any).sadness || 0,
                anger: (state as any).anger || 0,
                fear: (state as any).fear || 0,
                trust: (state as any).trust || 0,
                anticipation: (state as any).anticipation || 0,
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

    private async getDominantDrive(soulId: number): Promise<string> {
        try {
            const state = await this.prisma.driveState.findUnique({
                where: { soulId },
            });
            if (!state) return 'survival';

            const drives = {
                survival: (state as any).survival || 0.5,
                safety: (state as any).safety || 0.5,
                belonging: (state as any).belonging || 0.5,
                esteem: (state as any).esteem || 0.5,
                selfAct: (state as any).selfAct || 0.5,
            };

            let minDrive = 'survival';
            let minValue = 1;

            for (const [drive, value] of Object.entries(drives)) {
                if (value < minValue) {
                    minValue = value;
                    minDrive = drive;
                }
            }

            return minDrive;
        } catch {
            return 'survival';
        }
    }

    private async getRelationships(soulId: number): Promise<{ name: string; tag: string; trust: number }[]> {
        try {
            const relationsA = await this.prisma.socialGraph.findMany({
                where: { soulAId: soulId },
                take: 5,
                orderBy: { trust: 'desc' },
            });
            const relationsB = await this.prisma.socialGraph.findMany({
                where: { soulBId: soulId },
                take: 5,
                orderBy: { trust: 'desc' },
            });

            const relations = [...relationsA, ...relationsB].sort((a, b) => b.trust - a.trust);

            const result: { name: string; tag: string; trust: number }[] = [];

            for (const rel of relations.slice(0, 5)) {
                const otherId = rel.soulAId === soulId ? rel.soulBId : rel.soulAId;
                const otherSoul = await this.prisma.soul.findUnique({ where: { id: otherId } });
                if (otherSoul) {
                    result.push({
                        name: otherSoul.name,
                        tag: rel.tag,
                        trust: rel.trust,
                    });
                }
            }

            return result;
        } catch {
            return [];
        }
    }
}

export const dialogueEngine = new DialogueEngine(new PrismaClient());