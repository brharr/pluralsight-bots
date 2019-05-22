const { QnAMaker } = require('botbuilder-ai');
const MongoClient = require('mongodb').MongoClient;

//const mongoURL = process.env.mongoURL;
const cosmosURL = process.env.CUSTOMCONNSTR_cosmosURL;
const dbName = "genna_audit";
const collName = "conversations";

/**
 * Custom wrapper around QnAMaker from botbuilder-ai.
 * Adds auditing to the retrieval of FAQ answers.
 */
class gennaQnAMaker extends QnAMaker {
    constructor(endpoint, options, logOriginalMessage, logUserName) {
        super(endpoint);
        this.QnAMsgEvent = 'QnAMessage';
        this.requestConfig = options;
        this.logOriginalMessage = logOriginalMessage;
        this.logUserName = logUserName;
        const mongoOptions = {
            useNewUrlParser: true
        }

        // Create a new MongoClient
        //this.mongoDBClient = new MongoClient(mongoURL, mongoOptions);
        this.mongoDBClient = new MongoClient(cosmosURL, mongoOptions);
    }

    /**
     * Calls QnA Maker and then sends a custom Event to Application Insights with results that matched closest with the user's message.
     * Sends the top scoring Question and Answer pairing to Application Insights.
     * @param {WaterfallStepContext} turnContext The TurnContext instance with the necessary information to perform the calls.
     */
    async generateAnswer(stepContext) {
        try {
            // Use connect method to connect to the Server
            await this.mongoDBClient.connect();
            const db = this.mongoDBClient.db(dbName);
            const collection = db.collection(collName);
            const auditProperties = {};
            const activity = stepContext.context.activity;

            // Call QnAMaker.generateAnswer to retrieve possible Question and Answer pairings for the user's message.
            const results = await super.generateAnswer(stepContext.result);

            // Make it so we can correlate our reports with Activity or Conversation.
            auditProperties.ActivityId = activity.id;
            if (activity.conversation.id) {
                auditProperties.ConversationId = activity.conversation.id;
            }

            // For some customers, logging original text name within Application Insights might be an issue.
            if (this.logOriginalMessage && activity.text) {
                auditProperties.OriginalQuestion = activity.text;
            }

            // For some customers, logging user name within Application Insights might be an issue.
            if (this.logUserName && activity.from.name) {
                auditProperties.Username = activity.from.name;
            }

            // Fill in QnA Results (found or not).
            if (results.length > 0) {
                const queryResult = results[0];
                auditProperties.Question = queryResult.questions[0];
                auditProperties.Answer = queryResult.answer;
                auditProperties.Score = queryResult.score;
            } else {
                auditProperties.Question = 'No QnA Question matched.';
                auditProperties.Answer = 'No QnA Question matched.';
            }

            // Finish constructing the event.
            const qnaMsgEvent = {
                name: 'QnAMessage',
                properties: auditProperties
            };    
            
            collection.insertOne(qnaMsgEvent);

            return results;
        } catch (err) {
            console.log(err.stack);
        }
    }
}

module.exports.gennaQnAMaker = gennaQnAMaker;