// General Settings
export const hostedZone = 'europe-west3';
export const endpointUSCentral = hostedZone + '-aiplatform.googleapis.com';
export const project = 'vw-onehubgcp-ai-dev-c0t';
export const publisher = 'google';

// Local Files to be uploaded to Cloud Storage
//export const sentencesFile = __dirname + '/sentences.json';
export const embeddingsFile = __dirname + '/embeddings.json';

// Cloud Storage Settings
export const bucketName = 'cms-search';
export const storageClass = 'standard'

// Index Settings
export const indexName = 'cms-search-index';
export const indexEndpointName = indexName + '-ep';
export const deployedIndexName = 'publish-' + indexName;
