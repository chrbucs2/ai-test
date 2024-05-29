import {helpers, PredictionServiceClient} from "@google-cloud/aiplatform";
import * as fs from "fs";
import * as getUuidByString from "uuid-by-string";

export class TextEmbeddingGeckoModel {
    private readonly MODEL_NAME = 'textembedding-gecko@001'
    private readonly GECKO_DIMENSION = 768;

    private readonly predictionServiceClientGecko: PredictionServiceClient;
    private readonly model: string;

    constructor(endpoint: string, project: string, hostedZone: string, publisher: string) {
        this.predictionServiceClientGecko = new PredictionServiceClient({apiEndpoint: endpoint});
        this.model = `projects/${project}/locations/${hostedZone}/publishers/${publisher}/models/${this.MODEL_NAME}`;
    }

    get dimension(): number {
        return this.GECKO_DIMENSION;
    }

    async generateEmbeddings(prompts: string[]) {

        // Configure the parent resource

        const instances = prompts.map(prompt => helpers.toValue({
            content: prompt,
        }));

        const parameter = {temperature: 1, maxOutputTokens: 256, topP: 0, topK: 1};
        const parameters = helpers.toValue(parameter);

        const request = {
            endpoint: this.model,
            instances,
            parameters,
        };

        // Predict request
        console.log('Generate embeddings...');
        const [response] = await this.predictionServiceClientGecko.predict(request);
        const predictions = response.predictions;

        const embeddings: number[][] = [];
        for (const prediction of predictions) {
            const embeddingObject = prediction.structValue.fields.embeddings;
            const values = embeddingObject.structValue.fields.values;
            const valueList = values.listValue.values;
            const numberValues = valueList.map(v => v.numberValue);
            embeddings.push(numberValues);
        }

        console.log(`Generated embeddings: ${JSON.stringify(embeddings)}, Vector Size: ${embeddings[0].length}`);
        return embeddings;
    }

    writeToFile(embeddingsFile: string, embeddings: number[][], sentences: string[]) {
        if (sentences.length !== embeddings.length) {
            console.log('error');
        }

        try {
            fs.writeFileSync(embeddingsFile, '');
            for (let i = 0; i < sentences.length; i++) {
                const sentence = sentences[i];
                const embedding = embeddings[i];
                const id = getUuidByString(sentence);

                const embedItem = {
                    id, embedding, sentence, source: 'code'
                }
                fs.appendFileSync(embeddingsFile, JSON.stringify(embedItem) + '\n');
            }
        } catch (err) {
            console.error(err);
        }
    }
}
