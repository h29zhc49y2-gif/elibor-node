export interface SoulPersonality {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
}

export interface SoulMemory {
    shortTerm: MemoryItem[];
    longTerm: MemoryItem[];
}

export interface MemoryItem {
    id: string;
    type: string;
    content: string;
    timestamp: number;
    importance: number;
}

export type SoulStage = 'child' | 'youth' | 'adult' | 'elder' | 'ancient';
export type SoulStatus = 'alive' | 'dead';
export type SoulProfession = 'farmer' | 'miner' | 'engineer' | 'architect' | 'scientist' | 'healer' | 'energy_engineer' | 'teacher';

export type ActionType =
    | 'working'
    | 'resting'
    | 'eating'
    | 'socializing'
    | 'learning'
    | 'exploring'
    | 'sleeping'
    | 'idle'
    | 'gathering'
    | 'crafting'
    | 'building_oxygen'
    | 'building_warmth'
    | 'collecting_water'
    | 'building_shelter'
    | 'researching'
    | 'creating'
    | 'discovering'
    | 'cooperating'
    | 'helping'
    | 'sharing'
    | 'teaching'
    | 'leading'
    | 'achieving'
    | 'resting_safety';

export interface SoulAction {
    type: ActionType;
    location: string;
    duration: number;
    output?: {
        resourceType: string;
        amount: number;
    };
}
