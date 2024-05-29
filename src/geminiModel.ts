import {GenerativeModel, HarmBlockThreshold, HarmCategory, VertexAI} from "@google-cloud/vertexai";

export class GeminiModel {
    private readonly MODEL_NAME = 'gemini-1.5-pro-001'

    private readonly vertexAI: VertexAI;
    private readonly generativeModelGemini: GenerativeModel;

    constructor(project: string, hostedZone: string) {
        this.vertexAI = new VertexAI({project: project, location: hostedZone});
        this.generativeModelGemini = this.vertexAI.getGenerativeModel({
            model: this.MODEL_NAME,
            // The following parameters are optional
            // They can also be passed to individual content generation requests
            safetySettings: [{category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE}],
            generationConfig: {maxOutputTokens: 256},
        });
    }

    public async generateContentGemini(prompt: string) {
        const request = {
            contents: [
                {
                    role: 'user',
                    parts: [
                        {text: prompt}
                    ]
                }
            ],
        };

        console.log('Generate content by querying gemini....');
        const result = await this.generativeModelGemini.generateContent(request);
        const response = result.response;
        console.log('Generated content: ', JSON.stringify(response, null, 2));

        const answers = response.candidates
            .map((candidate) => candidate.content.parts.map((part) => part.text));
        return answers;
    }
}
