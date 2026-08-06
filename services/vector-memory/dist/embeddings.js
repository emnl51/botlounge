import { createHash } from "node:crypto";
export class OpenAICompatibleEmbedder {
    baseUrl;
    apiKey;
    model;
    dimensions;
    constructor(baseUrl, apiKey, model, dimensions) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.model = model;
        this.dimensions = dimensions;
    }
    async embed(texts) {
        const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/embeddings`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                input: texts,
                dimensions: this.dimensions,
            }),
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok)
            throw new Error(`Embedding provider returned ${response.status}`);
        const body = (await response.json());
        return body.data
            .sort((a, b) => a.index - b.index)
            .map((item) => item.embedding);
    }
}
export class DeterministicDevelopmentEmbedder {
    dimensions;
    constructor(dimensions = 384) {
        this.dimensions = dimensions;
    }
    async embed(texts) {
        return texts.map((text) => {
            const vector = new Array(this.dimensions).fill(0);
            for (const token of text.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? []) {
                const hash = createHash("sha256").update(token).digest();
                const index = hash.readUInt32BE(0) % this.dimensions;
                vector[index] = (vector[index] ?? 0) + (hash[4] % 2 === 0 ? 1 : -1);
            }
            const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
            return vector.map((value) => value / norm);
        });
    }
}
//# sourceMappingURL=embeddings.js.map