const MongoClient = require('mongodb').MongoClient;
const { Activity, TurnContext } = require('botbuilder');

const dbName = "bot_audit";
const collName = "conversations";

/**
 * Middleware for logging incoming activities into Application Insights.
 * In addition, registers a service so other components can log telemetry.
 * If this component is not registered, visibility within the Bot is not logged.
 */
class MongoDBMiddleware {
    constructor(settings) {

        const mongoOptions = {
            useNewUrlParser: true
        }
        // Create a new MongoClient
        this.mongoDBClient = new MongoClient(settings.cosmosURL, mongoOptions);

        if (!settings) {
            throw new Error('The settings parameter is required.');
        }
        if (settings.logUserName) {
            this.logUserName = settings.logUserName;
        }
        if (settings.logOriginalMessage) {
            this.logOriginalMessage = settings.logOriginalMessage;
        }
    }

    /**
     * Records incoming and outgoing activities to the Document Data store.
     * @param {TurnContext} turnContext Context for the current turn of conversation with the user.
     * @param {Promise<void>} next Function to invoke at the end of the middleware chain.
     */
    async onTurn(turnContext, next) {
        if (turnContext.activity) {
            // Store the TelemetryClient on the TurnContext's turnState so MyAppInsightsQnAMaker can use it.
            // turnContext.turnState.set(this.appInsightsServiceKey, this._telemetryClient);

            const activity = turnContext.activity;

            try {
                // Use connect method to connect to the Server
                await this.mongoDBClient.connect();
                const db = this.mongoDBClient.db(dbName);
                const collection = db.collection(collName);
            
                // Construct the EventTelemetry object.
                const msgReceivedEvent = { name: this.botMsgReceivedEvent };
                // Add activity specific information, e.g. user ID, conversation ID, to the Event's properties.
                msgReceivedEvent.properties = this.fillReceiveEventProperties(turnContext.activity);
                
                // Add handlers onto the context sendActivities, updateActivities, and deleteActivities methods.
                // When calling any of these methods on the current context, a separate document object will be created to send to the Document Database
                turnContext.onSendActivities(async (turnContext, activities, nextSend) => {
                    const responses = await nextSend();
                    // Create each activity's Message Document and send it to MongoDB.
                    activities.forEach((activity) => {
                        const msgSentEvent = { name: this.botMsgSendEvent, properties: this.fillSendEventProperties(activity) };
                        console.log('Message: ' + JSON.stringify(msgSentEvent));
                        collection.insertOne(msgSentEvent);
                        // this._telemetryClient.trackEvent(msgSentEvent);
                    });
                    return responses;
                });

                // Create the Message for a Delete Activity and send to a Document Database.
                // This is a relatively rare case.
                turnContext.onDeleteActivity(async (turnContext, reference, nextDelete) => {
                    await nextDelete();
                    // Create the delete activity's Event Telemetry and send it to Application Insights.
                    const deleteMsgEvent = { name: this.botMsgDeleteEvent, properties: this.createBasicProperties(turnContext.activity) };
                    console.log('Message: ' + JSON.stringify(deleteMsgEvent));
                    collection.insertOne(deleteMsgEvent);
                    // this._telemetryClient.trackEvent(deleteMsgEvent);
                });

                // Create the message for an Update Activity and send to a Document Database.
                turnContext.onUpdateActivity(async (turnContext, activity, nextUpdate) => {
                    await nextUpdate();
                    // Create the update activity's document object.
                    const msgUpdateEvent = { name: this.botMsgUpdateEvent, properties: this.fillUpdateEventProperties(turnContext.activity) };
                    console.log('Message: ' + JSON.stringify(msgUpdateEvent));
                    collection.insertOne(msgUpdateEvent);
                    // this._telemetryClient.trackEvent(msgUpdateEvent);
                });

                // After registering the onSendActivities, onDeleteActivity, and onUpdateActivity handlers, send the msgReceivedEvent to Mongo
                console.log('Message: ' + JSON.stringify(msgReceivedEvent));
                collection.insertOne(msgReceivedEvent);

            } catch (err) {
                console.log(err.stack);
            }
        }
        // All middleware must call next to continue the middleware pipeline and reach the bot's central logic.
        // Otherwise the bot will stop processing activities after reaching a middleware that does not call `next()`.
        await next();
    }

    /**
     * These properties are logged in document object when a new message is received from the user.
     * @param {Activity} activity The Receive activity whose properties are placed into the Application Insights custom event.
     * @returns An object that is sent as "Properties" to Application Insights via the trackEvent method for the BotMessageReceived Message.
     */
    fillReceiveEventProperties(activity) {
        const properties = Object.assign({}, this.createBasicProperties(activity), { Locale: activity.locale });
        // For some customers, logging user name within Application Insights might be an issue so we have provided a config setting to enable this feature
        if (this.logUserName && activity.from.name) {
            properties.FromName = activity.from.name;
        }
        // For some customers, logging the utterances within Application Insights might be an issue so we have provided a config setting to enable this feature
        if (this.logOriginalMessage && activity.text) {
            properties.TextProperty = activity.text;
        }
        return properties;
    }

    /**
     * These properties are logged in the document object when a response message is sent by the Bot to the user.
     * @param {Activity} activity The Send activity whose properties are placed into the Application Insights custom event.
     * @returns An object that is sent as "Properties" to Applications Insights via the trackEvent method for the BotMessageSend Message.
     */
    fillSendEventProperties(activity) {
        const properties = Object.assign({}, this.createBasicProperties(activity), { Locale: activity.locale });
        // For some customers, logging user name within Application Insights might be an issue so have provided a config setting to enable this feature.
        if (this.logUserName && !!activity.recipient.name) {
            properties.RecipientName = activity.recipient.name;
        }
        // For some customers, logging the utterances within Application Insights might be an issue so have provided a config setting to enable this feature.
        if (this.logOriginalMessage && !!activity.text) {
            properties.Text = activity.text;
        }
        return properties;
    }

    /**
     * These properties are logged in the document object when an activity message is updated by the Bot.
     * @param {Activity} activity The Update activity whose properties are placed into the Application Insights custom event.
     * @returns An object that is sent as "Properties" to Application Insights via the trackEvent method for the BotMessageUpdate Message.
     */
    fillUpdateEventProperties(activity) {
        const properties = Object.assign({}, this.createBasicProperties(activity), { Locale: activity.locale });
        // For some customers, logging the utterances within Application Insights might be an issue so have provided a config setting to enable this feature.
        if (this.logOriginalMessage && !!activity.text) {
            properties.Text = activity.text;
        }
        return properties;
    }

    /**
     * Returns a basic property bag that contains the following data:
     * - ActivityId: The incoming activity's id.
     * - Channel: The id of the channel, e.g. 'directline', 'facebook', 'msteams'.
     * - ConversationId: The unique identifier for a conversation.
     * - ConversationName: The name of a conversation.
     * - RecipientId: The unique id of the recipient.
     * @param {Activity} activity The activity whose properties are placed into the Application Insights custom event.
     */
    createBasicProperties(activity) {
        const properties = {
            ActivityId: activity.id,
            Channel: activity.channelId,
            ConversationId: activity.conversation.id,
            ConversationName: activity.conversation.name,
            RecipientId: activity.recipient
        };
        return properties;
    }
}

module.exports.MongoDBMiddleware = MongoDBMiddleware;