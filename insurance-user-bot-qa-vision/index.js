// Import required packages
const path = require('path');
const restify = require('restify');

// Import required bot services.
const { BotFrameworkAdapter, ConversationState, UserState, MemoryStorage } = require('botbuilder');
const { BotConfiguration } = require('botframework-config');

const { GenaBot } = require('./bot');
const { MongoDBMiddleware } = require('./middleware/mongoLoggerMiddleware');

// Read botFilePath and botFileSecret from .env file
// Note: Ensure you have a .env file and include botFilePath and botFileSecret.
const ENV_FILE = path.join(__dirname, '.env');
const env = require('dotenv').config({ path: ENV_FILE });
// Keep in mind, this is only being used for development purposes. In a production use case,
// these values would be loaded through environment variables created the Azure Application Settings

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
const QNA_CONFIGURATION = 'Genna FAQ';
const AUDIT_CONFIGURATION = (process.env.auditFunction || 0);

// Get bot endpoint configuration by service name
// Bot configuration as defined in .bot file
const endpointConfig = botConfig.findServiceByNameOrId(BOT_CONFIGURATION);
const qnaConfig = botConfig.findServiceByNameOrId(QNA_CONFIGURATION);

// Map the contents of qnaConfig to a consumable format for the Bot class.
const qnaEndpointSettings = {
    knowledgeBaseId: qnaConfig.kbId,
    endpointKey: qnaConfig.endpointKey,
    host: qnaConfig.hostname
}

const mongoDBSettings = {
    logOriginalMessage: true,
    logUserName: true
}
// Create bot adapter.
const adapter = new BotFrameworkAdapter({
    appId: endpointConfig.appId || process.env.microsoftAppID,
    appPassword: endpointConfig.appPassword || process.env.microsoftAppPassword
});
if (AUDIT_CONFIGURATION == 1) {
    adapter.use(new MongoDBMiddleware(mongoDBSettings));
}

// Catch-all for any unhandled errors in your bot.
/* adapter.onTurnError = async (context, error) => {
    // This check writes out errors to console log .vs. app insights.
    console.error(`\n [onTurnError]: ${ error }`);
    // Send a message to the user
    context.sendActivity(`Oops. Something went wrong!`);
    // Clear out state
    await conversationState.clear(context);
    // Save state changes.
    await conversationState.saveChanges(context);
}; */

// A bot requires a state store to persist the dialog and user state between messages.
const memoryStorage = new MemoryStorage();
let conversationState = new ConversationState(memoryStorage);
let userState = new UserState(memoryStorage);

// Create the main dialog.
const bot = new GenaBot(qnaEndpointSettings, conversationState, userState);

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