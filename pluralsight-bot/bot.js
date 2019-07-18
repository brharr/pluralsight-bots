// Import required Bot Framework classes.
const { ActivityTypes } = require('botbuilder');
const { DialogSet, DialogTurnStatus } = require('botbuilder-dialogs');
const { TopMenu } = require('./dialogs/topmenu');

//Property names
const USERPROFILE = 'UserProfileAccessor';
const CONVO_PROPERTIES = 'conversationProperty';

class ComicBot {
    /**
     *
     * @param {UserState} User state to persist boolean flag to indicate if the bot had 
     * already welcomed the user as well as all user profile information
     */
    constructor(luisApplication, luisApplicationES, luisPredictionOptions, azureSearchConfig, conversationState, userState) {
        // Creates a new user profile property accessor.
        this.userProfileAccessor = userState.createProperty(USERPROFILE);
        this.dialogState = conversationState.createProperty('dialogState');
        this.conversationAccessor = conversationState.createProperty(CONVO_PROPERTIES);
        
        this.userState = userState;
        this.conversationState = conversationState;
        this.luisApplication = luisApplication;
        this.luisApplicationES = luisApplicationES;
        this.luisPredictionOptions = luisPredictionOptions;
        this.searchConfig = azureSearchConfig;

        // Create top-level dialog(s)
        this.dialogs = new DialogSet(this.dialogState);
        this.dialogs.add(new TopMenu(this.luisApplication, this.luisApplicationES, this.luisPredictionOptions, this.searchConfig, conversationState, this.userProfileAccessor, this.conversationAccessor));
    }

    async onTurn(turnContext) {
        // Create a dialog context
        const dc = await this.dialogs.createContext(turnContext);

        if (turnContext.activity.type === ActivityTypes.Message) {

            // Continue the current dialog
            const dialogResult = await dc.continueDialog();
            // console.log(`Dialog Continue Result: ${JSON.stringify(dialogResult)}`);
            
            // Still need to get the language code from the teams object
            let userProfile = await this.userProfileAccessor.get(turnContext, {
                userName: 'brharr',
                language: 'en'
            });

            //console.log("Turn Activity Name: " + turnContext.activity.from.name);
            if (turnContext.activity.from.name !== 'User' && turnContext.activity.from.name !== 'You')
            {
                userProfile.userName = turnContext.activity.from.id;
            }
            await this.userProfileAccessor.set(turnContext, userProfile);

            if (!dc.context.responded) {
                switch (dialogResult.status) {
                    case DialogTurnStatus.empty:
                        await dc.beginDialog(TopMenu.Name);
                        break;
                    case DialogTurnStatus.waiting:
                        // The active dialog is waiting for a response from the user, so do nothing
                        break;
                    case DialogTurnStatus.complete:
                        await dc.endDialog();
                        break;
                    default:
                        await dc.cancelAllDialogs();
                        break;
                }
            }
        // This application will only ever use the WebChat channel, so therefore only one user will be added at a time.
        // If Genex should ever switch to a Teams, Skype, or Slack type channel, then this logic will need to be modified.
        } else if (turnContext.activity.type === ActivityTypes.ConversationUpdate) {
            // Send greeting when users are added to the conversation.
            if (turnContext.activity && turnContext.activity.membersAdded) {
                
                let conversationMembers = turnContext.activity.membersAdded;
                //console.log("Members Added: " + JSON.stringify(turnContext.activity.membersAdded));
                //console.log('ConversationMemberID: ' + conversationMembers[0].id);
                //console.log('Recipient ID: ' + turnContext.activity.recipient.id);

                // Greet anyone that was not the recipient of this message.
                // The bot is the recipient of all events from the channel, including all ConversationUpdate-type activities
                // turnContext.activity.membersAdded !== turnContext.activity.recipient.id indicates a user was added to the conversation 
                // For this application we can always assumet that only one user was added each time because of the channel that is being used.
                if (conversationMembers[0].id !== turnContext.activity.recipient.id) {
                    
                    await dc.context.sendActivity(`Hi! I’m Brian, the Comic Sales bot`);
                }
            }
        }
        else {
            // If the user has not sent a message, we want to echo back what type of event it is. 
            //return turnContext.sendActivity(`[${turnContext.activity.type} event detected]`);
        }
        // Make sure to persist state at the end of a turn.
        await this.userState.saveChanges(turnContext);
        await this.conversationState.saveChanges(turnContext);
    }
}
module.exports.ComicBot = ComicBot;