// Import required packages
const path = require('path');
const restify = require('restify');
const msRestAzure = require('ms-rest-azure');
const KeyVault = require('azure-keyvault');

// Import required bot services.
const { BotFrameworkAdapter, ConversationState, UserState, MemoryStorage } = require('botbuilder');
const { ComicBot } = require('./bot');
const { MongoDBMiddleware } = require('./middleware/mongoLoggerMiddleware');

// Get all of the .env file parameters as if they were App Settings to match App Service functionality
// Note: Ensure you have a .env file and include botFilePath and botFileSecret.
const ENV_FILE = path.join(__dirname, '.env');
const env = require('dotenv').config({ path: ENV_FILE });

// Create bot adapter.
const adapter = new BotFrameworkAdapter({
    appId: process.env.microsoftAppID,
    appPassword: process.env.microsoftAppPassword
});

// A bot requires a state store to persist the dialog and user state between messages.
const memoryStorage = new MemoryStorage();
let conversationState = new ConversationState(memoryStorage);
let userState = new UserState(memoryStorage);

// Auditing configuration options to determine what should be logged
/* const mongoDBSettings = {
    logOriginalMessage: true,
    logUserName: true,
    cosmosURL: process.env.auditConnString
} */
let connString = getSecretConnString();
const mongoDBSettings = {
    logOriginalMessage: true,
    logUserName: true,
    cosmosURL: connString
}
if (process.env.auditFunction == 1) {
    adapter.use(new MongoDBMiddleware(mongoDBSettings));
}

// Create the main dialog.
startBot(conversationState, userState);

async function startBot(convo, user) {
    let secretConfig = await getSecrets();
    let bot = await returnBot(secretConfig, convo, user);
    
    await startServer(bot);
}

async function startServer(bot) {
    // Create HTTP server
    let server = restify.createServer();
    server.listen(process.env.port || process.env.PORT || 3979, function() {
        console.log(`\n${ server.name } listening to ${ server.url }`);
    });

    // Listen for incoming activities and route them to your bot main dialog.
    server.post('/api/messages', (req, res) => {
        adapter.processActivity(req, res, async (context) => {
            // route to main dialog.
            await bot.onTurn(context);
        });
    });
}

async function getSecrets() {
    // Service Principal Information if Managed Service Identity is not turned on.
    const clientId = process.env.keyvaultsp;
    const domain = process.env.tenant;
    const key = process.env.keyvaultspkey;

    // Need to get required values out of Key Vault for connecting to Cognitive Services
    const vaultUri = 'https://' + process.env.vaultName + ".vault.azure.net";   

    let creds = null;
    if (process.env.useMSAZUREmsi === 1){
        creds = await msRestAzure.loginWithAppServiceMSI();
    } else {
        creds = await msRestAzure.loginWithServicePrincipalSecret(clientId, key, domain);
    }
    
    let keyVaultClient = new KeyVault.KeyVaultClient(creds);
    //let bingKey = await keyVaultClient.getSecret(vaultUri, "bingKey", "");
    let luisAppEN = await keyVaultClient.getSecret(vaultUri, "luisENAppID", "");
    let luisAppES = await keyVaultClient.getSecret(vaultUri, "luisESAppID", "");
    let luisAuthKey = await keyVaultClient.getSecret(vaultUri, "luisAuthKey", "");
    let searchKey = await keyVaultClient.getSecret(vaultUri, "searchKey", "");

    let cognitiveConfig = {
        luisauth: luisAuthKey.value,
        luisAppEN: luisAppEN.value,
        luisAppES: luisAppES.value,
        //bingKey: bingKey.value,
        searchKey: searchKey.value
    }
    return cognitiveConfig;
}

// Had to create a separate function just for the Audit Conn String because of the required
// order of how things are processed in a Bot   
async function getSecretConnString() {
    // Service Principal Information if Managed Service Identity is not turned on.
    const clientId = process.env.keyvaultsp;
    const domain = process.env.tenant;
    const key = process.env.keyvaultspkey;

    // Need to get required values out of Key Vault for connecting to Cognitive Services
    const vaultUri = 'https://' + process.env.vaultName + ".vault.azure.net";   

    let creds = null;
    if (process.env.useMSAZUREmsi === 1){
        creds = await msRestAzure.loginWithAppServiceMSI();
    } else {
        creds = await msRestAzure.loginWithServicePrincipalSecret(clientId, key, domain);
    }

    let keyVaultClient = new KeyVault.KeyVaultClient(creds);
    let auditConnString = await keyVaultClient.getSecret(vaultUri, "auditConnString", "");

    return auditConnString;
}

// returnBot function for using the Environment Variables or a .env file
/* async function returnBot(convo, user) {
    let luisApplication = {
        applicationId: process.env.luisENAppID,
        endpointKey: process.env.luisAuthor,
        endpoint: process.env.luisEndpoint
    };
    let luisApplicationES = {
        applicationId: process.env.luisESAppID,
        endpointKey: process.env.luisAuthor,
        endpoint: process.env.luisEndpoint
    };
    
    // Create configuration for LuisRecognizer's runtime behavior.
    let luisPredictionOptions = {
        includeAllIntents: true,
        log: true,
        staging: false,
        spellCheck: true,
        bingSpellCheckSubscriptionKey: process.env.bingKey
    };

    let azureSearch = {
        searchKey: process.env.searchKey,
        searchIndex: process.env.searchIndex,
        searchEndpoint: process.env.searchEndpoint
    }

    return new ComicBot(luisApplication, luisApplicationES, luisPredictionOptions, azureSearch, convo, user);
} */

// returnBot function for processing against Azure Key Vault
async function returnBot(secretConfig, convo, user) {
    let luisApplication = {
        applicationId: secretConfig.luisAppEN,
        endpointKey: secretConfig.luisauth,
        endpoint: process.env.luisEndpoint
    };
    let luisApplicationES = {
        applicationId: secretConfig.luisAppES,
        endpointKey: secretConfig.luisauth,
        endpoint: process.env.luisEndpoint
    };
    
    // Create configuration for LuisRecognizer's runtime behavior.
    let luisPredictionOptions = {
        includeAllIntents: true,
        log: true,
        staging: false,
        spellCheck: true,
        bingSpellCheckSubscriptionKey: ""
    };

    let azureSearchConfig = {
        searchKey: secretConfig.searchKey,
        searchIndex: process.env.searchIndex,
        searchEndpoint: process.env.searchEndpoint
    }

    return new ComicBot(luisApplication, luisApplicationES, luisPredictionOptions, azureSearchConfig, convo, user);
}