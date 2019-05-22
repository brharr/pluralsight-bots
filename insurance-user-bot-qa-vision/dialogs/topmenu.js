const { ComponentDialog, WaterfallDialog, ChoicePrompt } = require('botbuilder-dialogs');
const { UserProfileMenu } = require('./userprofilemenu');
const { FAQ } = require('./faq');
const { ClaimantStatus } = require('./claimantstatus');

//Dialog IDs
const TOPMENU_DIALOG = 'topMenu';

//Prompt IDs
const TOPMENU_CHOICE = 'tmChoicePrompt';

/**
 *  Use a Waterflow dialog to model multi-turn conversation flow
 *  Use custom prompts to validate user input
 *
 * @param {Object} conversationState convo state
 * @param {Object} userProfileAccessor property accessor for user state
 * @param {Object} userState user state
 */
class TopMenu extends ComponentDialog
{
    static get Name() { return TOPMENU_DIALOG; }

    constructor(qnaSettings, conversationState, userProfileAccessor, conversationAccessor) {
        super(TOPMENU_DIALOG);

        // Add control flow dialogs
        this.addDialog(new WaterfallDialog(TOPMENU_DIALOG, [
            this.menuPromptStep.bind(this),
            this.handleMenuOptionStep.bind(this)
        ]));

        this.topMenu = this;
        this.userProfileMenu = new UserProfileMenu(conversationState, userProfileAccessor, conversationAccessor, this);
        this.FAQ = new FAQ(qnaSettings, conversationState, userProfileAccessor, this);
        this.claimantStatus = new ClaimantStatus(conversationState, userProfileAccessor, this);

        this.addDialog(this.FAQ);
        this.addDialog(this.userProfileMenu);
        this.addDialog(this.claimantStatus);
        
        this.addDialog(new ChoicePrompt(TOPMENU_CHOICE));

        this.conversationAccessor = conversationAccessor;
        this.userProfileAccessor = userProfileAccessor;
        this.conversationState = conversationState;
        this.qnaSettings = qnaSettings;
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
        let userProfile = await this.userProfileAccessor.get(step.context);

        //await dc.context.sendActivity(`Because of your role as a ${userProfile.userRole},`);
        if (userProfile.userRole === 'Claimant')
            await step.context.sendActivity(`Within this Bot, you will be able to update your User Profile, get Claim Status and pose questions to Genna.`);
        else
            await step.context.sendActivity(`Within this Bot, you will be able to pose questions to Genna.`);

        const topPromptText = 'Please let me know how I can assist you by clicking on one of the tabs below:';
        const userTopChoices = ['User Profile', 'Ask Genna', 'Claim Status'];
        const custTopChoices = ['Ask Genna'];

        if (userProfile.userRole === 'Claimant') {
            return await step.prompt(TOPMENU_CHOICE, topPromptText, userTopChoices);
        }
        else if (userProfile.userRole === 'Customer') {
            return await step.prompt(TOPMENU_CHOICE, topPromptText, custTopChoices);
        }
    }

    /**
     * Handle the result from the TopMenu Choice prompt to determine which dialog to move the user to.
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async handleMenuOptionStep(step)
    {
        switch (step.result.value)
        {
            case 'User Profile':
                return await step.replaceDialog(UserProfileMenu.Name);
            case 'Ask Genna':
                return await step.replaceDialog(FAQ.Name);
            case 'Smart Score':
                return await step.context.sendActivity('Smart Score Dialog');
            case 'Claim Status':
                return await step.replaceDialog(ClaimantStatus.Name);
            default:
                await step.context.sendActivity('Unfortunately, I did not receive a valid response, so I am terminating this chat session. \n Please try again.');
                return await step.endDialog();
        }
    }
}
exports.TopMenu = TopMenu;