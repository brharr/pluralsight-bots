const { ComponentDialog, WaterfallDialog, ChoicePrompt } = require('botbuilder-dialogs');
const { UPPhone } = require('./userprofile-phone');
const { UPEmail } = require('./userprofile-email');
const { UPAddress } = require('./userprofile-address');

//Dialog IDs
const USERPROFILEMENU_DIALOG = 'userProfileMenu';

//Prompt IDs
const USERPROFILEMENU_CHOICE = 'upChoicePrompt';

/**
 *  Use a Waterflow dialog to model multi-turn conversation flow
 *  Use custom prompts to validate user input
 *  Store conversation and user state
 *
 * @param {Object} conversationState convo state
 * @param {Object} userProfileAccessor property accessor for user state
 * @param {Object} userState user state
 * @param {Object} topMenu Instance of the TopMenu Dialog
 */
class UserProfileMenu extends ComponentDialog
{
    static get Name() { return USERPROFILEMENU_DIALOG; }

    constructor(conversationState, userProfileAccessor, conversationAccessor, topMenu) {
        super(USERPROFILEMENU_DIALOG);

        // Add control flow dialogs
        this.addDialog(new WaterfallDialog(USERPROFILEMENU_DIALOG, [
            this.menuPromptStep.bind(this),
            this.handleMenuOptionStep.bind(this)
        ]));

        // Add Dialogs needed
        this.addDialog(new UPPhone(conversationState, userProfileAccessor, conversationAccessor, topMenu, this));
        this.addDialog(new UPEmail(conversationState, userProfileAccessor, conversationAccessor, topMenu, this));
        this.addDialog(new UPAddress(conversationState, userProfileAccessor, conversationAccessor, topMenu, this));
        
        // Add all Prompts needed through the conversation
        this.addDialog(new ChoicePrompt(USERPROFILEMENU_CHOICE));

        this.conversationAccessor = conversationAccessor;
        this.userProfileAccessor = userProfileAccessor;
        this.conversationState = conversationState;
    }

    /**
     * Waterfall Dialog step functions.
     *
     * Using a choice prompt to prompt the user for which function they would like to perform.
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async menuPromptStep(step)
    {
        const userProfilePrompt = 'Within your User Profile, please choose which pieces of information you would like to update from the list of tabs below:';
        const userProfileChoices = ['Address','Phone','Email'];
        return await step.prompt(USERPROFILEMENU_CHOICE, userProfilePrompt, userProfileChoices);
    }

    /**
     * Handle the result from the UserProfile Choice prompt to determine which dialog to move the user to.
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async handleMenuOptionStep(step)
    {
        switch (step.result.value) {
            case 'Address':
                return await step.replaceDialog(UPAddress.Name);
            case 'Phone':
                return await step.replaceDialog(UPPhone.Name);
            case 'Email': 
                return await step.replaceDialog(UPEmail.Name);
            default: 
                await step.context.sendActivity('Unfortunately, I did not receive a valid response, so I am terminating this chat session. \n Please try again.');
                return await step.endDialog();
        }
    }
}
exports.UserProfileMenu = UserProfileMenu;