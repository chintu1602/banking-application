# Azure Portal Configuration Guide - KYC Document Verification Pipeline

Follow these step-by-step instructions to set up and bind all the required Azure resources to verify the KYC pipeline works seamlessly.

---

## 1. Storage Account & Container Setup

1. **Navigate** to the [Azure Portal](https://portal.azure.com).
2. If you don't have one, create a **Storage Account** (standard performance, GRS or LRS replication).
3. Open your Storage Account resource and select **Containers** under the **Data storage** menu on the left sidebar.
4. Click **+ Container** to create a new container.
5. Set the Name to `banking-documents` (matches your application settings).
6. Set the **Public access level** to **Private (no anonymous access)**. Click **Create**.
7. Go to **Access keys** under the **Security + networking** menu.
8. Copy the **Connection string** (either Key 1 or Key 2). This value must be configured in:
   - Your local `.env` and Azure Function settings as `AZURE_STORAGE_CONNECTION_STRING`.

---

## 2. Azure AI Document Intelligence Resource & Model

1. Search for **Document Intelligence** in the top search bar of the Azure Portal.
2. Click **Create** to initialize a new resource:
   - **Pricing Tier**: F0 (Free, if available) or S0 (Standard).
   - Click **Review + Create**, then click **Create**.
3. Once deployed, open the resource and navigate to **Keys and Endpoint** under the **Resource Management** menu.
4. Copy the following:
   - **Endpoint**: Map to `DOCUMENT_INTELLIGENCE_ENDPOINT`.
   - **KEY 1** or **KEY 2**: Map to `DOCUMENT_INTELLIGENCE_KEY`.
5. Under the hood, the blob trigger will automatically invoke the prebuilt identity model: `prebuilt-idDocument` (supported in Azure AI Document Intelligence SDK). No manual model training is necessary.

---

## 3. Azure Service Bus Queue Setup

1. Search for **Service Bus** in the Azure Portal search bar.
2. Click **Create** to create a Service Bus Namespace:
   - **Pricing Tier**: Basic (sufficient for queues) or Standard.
   - Click **Review + Create**, then **Create**.
3. Once deployed, open the Service Bus Namespace resource.
4. Click **+ Queue** in the top action bar:
   - Set the Name to `kyc-reviews`.
   - Leave other settings as default and click **Create**.
5. Navigate to **Shared access policies** under the **Settings** menu on the left.
6. Click **RootManageSharedAccessKey** (or create a custom policy with Send/Listen permissions).
7. Copy the **Primary Connection String**. This value must be mapped to:
   - `SERVICE_BUS_CONNECTION_STRING` in both your FastAPI server environment and the Azure Function App.

---

## 4. Function App Environment Variables (Application Settings)

1. Open your **Azure Function App** resource in the Azure Portal.
2. Navigate to **Configuration** (under the **Settings** menu on the left).
3. Under the **Application settings** tab, click **+ New application setting** to add each of the following configurations:

| Name | Value | Description |
|---|---|---|
| `AZURE_STORAGE_CONNECTION_STRING` | *`<Your Storage Connection String>`* | Connection string for blob trigger & updating blob metadata |
| `AZURE_CONTAINER_NAME` | `banking-documents` | The container to monitor for uploaded KYC documents |
| `DOCUMENT_INTELLIGENCE_ENDPOINT` | *`<Your Document Intelligence Endpoint>`* | Endpoint URI copied from Keys and Endpoint |
| `DOCUMENT_INTELLIGENCE_KEY` | *`<Your Document Intelligence API Key>`* | Secret API key for Document Intelligence |
| `SERVICE_BUS_CONNECTION_STRING` | *`<Your Service Bus Connection String>`* | Connection string for reading from/writing to the queue |
| `SERVICE_BUS_QUEUE_NAME` | `kyc-reviews` | Queue containing the approval/rejection messages |

*Note: For the Service Bus Trigger to fire, the connection setting defined inside `function.json` is `SERVICE_BUS_CONNECTION_STRING`. Azure Functions automatically parses the value of the environment variable matching this key.*

---

## 5. Verify Binding Configurations

Once the Function App is deployed:
1. In the portal, click on your Function App and select **Functions** on the left menu.
2. You should see both functions: `KycBlobTrigger` and `KycServiceBusTrigger`.
3. Select `KycBlobTrigger` -> **Integration** to verify the trigger is configured with connection string `AZURE_STORAGE_CONNECTION_STRING` and monitors container path `banking-documents/{name}`.
4. Select `KycServiceBusTrigger` -> **Integration** to verify it is bound to the `kyc-reviews` queue using the `SERVICE_BUS_CONNECTION_STRING`.
