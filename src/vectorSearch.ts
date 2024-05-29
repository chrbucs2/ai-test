import {IndexEndpointServiceClient, IndexServiceClient, MatchServiceClient} from "@google-cloud/aiplatform";
import {google} from "@google-cloud/aiplatform/build/protos/protos";
import IUpdateIndexRequest = google.cloud.aiplatform.v1.IUpdateIndexRequest;
import ICreateIndexRequest = google.cloud.aiplatform.v1.ICreateIndexRequest;
import IIndex = google.cloud.aiplatform.v1.IIndex;
import IDeployIndexRequest = google.cloud.aiplatform.v1.IDeployIndexRequest;
import ICreateIndexEndpointRequest = google.cloud.aiplatform.v1.ICreateIndexEndpointRequest;
import IGetIndexEndpointRequest = google.cloud.aiplatform.v1.IGetIndexEndpointRequest;
import IIndexEndpoint = google.cloud.aiplatform.v1.IIndexEndpoint;
import IDeployedIndex = google.cloud.aiplatform.v1.IDeployedIndex;
import IFindNeighborsRequest = google.cloud.aiplatform.v1.IFindNeighborsRequest;

export class VectorSearch {
    private indexEndpointService: IndexEndpointServiceClient;
    private indexService: IndexServiceClient;
    private readonly parent: string;

    constructor(endpoint: string, project: string, hostedZone: string) {
        this.indexEndpointService = new IndexEndpointServiceClient({apiEndpoint: endpoint});
        this.indexService = new IndexServiceClient({apiEndpoint: endpoint});
        this.parent = `projects/${project}/locations/${hostedZone}`;
    }

    async createVectorSearchIndex(indexName: string, bucketName: string, dimension: number) {
        // Get existing index endpoints
        const [indexesData] = await this.indexService.listIndexes({
            parent: this.parent
        });

        // Check if endpoint already exists
        let indexData: IIndex = indexesData.find((index) => index.displayName === indexName)
        const createNewIndex = Boolean(!indexData);
        if (!indexData) {
            // create new index
            console.log('Creating new index...')
            const request: ICreateIndexRequest = {
                parent: this.parent,
                index: this.createIndexData(indexName, bucketName, dimension),
            };
            const [operation] = await this.indexService.createIndex(request);
            const [createIndexData] = await operation.promise();
            indexData = createIndexData;
            console.log(`Created index '${JSON.stringify(indexData, null, 2)}'`);
        } else {
            console.log(`Found index '${JSON.stringify(indexData, null, 2)}'`);
        }

        if (!createNewIndex) {
            // update index
            // TODO: check if this works
            console.log('Updating index...');
            const request: IUpdateIndexRequest = {
                index: indexData,
            };
            const [operation] = await this.indexService.updateIndex(request);
            const [updateIndexData] = await operation.promise();

            console.log(`Updated index: '${JSON.stringify(updateIndexData, null, 2)}'`);
        }

        return indexData.name;
    }

    async getVectorSearchIndexEndpoint(indexEndpointName: string) {// Get existing index endpoints
        const [indexEndpointsData] = await this.indexEndpointService.listIndexEndpoints({
            parent: this.parent
        });

        // Check if endpoint already exists
        return indexEndpointsData.find((endpoint) => endpoint.displayName === indexEndpointName)
    }

    async createVectorSearchIndexEndpoint(indexEndpointName: string) {
        // Check if endpoint already exists
        let indexEndpointData: IIndexEndpoint = await this.getVectorSearchIndexEndpoint(indexEndpointName);
        if (!indexEndpointData) {
            // create new index endpoint
            console.log('Creating new index endpoint...')
            const request: ICreateIndexEndpointRequest = {
                parent: this.parent,
                indexEndpoint: this.createIndexEndpointData(indexEndpointName),
            };
            const [operation] = await this.indexEndpointService.createIndexEndpoint(request);
            const [createIndexEndpointData] = await operation.promise();
            indexEndpointData = createIndexEndpointData;

            console.log(`Created index endpoint: '${JSON.stringify(indexEndpointData, null, 2)}'`);
        } else {
            console.log(`Found index endpoint: '${JSON.stringify(indexEndpointData, null, 2)}'`);
        }
        return indexEndpointData.name;
    }

    async connectVectorSearchIndexEndpoint(deployedIndexName: string, index: string, indexEndpoint: string) {
        // after endpoint creation it takes some time until it is ready
        const delay = (millis: number) => new Promise<void>((resolve) => setTimeout(_ => resolve(), millis));
        await delay(2000);

        const deployedIndexID = deployedIndexName.replace(/-/g, '_');

        // get index endpoint
        const request: IGetIndexEndpointRequest = {
            name: indexEndpoint,
        };
        const endpointDataList = await this.indexEndpointService.getIndexEndpoint(request);
        const endpointData = endpointDataList[0];

        // check if index is already deployed
        const deployedIndex = endpointData.deployedIndexes?.find((di) => di.id === deployedIndexID);
        if (!deployedIndex) {
            console.log('Connecting index to endpoint...');
            const request: IDeployIndexRequest = {
                indexEndpoint,
                deployedIndex: this.createDeployIndexData(deployedIndexID, deployedIndexName, index),
            };
            const [operation] = await this.indexEndpointService.deployIndex(request);
            const [createDeployIndexData] = await operation.promise();

            console.log(`Connected index to endpoint: ${JSON.stringify(createDeployIndexData)}`);
        } else {
            console.log(`Found deployed index for endpoint: ${JSON.stringify(deployedIndex)}`);
        }

        // return public domain for endpoint
        return [endpointData.publicEndpointDomainName, deployedIndexID];
    }

    async findNeighbors(indexEndpoint: IIndexEndpoint, deployedIndexName: string, vector: number[]) {
        const deployedIndex = indexEndpoint.deployedIndexes?.find((di) => di.displayName === deployedIndexName);

        const matchServiceClient = new MatchServiceClient({apiEndpoint: indexEndpoint.publicEndpointDomainName});
        const request: IFindNeighborsRequest = {
            indexEndpoint: indexEndpoint.name,
            deployedIndexId: deployedIndex.id,
            queries: [{
                datapoint: {featureVector: vector},
                neighborCount: 3,
            }]
        };
        const response = await matchServiceClient.findNeighbors(request);
        console.log(`Found nearest neighbors: ${JSON.stringify(response, null, 2)}`);

        return response[0].nearestNeighbors[0].neighbors.map((neighbor) => neighbor.datapoint.datapointId);
    }

    createIndexData(indexName: string, bucketName: string, dimension: number): IIndex {
        return {
            displayName: indexName,
            metadata: {
                structValue: {
                    fields: {
                        contentsDeltaUri: {
                            stringValue: 'gs://' + bucketName
                        },
                        config: {
                            structValue: {
                                fields: {
                                    dimensions: {
                                        numberValue: dimension
                                    },
                                    approximateNeighborsCount: {
                                        numberValue: 10
                                    },
                                    distanceMeasureType: {
                                        stringValue: "DOT_PRODUCT_DISTANCE"
                                    },
                                    algorithmConfig: {
                                        structValue: {
                                            fields: {
                                                treeAhConfig: {
                                                    structValue: {
                                                        fields: {
                                                            leafNodeEmbeddingCount: {
                                                                numberValue: 1000
                                                            },
                                                            leafNodesToSearchPercent: {
                                                                numberValue: 2
                                                            },
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    createIndexEndpointData(indexEndpointName: string): IIndexEndpoint {
        return {
            displayName: indexEndpointName,
            publicEndpointEnabled: true
        }
    }

    createDeployIndexData(id: string, displayName: string, index: string): IDeployedIndex {
        return {
            id: id,
            displayName: displayName,
            index: index
        }
    }
}
