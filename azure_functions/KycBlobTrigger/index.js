const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");
const { BlobServiceClient } = require("@azure/storage-blob");

module.exports = async function (context, myBlob) {
    const blobName = context.bindingData.name;
    const containerName = process.env.AZURE_CONTAINER_NAME || "banking-documents";
    
    context.log(`[KycBlobTrigger] Processing uploaded blob: ${blobName} (${myBlob.length} bytes)`);

    const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const docIntelEndpoint = process.env.DOCUMENT_INTELLIGENCE_ENDPOINT;
    const docIntelKey = process.env.DOCUMENT_INTELLIGENCE_KEY;

    let validationStatus = "FAILED";
    let validationError = "";
    let extractedData = {
        documentNumber: "",
        firstName: "",
        lastName: "",
        expirationDate: "",
        confidenceScore: "0.0"
    };

    if (!docIntelEndpoint || !docIntelKey) {
        context.log.error("[KycBlobTrigger Error] Document Intelligence endpoint or key is not configured in environment variables.");
        validationError = "Document Intelligence credentials missing";
        await updateBlobMetadata(context, storageConnectionString, containerName, blobName, validationStatus, validationError, extractedData);
        return;
    }

    try {
        // Initialize Document Intelligence Client
        context.log("[KycBlobTrigger] Initializing DocumentAnalysisClient...");
        const client = new DocumentAnalysisClient(docIntelEndpoint, new AzureKeyCredential(docIntelKey));

        // Call prebuilt-idDocument model
        context.log("[KycBlobTrigger] Sending document buffer to Azure Document Intelligence...");
        const poller = await client.beginAnalyzeDocument("prebuilt-idDocument", myBlob);
        const { documents } = await poller.pollUntilDone();

        if (!documents || documents.length === 0) {
            context.log.warn("[KycBlobTrigger] No document structure identified in the upload.");
            validationError = "Unrecognized identity document structure";
        } else {
            const document = documents[0];
            const fields = document.fields || {};

            // Extract fields safely
            extractedData.firstName = fields.FirstName ? fields.FirstName.value : "";
            extractedData.lastName = fields.LastName ? fields.LastName.value : "";
            extractedData.documentNumber = fields.DocumentNumber ? fields.DocumentNumber.value : "";
            extractedData.confidenceScore = document.confidence ? document.confidence.toFixed(2) : "0.0";

            if (fields.ExpirationDate && fields.ExpirationDate.value) {
                // If value is already a Date object, convert to ISO date string (YYYY-MM-DD)
                const expDate = new Date(fields.ExpirationDate.value);
                extractedData.expirationDate = expDate.toISOString().split('T')[0];
            }

            context.log(`[KycBlobTrigger] Extracted Fields: Number=${extractedData.documentNumber}, FirstName=${extractedData.firstName}, LastName=${extractedData.lastName}, Expiry=${extractedData.expirationDate}, Confidence=${extractedData.confidenceScore}`);

            // Validation rules:
            // 1. Required fields: DocumentNumber, FirstName, LastName
            if (!extractedData.documentNumber) {
                validationError = "Missing required field: DocumentNumber";
            } else if (!extractedData.firstName) {
                validationError = "Missing required field: FirstName";
            } else if (!extractedData.lastName) {
                validationError = "Missing required field: LastName";
            } 
            // 2. Expiry date check
            else if (extractedData.expirationDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const expiry = new Date(extractedData.expirationDate);
                
                if (expiry < today) {
                    validationError = `Document has expired on ${extractedData.expirationDate}`;
                }
            }

            // 3. Confidence score threshold check
            if (!validationError && document.confidence < 0.8) {
                validationError = `Confidence score (${extractedData.confidenceScore}) is below required threshold (0.80)`;
            }

            // If no error, status is SUCCESS
            if (!validationError) {
                validationStatus = "SUCCESS";
            }
        }
    } catch (err) {
        context.log.error(`[KycBlobTrigger Error] Processing failed: ${err.message}`);
        validationError = `Analysis failed: ${err.message}`;
    }

    // Write back validation status + extracted fields to Blob Metadata
    await updateBlobMetadata(
        context,
        storageConnectionString,
        containerName,
        blobName,
        validationStatus,
        validationError,
        extractedData
    );
};

async function updateBlobMetadata(context, connectionString, containerName, blobName, status, error, data) {
    if (!connectionString) {
        context.log.error("[KycBlobTrigger Error] AZURE_STORAGE_CONNECTION_STRING is missing. Cannot write metadata.");
        return;
    }

    try {
        context.log(`[KycBlobTrigger] Writing metadata back to blob ${blobName}...`);
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blobClient = containerClient.getBlobClient(blobName);

        // Sanitize values to only contain ASCII characters
        const sanitize = (val) => {
            if (!val) return "";
            // Replace non-ASCII and newlines with space
            return String(val).replace(/[^\x20-\x7E]/g, "").trim();
        };

        const metadata = {
            validationstatus: sanitize(status),
            validationerror: sanitize(error),
            documentnumber: sanitize(data.documentNumber),
            firstname: sanitize(data.firstName),
            lastname: sanitize(data.lastName),
            expirationdate: sanitize(data.expirationDate),
            confidencescore: sanitize(data.confidenceScore),
            extractedat: new Date().toISOString()
        };

        await blobClient.setMetadata(metadata);
        context.log(`[KycBlobTrigger] Metadata successfully set: status=${status}, error=${error || "none"}`);
    } catch (metaErr) {
        context.log.error(`[KycBlobTrigger Error] Failed to update blob metadata: ${metaErr.message}`);
    }
}
