import { createHash } from "node:crypto";
export function chunkResolvedThread(text, maxTokens = 500, overlapTokens = 80) {
    const words = text.replace(/\r\n/g, "\n").split(/\s+/).filter(Boolean);
    const wordsPerChunk = Math.max(50, Math.floor(maxTokens * 0.75));
    const overlapWords = Math.min(wordsPerChunk - 1, Math.floor(overlapTokens * 0.75));
    const chunks = [];
    for (let start = 0; start < words.length; start += wordsPerChunk - overlapWords) {
        const content = words.slice(start, start + wordsPerChunk).join(" ");
        if (!content)
            break;
        chunks.push({
            ordinal: chunks.length,
            content,
            contentHash: createHash("sha256").update(content).digest("hex"),
            tokenCount: Math.ceil(content.length / 4),
        });
        if (start + wordsPerChunk >= words.length)
            break;
    }
    return chunks;
}
//# sourceMappingURL=chunking.js.map