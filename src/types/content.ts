export interface ContentTemplate {
    source: string;
    type: string;
    templateCn: string;
    templateEn: string;
    variantsCn: string[];
    variantsEn: string[];
    icon: string;
    urgency?: 'low' | 'medium' | 'high';
    conditions?: Record<string, any>;
}

export interface DialogueTemplate {
    category: string;
    contentCn: string;
    contentEn: string;
    probability?: number;
    conditions?: Record<string, any>;
}

export interface FeedContent {
    id: number;
    type: 'soul' | 'planet';
    soulName?: string;
    soulId?: number;
    icon: string;
    message: string;
    messageEn: string;
    planetTime?: {
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
    };
    urgency: 'low' | 'medium' | 'high';
    timestamp: Date;
    metadata?: Record<string, any>;
}

export interface EngineEvent {
    source: 'behavior' | 'weather' | 'meteor' | 'facility' | 'stage' | 'social' | 'monument' | 'drive' | 'emotion' | 'dialogue';
    soulId?: number;
    soulName?: string;
    type: string;
    timestamp: Date;
    planetTime?: any;
    urgency: 'low' | 'medium' | 'high';
    data: Record<string, any>;
}