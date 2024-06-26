import {
    project,
    embeddingsFile,
    hostedZone,
    endpointUSCentral,
    publisher,
    bucketName, storageClass, indexName, indexEndpointName, deployedIndexName
} from './globalSettings'
import {TextEmbeddingGeckoModel} from "./textEmbeddingGeckoModel";
import {CloudStorage} from "./cloudStorage";
import {GeminiModel} from "./geminiModel";
import {VectorSearch} from "./vectorSearch";
import * as fs from "fs";

function readText(file: string) {
    const text = fs.readFileSync(file, {encoding: 'utf-8'});
    const paragraphs = text.split('\n\n');
    const sentences = paragraphs
        .filter((paragraph) => paragraph.length > 0)
        .map((paragraph) => {
            const [head, ...rest] = paragraph.split('\n');
            return rest
                .filter((line) => line.length > 0)
                .map((line) => head + '/' + line);
        })
        .flat()
    return sentences
}

async function updateIndex() {
    // generate embeddings
    const embeddings = new TextEmbeddingGeckoModel(endpointUSCentral, project, hostedZone, publisher)
    const sentences = readText(__dirname + /../ + 'woelfe.txt');
    const vectors = await embeddings.generateEmbeddings(sentences);
    embeddings.writeToFile(embeddingsFile, vectors, sentences);

    // make embeddings available within Cloud Storage Bucket for Vector Search
    // https://cloud.google.com/vertex-ai/docs/vector-search/setup/format-structure?hl=de
    const cloudStorage = new CloudStorage(hostedZone);
    await cloudStorage.createGoogleCloudStorageBucket(bucketName, storageClass);
    await cloudStorage.uploadFilesToBucket(bucketName, [embeddingsFile]);

    // create Vector Search Index on Cloud Storage Bucket
    const vectorSearch = new VectorSearch(endpointUSCentral, project, hostedZone);
    const index = await vectorSearch.createVectorSearchIndex(indexName, bucketName, embeddings.dimension);
    const indexEndpoint = await vectorSearch.createVectorSearchIndexEndpoint(indexEndpointName);
    const [publicDomain, deployedIndexId] = await vectorSearch.connectVectorSearchIndexEndpoint(deployedIndexName, index, indexEndpoint);
}

async function runQuery() {
    // do some search
    const query = 'Was fressen Wölfe?';

    // create vector for query
    const embeddings = new TextEmbeddingGeckoModel(endpointUSCentral, project, hostedZone, publisher)
    const queryVectors = await embeddings.generateEmbeddings([query]);
    const queryVector = queryVectors[0];

    // get Index Endpoint
    const vectorSearch = new VectorSearch(endpointUSCentral, project, hostedZone);
    const indexEndpoint = await vectorSearch.getVectorSearchIndexEndpoint(indexEndpointName);

    // find Nearest Neighbor IDs
    const ids = await vectorSearch.findNeighbors(indexEndpoint, deployedIndexName, queryVector);
    console.log(`Found nearest neighbor ids for query '${query}': \n\t${JSON.stringify(ids)}\n`);

    // get sources of neighbors and create context
    const context = fs.readFileSync(embeddingsFile, {encoding: 'utf-8'})
        .split('\n')
        .filter((sentenceString) => sentenceString !== "")
        .map((sentenceString) => JSON.parse(sentenceString))
        .filter((sentence) => ids.indexOf(sentence.id) >= 0)
        .map((sentence) => sentence.sentence)
        .join("\n");
    console.log(`Generated context:\n${context}\n`);

    // Use gemini to create readable answer.
    const prompt=`You are an expert question answering system, I'll give you question and context and you'll return the answer. Query : ${query} Contexts : ${context}`;
    const geminiModelHelper = new GeminiModel(project, hostedZone);
    const answer = await geminiModelHelper.generateContentGemini(prompt);
    console.log(`\nGot answer: ${JSON.stringify(answer)}`);
}

/*updateIndex().then(() => {
    runQuery()
});*/
runQuery();
