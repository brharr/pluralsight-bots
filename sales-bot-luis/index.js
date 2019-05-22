// Import required packages
const path = require('path');
const restify = require('restify');
const msRestAzure = require('ms-rest-azure');
const KeyVault = require('azure-keyvault');

// Import required bot services.
const { BotFrameworkAdapter, ConversationState, UserState, MemoryStorage } = require('botbuilder');
const { BotConfiguration } = require('botframework-config');
const { OISalesBot } = require('./bot');
//const { MongoDBMiddleware } = require('./middleware/mongoLoggerMiddleware');

// Read botFilePath and botFileSecret from .env file
// Note: Ensure you have a .env file and include botFilePath and botFileSecret.
const ENV_FILE = path.join(__dirname, '.env');
const env = require('dotenv').config({ path: ENV_FILE });

// Get the .bot file path
// console.log(`Showing Config Values for Bot File: ${process.env.botFilePath} and ${process.env.botFileSecret}`);
const BOT_FILE = path.join(__dirname, (process.env.botFilePath || ''));
let botConfig;
try {
    // Read bot configuration from .bot file.
    botConfig = BotConfiguration.loadSync(BOT_FILE, process.env.botFileSecret);
} catch (err) {
    console.error(`\nError reading bot file. Please ensure you have valid botFilePath and botFileSecret set for your environment.`);
    console.error(`\n - The botFileSecret is available under appsettings for your Azure Bot Service bot.`);
    console.error(`\n - If you are running this bot locally, consider adding a .env file with botFilePath and botFileSecret.`);
    console.error(`\n - See https://aka.ms/about-bot-file to learn more about .bot file its use and bot configuration.\n\n`);
    process.exit();
}

// For local development configuration as defined in .bot file
const DEV_ENVIRONMENT = 'development';

// Define name of the endpoint configuration section from the .bot file
const BOT_CONFIGURATION = (process.env.NODE_ENV || DEV_ENVIRONMENT);
const AUDIT_CONFIGURATION = (process.env.auditFunction || 0);
const LUIS_CONFIGURATION_EN = 'oi-sales-en';
const LUIS_CONFIGURATION_ES = 'oi-sales-es';

// Get bot endpoint configuration by service name
// Bot configuration as defined in .bot file
const endpointConfig = botConfig.findServiceByNameOrId(BOT_CONFIGURATION);
const luisConfig = botConfig.findServiceByNameOrId(LUIS_CONFIGURATION_EN);
const luisConfigES = botConfig.findServiceByNameOrId(LUIS_CONFIGURATION_ES);

// Auditing configuration options to determine what should be logged
/* const mongoDBSettings = {
    logOriginalMessage: true,
    logUserName: true
} */
//if (AUDIT_CONFIGURATION == 1) {
//    adapter.use(new MongoDBMiddleware(mongoDBSettings));
//}

// Create bot adapter.
const adapter = new BotFrameworkAdapter({
    appId: process.env.microsoftAppID,
    appPassword: process.env.microsoftAppPassword
});

// A bot requires a state store to persist the dialog and user state between messages.
const memoryStorage = new MemoryStorage();
let conversationState = new ConversationState(memoryStorage);
let userState = new UserState(memoryStorage);

// Create the main dialog.
startBot(conversationState, userState);

async function startBot(convo, user) {
    let secretConfig = await getSecrets();
    console.log('LUIS APP EN: ' + secretConfig.luisAppEN);

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
    let bingKey = await keyVaultClient.getSecret(vaultUri, process.env.vaultKeyNameBing, "");
    let luisAppEN = await keyVaultClient.getSecret(vaultUri, process.env.vaultKeyNameAppIdLUISEN, "");
    let luisAppES = await keyVaultClient.getSecret(vaultUri, process.env.vaultKeyNameAppIdLUISES, "");
    let luisAuthKey = await keyVaultClient.getSecret(vaultUri, process.env.vaultKeyNameAuthKeyLUIS, "");

    let cognitiveConfig = {
        luisauth: luisAuthKey.value,
        luisAppEN: luisAppEN.value,
        luisAppES: luisAppES.value,
        bingKey: bingKey.value
    }
    return cognitiveConfig;
}

async function returnBot(secretConfig, convo, user) {
    let luisApplication = {
        applicationId: secretConfig.luisAppEN,
        endpointKey: secretConfig.luisauth,
        endpoint: luisConfig.getEndpoint()
    };
    let luisApplicationES = {
        applicationId: secretConfig.luisAppES,
        endpointKey: secretConfig.luisauth,
        endpoint: luisConfigES.getEndpoint()
    };
    
    // Create configuration for LuisRecognizer's runtime behavior.
    let luisPredictionOptions = {
        includeAllIntents: true,
        log: true,
        staging: false,
        spellCheck: true,
        bingSpellCheckSubscriptionKey: secretConfig.bingKey
    };

    return new OISalesBot(luisApplication, luisApplicationES, luisPredictionOptions, convo, user);
}