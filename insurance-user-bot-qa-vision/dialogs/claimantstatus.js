const { ComponentDialog, WaterfallDialog, TextPrompt, ConfirmPrompt, ChoicePrompt } = require('botbuilder-dialogs');
const gccREST = require('../middleware/gccREST');

//Dialog IDs
const CLAIMANT_DIALOG = 'ClaimStatus';

//Prompt IDs
const STATUSUPDATE_CONFIRM = 'statusUpdateConfirmPrompt';
const STATUSUPDATE_TEXT = 'statusUpdateTextPrompt';
const STATUS_CLOSING_CHOICE = 'statusClosingChoicePrompt';

/**
 *  Use a Waterflow dialog to model multi-turn conversation flow
 *  Use custom prompts to validate user input
 *
 * @param {Object} conversationState convo state
 * @param {Object} userProfileAccessor property accessor for user state
 * @param {Object} topMenu Instance of the TopMenu Dialog
 */
class ClaimantStatus extends ComponentDialog
{
    static get Name() { return CLAIMANT_DIALOG; }

    constructor(conversationState, userProfileAccessor, topMenu) {
        super(CLAIMANT_DIALOG);

        this.addDialog(new WaterfallDialog(CLAIMANT_DIALOG, [
            this.handleClaimStatusRequest.bind(this),
            this.handleClaimUpdateRequest.bind(this),
            this.handleClaimUpdateClosingChoiceStep.bind(this),
            this.handleClaimClosingChoiceStep.bind(this)
        ]));

        this.addDialog(topMenu);
        this.addDialog(new ChoicePrompt(STATUS_CLOSING_CHOICE));
        this.addDialog(new ChoicePrompt(STATUSUPDATE_CONFIRM));
        this.addDialog(new TextPrompt(STATUSUPDATE_TEXT));

        this.topMenu = topMenu;
        this.userProfileAccessor = userProfileAccessor;
        this.conversationState = conversationState;
    }

    /**
     * Waterfall Dialog step functions.
     * 
     * Send the Claim Status and then ask if there are any updates to make to the Claim.
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async handleClaimStatusRequest(step)
    {
        let userProfile = await this.userProfileAccessor.get(step.context);

        let responseString = await gccREST.getClaimStatus(userProfile.userName);

        //console.log('Response String: ', responseString);
        if (responseString !== '') {
            await step.context.sendActivity(responseString);
            const statusUpdateChoices = [ 'Yes', 'No' ];
            const statusUpdatePromptText = 'Is there any new information you’d like for me to provide to your representative?';
            return await step.prompt(STATUSUPDATE_CONFIRM, statusUpdatePromptText, statusUpdateChoices);
        } else {
            await step.context.sendActivity('No Claim Status Data was returned from GCC');
            const statusClosingPromptText = 'What would you like to do next, please choose from the list of tabs below?'
            const statusClosingChoices = ['Main Menu', 'Say Goodbye'];
            return await step.prompt(STATUS_CLOSING_CHOICE, statusClosingPromptText, statusClosingChoices);
        }
    }

    /**
     * Waterfall Dialog step functions.
     * 
     * Handle the result from the Status Update Confirmation Prompt
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async handleClaimUpdateRequest(step) 
    {
        //console.log('Step Result Value: ' + step.result.value);
        switch (step.result.value)
        {
            case 'Yes':
                return await step.prompt(STATUSUPDATE_TEXT, 'What information would you like for me to provide to your representative?');
            case 'Main Menu':
                return await step.replaceDialog(this.topMenu.id);
            case 'Say Goodbye':
                await step.context.sendActivity('Goodbye');
                return await step.endDialog();
            default:
                const statusClosingPromptText = 'What would you like to do next, please choose from the list of tabs below?'
                const statusClosingChoices = ['Main Menu', 'Say Goodbye'];
                return await step.prompt(STATUS_CLOSING_CHOICE, statusClosingPromptText, statusClosingChoices);
        }
    }
    
    /**
     * Waterfall Dialog step functions.
     *
     * Checking the value being returned from the user, whether it is a Dialog choice or an update to their Claim
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async handleClaimUpdateClosingChoiceStep(step)
    {
        let userProfile = await this.userProfileAccessor.get(step.context);
        switch (step.result.value)
        {
            case 'Main Menu':
                return await step.replaceDialog(this.topMenu.id);
            case 'Say Goodbye':
                await step.context.sendActivity('Goodbye');
                return await step.endDialog();
            default:
                let dataString = JSON.stringify({
                    "userId": userProfile.userName,
                    "data": step.result
                });
                let responseString = await gccREST.postClaimUpdate(dataString);
                if (responseString === 1) {
                    await step.context.sendActivity('You claim update has been posted successfully.');
                    const statusClosingPromptText ='What would you like to do next, please choose from the list of tabs below?'
                    const statusClosingChoices = ['Main Menu', 'Say Goodbye'];
                    return await step.prompt(STATUS_CLOSING_CHOICE, statusClosingPromptText, statusClosingChoices);
                } else {
                    await step.context.sendActivity('There was a problem posting your claim update. You will need to try again.');
                    return await step.replaceDialog(this.Name);
                }
        }
    }

    /**
     * Waterfall Dialog step functions.
     *
     * Checking the value being returned from the user, and then processing the right dialog action
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async handleClaimClosingChoiceStep(step) 
    {
        switch (step.result.value)
        {
            case 'Main Menu':
                return await step.replaceDialog(this.topMenu.id);
            case 'Say Goodbye':
                await step.context.sendActivity('Goodbye');
                return await step.endDialog();
        }
    }
}

exports.ClaimantStatus = ClaimantStatus;