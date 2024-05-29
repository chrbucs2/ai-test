// Cloud Storage Clients
import {Storage, TransferManager} from "@google-cloud/storage";

const storage = new Storage({});

export class CloudStorage {
    constructor(private hostedZone: string) {
    }

    async createGoogleCloudStorageBucket(bucketName: string, storageClass: string) {
        const buckets = await storage.getBuckets();
        if (buckets[0].find(bucket => bucket.name === bucketName)) {
            return;
        }

        // Creates the new bucket
        await storage.createBucket(bucketName, {
            location: this.hostedZone,
            [storageClass]: true,
        });
    }

    async uploadFilesToBucket(bucketName: string, files: string[]) {
        // Uploads the directory
        const bucket = storage.bucket(bucketName);
        if (!bucket) {
            return;
        }

        const transferManager = new TransferManager(storage.bucket(bucketName));
        for(const file of files) {
            await transferManager.uploadFileInChunks(file);
            console.log(`Uploaded '${file}' to Cloud Storage Bucket '${bucketName}'`)
        }
    }
}
