export interface TextChunk {
    ordinal: number;
    content: string;
    contentHash: string;
    tokenCount: number;
}
export declare function chunkResolvedThread(text: string, maxTokens?: number, overlapTokens?: number): TextChunk[];
