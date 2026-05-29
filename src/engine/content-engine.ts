import { PrismaClient } from '@prisma/client';
import logger from '../lib/logger.js';
import { io, timeEngineInstance } from '../web/server.js';
import { ContentTemplate, DialogueTemplate } from '../types/content.js';

export interface EngineEvent {
    source: 'behavior' | 'weather' | 'meteor' | 'facility' | 'stage' | 'social' | 'monument' | 'drive' | 'emotion';
    soulId?: number;
    soulName?: string;
    type: string;
    timestamp: Date;
    planetTime?: any;
    urgency: 'low' | 'medium' | 'high';
    data: Record<string, any>;
}

export interface FeedContent {
    id: number;
    type: 'soul' | 'planet';
    soulName?: string;
    soulId?: number;
    icon: string;
    message: string;
    messageEn: string;
    planetTime: any;
    urgency: 'low' | 'medium' | 'high';
    timestamp: Date;
    metadata: Record<string, any>;
}

interface CooldownEntry {
    lastTime: number;
    count: number;
}

export class ContentEngine {
    private prisma: PrismaClient;
    private templates: Map<string, ContentTemplate> = new Map();
    private dialogueTemplates: Map<string, DialogueTemplate[]> = new Map();
    private cooldowns: Map<string, CooldownEntry> = new Map();
    private literaryProcessor: LiteraryProcessor;
    
    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
        this.literaryProcessor = new LiteraryProcessor();
        this.loadTemplates();
    }
    
    private loadTemplates(): void {
        this.templates.set('behavior:working', {
            source: 'behavior',
            type: 'working',
            templateCn: '{soul}挥动矿镐，沙砾飞溅',
            templateEn: 'The sand flies as {soul} swings the pickaxe',
            variantsCn: [
                '{soul}挥动矿镐，沙砾飞溅',
                '{soul}埋头苦干，汗水滴落在沙土上',
                '{soul}专注地敲击着矿石',
                '{soul}的身影在尘土中若隐若现'
            ],
            variantsEn: [
                'The sand flies as {soul} swings the pickaxe',
                'Sweat drips onto the sand as {soul} works hard',
                '{soul} focuses intently on cracking the ore',
                '{soul}\'s silhouette flickers through the dust'
            ],
            icon: 'pickaxe',
            conditions: { weather: 'sandstorm' }
        });
        
        this.templates.set('behavior:working', {
            source: 'behavior',
            type: 'working',
            templateCn: '{soul}在矿区辛勤工作',
            templateEn: '{soul} is working hard at the mine',
            variantsCn: [
                '{soul}在矿区辛勤工作',
                '{soul}专注地开采着矿石',
                '{soul}挥汗如雨',
                '{soul}埋头苦干'
            ],
            variantsEn: [
                '{soul} is working hard at the mine',
                '{soul} is focused on mining ore',
                '{soul} is sweating it out',
                '{soul} is buried in work'
            ],
            icon: 'pickaxe',
            conditions: {}
        });
        
        this.templates.set('behavior:resting', {
            source: 'behavior',
            type: 'resting',
            templateCn: '{soul}在栖居舱中小憩',
            templateEn: '{soul} is resting in the habitat',
            variantsCn: [
                '{soul}在栖居舱中小憩',
                '{soul}靠着墙壁闭目养神',
                '{soul}暂时放下工作，稍作休息'
            ],
            variantsEn: [
                '{soul} is resting in the habitat',
                '{soul} leans against the wall with eyes closed',
                '{soul} puts down work for a moment of rest'
            ],
            icon: 'moon',
            conditions: {}
        });
        
        this.templates.set('behavior:eating', {
            source: 'behavior',
            type: 'eating',
            templateCn: '{soul}在食堂补充能量',
            templateEn: '{soul} is refueling at the cafeteria',
            variantsCn: [
                '{soul}在食堂补充能量',
                '{soul}吃着简单的口粮',
                '肚子咕咕作响，{soul}去补充能量了'
            ],
            variantsEn: [
                '{soul} is refueling at the cafeteria',
                '{soul} eats a simple ration',
                'A growl from the stomach reminds {soul} to refuel'
            ],
            icon: 'utensils',
            conditions: {}
        });
        
        this.templates.set('behavior:socializing', {
            source: 'behavior',
            type: 'socializing',
            templateCn: '{soul}与同伴交流着',
            templateEn: '{soul} is chatting with companions',
            variantsCn: [
                '{soul}与同伴交流着',
                '{soul}与老友重逢，聊起往事',
                '{soul}与他人分享今天的见闻'
            ],
            variantsEn: [
                '{soul} is chatting with companions',
                'Old friends meet again as {soul} shares memories',
                '{soul} shares today\'s observations with others'
            ],
            icon: 'message-circle',
            conditions: {}
        });
        
        this.templates.set('behavior:sleeping', {
            source: 'behavior',
            type: 'sleeping',
            templateCn: '{soul}沉沉睡去',
            templateEn: '{soul} drifts into sleep',
            variantsCn: [
                '{soul}沉沉睡去',
                '{soul}躺在栖居舱中，进入了梦乡',
                '夜深了，{soul}终于合上了眼'
            ],
            variantsEn: [
                '{soul} drifts into sleep',
                '{soul} lies in the habitat and falls into a dream',
                'Late at night, {soul} finally closes their eyes'
            ],
            icon: 'moon',
            conditions: {}
        });
        
        this.templates.set('behavior:idle', {
            source: 'behavior',
            type: 'idle',
            templateCn: '{soul}望着远方的沙丘出神',
            templateEn: '{soul} gazes at the distant dunes',
            variantsCn: [
                '{soul}望着远方的沙丘出神',
                '{soul}的思绪飘向了远方',
                '{soul}静静地看着天空'
            ],
            variantsEn: [
                '{soul} gazes at the distant dunes',
                '{soul}\'s thoughts drift to the horizon',
                '{soul} watches the sky in silence'
            ],
            icon: 'cloud',
            conditions: {}
        });
        
        this.templates.set('weather:sandstorm', {
            source: 'weather',
            type: 'sandstorm',
            templateCn: '风沙席卷天地，遮蔽了远方的光',
            templateEn: 'The storm swallows the horizon, dimming even the distant light',
            variantsCn: [
                '风沙席卷天地，遮蔽了远方的光',
                '黄沙漫天，能见度骤降',
                '风暴呼啸，沙砾拍打着栖居舱'
            ],
            variantsEn: [
                'The storm swallows the horizon, dimming even the distant light',
                'Yellow sand fills the sky, visibility plummets',
                'The wind howls, sand battering the habitat'
            ],
            icon: 'wind',
            urgency: 'medium',
            conditions: {}
        });
        
        this.templates.set('weather:clear', {
            source: 'weather',
            type: 'clear',
            templateCn: '天空晴朗，星光点点',
            templateEn: 'The sky is clear, stars twinkling above',
            variantsCn: [
                '天空晴朗，星光点点',
                '难得的晴夜，繁星璀璨',
                '云层散去，星空重现'
            ],
            variantsEn: [
                'The sky is clear, stars twinkling above',
                'A rare clear night, stars brilliant',
                'Clouds part, revealing the starry sky'
            ],
            icon: 'sun',
            urgency: 'low',
            conditions: {}
        });
        
        this.templates.set('weather:rain', {
            source: 'weather',
            type: 'rain',
            templateCn: '雨滴落下，滋润着干涸的地表',
            templateEn: 'Rain falls, nourishing the parched ground',
            variantsCn: [
                '雨滴落下，滋润着干涸的地表',
                '难得一见的雨，水滴晶莹剔透',
                '细雨如丝，轻柔地洒落'
            ],
            variantsEn: [
                'Rain falls, nourishing the parched ground',
                'A rare sight of rain, droplets crystalline',
                'Gentle rain falls softly'
            ],
            icon: 'cloud-rain',
            urgency: 'low',
            conditions: {}
        });
        
        this.templates.set('meteor:mineral', {
            source: 'meteor',
            type: 'mineral',
            templateCn: '天边划过火光，有什么从天而降',
            templateEn: 'Fire streaks across the sky, something falls from above',
            variantsCn: [
                '天边划过火光，有什么从天而降',
                '火流星划过夜空',
                '一声闷响，陨石坠落在不远处'
            ],
            variantsEn: [
                'Fire streaks across the sky, something falls from above',
                'A fireball streaks across the night sky',
                'A dull thud as a meteor lands nearby'
            ],
            icon: 'gem',
            urgency: 'medium',
            conditions: {}
        });
        
        this.templates.set('meteor:energy', {
            source: 'meteor',
            type: 'energy',
            templateCn: '绿光闪烁，能量从天而降',
            templateEn: 'Green light flashes, energy falls from the sky',
            variantsCn: [
                '绿光闪烁，能量从天而降',
                '一束绿光划破黑暗',
                '能量结晶降临聚栖'
            ],
            variantsEn: [
                'Green light flashes, energy falls from the sky',
                'A beam of green light pierces the darkness',
                'Energy crystals descend upon Elibor'
            ],
            icon: 'zap',
            urgency: 'medium',
            conditions: {}
        });
        
        this.templates.set('meteor:disaster', {
            source: 'meteor',
            type: 'disaster',
            templateCn: '火光冲天，陨石撞击地面',
            templateEn: 'Fire erupts as the meteor strikes the ground',
            variantsCn: [
                '火光冲天，陨石撞击地面',
                '巨大的撞击声响彻大地',
                '尘埃落定，现场一片狼藉'
            ],
            variantsEn: [
                'Fire erupts as the meteor strikes the ground',
                'A tremendous impact echoes across the land',
                'Dust settles on the devastated site'
            ],
            icon: 'flame',
            urgency: 'high',
            conditions: {}
        });
        
        this.templates.set('stage:breakthrough', {
            source: 'stage',
            type: 'breakthrough',
            templateCn: '里程碑达成！{stage_name}',
            templateEn: 'Milestone! {stage_name}',
            icon: 'trophy',
            urgency: 'high',
            conditions: {}
        });
        
        this.templates.set('monument:death', {
            source: 'monument',
            type: 'death',
            templateCn: '{soul}在第{age}年悄然离世',
            templateEn: '{soul} quietly passed away in year {age}',
            variantsCn: [
                '{soul}在第{age}年悄然离世',
                '聚栖历{age}年，{soul}走完了的一生',
                '{soul}的呼吸渐渐停止，安详地离开了'
            ],
            variantsEn: [
                '{soul} quietly passed away in year {age}',
                'In year {age}, {soul}\'s journey came to an end',
                '{soul}\'s breathing slowed and peacefully departed'
            ],
            icon: 'heart',
            urgency: 'high',
            conditions: {}
        });
        
        this.dialogueTemplates.set('working', [
            { category: 'working', contentCn: '"今天的矿石真不少，干完这块就能休息了。"', contentEn: '"The ore today is plenty. Finish this block and I can rest."', probability: 0.3 },
            { category: 'working', contentCn: '"这台钻机声音真响，但习惯了就好。"', contentEn: '"This drill is loud, but you get used to it."', probability: 0.3 },
            { category: 'working', contentCn: '"手都磨出茧了，不过值得。"', contentEn: '"My hands are calloused, but it is worth it."', probability: 0.2 },
        ]);
        
        this.dialogueTemplates.set('socializing', [
            { category: 'socializing', contentCn: '"今天的天气真不错，你觉得呢？"', contentEn: '"The weather today is pleasant, isn\'t it?"', probability: 0.3 },
            { category: 'socializing', contentCn: '"好久没见到你了，最近在忙什么？"', contentEn: '"Haven\'t seen you for a while. What have you been busy with?"', probability: 0.3 },
            { category: 'socializing', contentCn: '"聚栖星球越来越好了呢。"', contentEn: '"Elibor is getting better and better."', probability: 0.2 },
        ]);
        
        this.dialogueTemplates.set('inner_thought', [
            { category: 'inner_thought', contentCn: '望着远方的沙丘，{soul}陷入了沉思：自己的存在有什么意义呢？', contentEn: 'Looking at the distant dunes, {soul} ponders: what is the meaning of my existence?', probability: 0.1 },
            { category: 'inner_thought', contentCn: '{soul}轻轻叹了口气，想起远方的故土', contentEn: '{soul} sighs softly, remembering the distant homeland', probability: 0.1 },
            { category: 'inner_thought', contentCn: '星光下，{soul}感到一丝宁静', contentEn: 'Under the starlight, {soul} feels a moment of peace', probability: 0.1 },
        ]);
        
        logger.info(`ContentEngine: Loaded ${this.templates.size} templates`);
    }
    
    async receive(event: EngineEvent): Promise<void> {
        const cooldownKey = `${event.source}:${event.type}:${event.soulId || 'global'}`;
        
        if (this.isCoolingDown(cooldownKey, event.source)) {
            return;
        }
        
        const content = await this.generate(event);
        
        if (!content) {
            return;
        }
        
        this.updateCooldown(cooldownKey);
        
        this.broadcast(content);
        
        await this.saveToDatabase(content);
    }
    
    private isCoolingDown(key: string, source: string): boolean {
        const cooldownTimes: Record<string, number> = {
            behavior: 60,
            weather: 3600,
            meteor: 0,
            facility: 300,
            stage: 0,
            social: 120,
            monument: 0,
            drive: 300,
            emotion: 300,
        };
        
        const cooldown = cooldownTimes[source] || 60;
        const entry = this.cooldowns.get(key);
        
        if (!entry) {
            return false;
        }
        
        return Date.now() - entry.lastTime < cooldown * 1000;
    }
    
    private updateCooldown(key: string): void {
        const entry = this.cooldowns.get(key);
        if (entry) {
            entry.lastTime = Date.now();
            entry.count++;
        } else {
            this.cooldowns.set(key, { lastTime: Date.now(), count: 1 });
        }
    }
    
    async generate(event: EngineEvent): Promise<FeedContent | null> {
        const templateKey = `${event.source}:${event.type}`;
        const template = this.templates.get(templateKey);
        
        if (!template) {
            return this.generateFallback(event);
        }
        
        const cnText = this.selectVariant(template.variantsCn || [], template.templateCn);
        const enText = this.selectVariant(template.variantsEn || [], template.templateEn);
        
        let planetTime = event.planetTime;
        if (!planetTime) {
            try {
                if (timeEngineInstance) {
                    planetTime = await timeEngineInstance.getCurrentPlanetTime();
                }
            } catch (err) {
                logger.error('Failed to get planet time:', err);
            }
        }
        
        const filledCn = this.fillTemplate(cnText, event);
        const filledEn = this.fillTemplate(enText, event);
        
        return {
            id: Date.now(),
            type: event.source === 'behavior' || event.source === 'social' || event.source === 'monument' ? 'soul' : 'planet',
            soulName: event.soulName,
            soulId: event.soulId,
            icon: template.icon,
            message: filledCn,
            messageEn: filledEn,
            planetTime,
            urgency: template.urgency || event.urgency,
            timestamp: event.timestamp,
            metadata: event.data,
        };
    }
    
    private generateFallback(event: EngineEvent): FeedContent | null {
        const cnText = this.literaryProcessor.process(event);
        if (!cnText) {
            return null;
        }
        
        return {
            id: Date.now(),
            type: event.soulId ? 'soul' : 'planet',
            soulName: event.soulName,
            soulId: event.soulId,
            icon: 'activity',
            message: cnText.en,
            messageEn: cnText.en,
            planetTime: event.planetTime,
            urgency: event.urgency,
            timestamp: event.timestamp,
            metadata: event.data,
        };
    }
    
    private selectVariant(variants: string[], fallback: string): string {
        if (!variants || variants.length === 0) {
            return fallback;
        }
        return variants[Math.floor(Math.random() * variants.length)];
    }
    
    private fillTemplate(template: string, event: EngineEvent): string {
        let result = template;
        result = result.replace('{soul}', event.soulName || '栖人');
        result = result.replace('{stage_name}', event.data.stageName || '新阶段');
        result = result.replace('{age}', String(event.data.age || 0));
        result = result.replace('{location}', event.data.location || '某处');
        result = result.replace('{amount}', String(event.data.amount || 0));
        result = result.replace('{resource}', event.data.resource || '');
        result = result.replace('{weather}', this.translateWeather(event.data.weather));
        return result;
    }
    
    private translateWeather(weather?: string): string {
        const translations: Record<string, string> = {
            sandstorm: '沙尘暴',
            clear: '晴朗',
            rain: '雨天',
            flare: '太阳耀斑',
            acid_rain: '酸雨',
            extreme_cold: '极寒',
        };
        return translations[weather || ''] || weather || '';
    }
    
    private broadcast(content: FeedContent): void {
        io.emit('new_event', content);
    }
    
    private async saveToDatabase(content: FeedContent): Promise<void> {
        try {
            await this.prisma.feedContent.create({
                data: {
                    type: content.type,
                    source: content.metadata.source as string || 'unknown',
                    soulId: content.soulId,
                    soulName: content.soulName,
                    messageCn: content.message,
                    messageEn: content.messageEn,
                    icon: content.icon,
                    urgency: content.urgency,
                    planetTime: content.planetTime,
                    rawEvent: content.metadata,
                    timestamp: content.timestamp,
                },
            });
        } catch (err) {
            logger.error('Failed to save feed content:', err);
        }
    }
    
    generateDialogue(soulName: string, category: string): { cn: string; en: string } | null {
        const templates = this.dialogueTemplates.get(category);
        if (!templates || templates.length === 0) {
            return null;
        }
        
        const eligible = templates.filter(t => Math.random() < (t.probability || 0.5));
        if (eligible.length === 0) {
            return null;
        }
        
        const selected = eligible[Math.floor(Math.random() * eligible.length)];
        return {
            cn: selected.contentCn.replace('{soul}', soulName),
            en: selected.contentEn.replace('{soul}', soulName),
        };
    }
}

class LiteraryProcessor {
    process(event: EngineEvent): { cn: string; en: string } | null {
        const simpleTemplates: Record<string, { cn: string; en: string }> = {
            'behavior:exploring': { cn: '{soul}正在探索未知区域', en: '{soul} is exploring unknown areas' },
            'behavior:learning': { cn: '{soul}正在学习新知识', en: '{soul} is learning new knowledge' },
            'drive:hungry': { cn: '肚子咕咕作响，提醒着{soul}该补充能量了', en: 'A growl from the stomach reminds {soul} it is time to refuel' },
            'emotion:joy': { cn: '{soul}的心情不错', en: '{soul} is in a good mood' },
            'emotion:sad': { cn: '{soul}有些闷闷不乐', en: '{soul} seems a bit down' },
        };
        
        const template = simpleTemplates[`${event.source}:${event.type}`];
        if (!template) {
            return null;
        }
        
        return {
            cn: template.cn.replace('{soul}', event.soulName || '栖人'),
            en: template.en.replace('{soul}', event.soulName || 'Soul'),
        };
    }
}

export const contentEngine = new ContentEngine(new PrismaClient());