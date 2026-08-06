export interface Embedder {
    dimensions: number;
    embed(texts: string[]): Promise<number[][]>;
}
export declare class OpenAICompatibleEmbedder implements Embedder {
    private readonly baseUrl;
    private readonly apiKey;
    private readonly model;
    readonly dimensions: number;
    constructor(baseUrl: string, apiKey: string, model: string, dimensions: number);
    embed(texts: string[]): Promise<number[][]>;
}
export declare class DeterministicDevelopmentEmbedder implements Embedder {
    readonly dimensions: number;
    constructor(dimensions?: number);
    embed(texts: string[]): Promise<number[][]>;
}
