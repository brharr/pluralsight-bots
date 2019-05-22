const { ComponentDialog, WaterfallDialog, TextPrompt, ConfirmPrompt, ChoicePrompt } = require('botbuilder-dialogs');
const Util = require('../middleware/utils');
const gccREST = require('../middleware/gccREST');

//Dialog ID
const UPPHONE_DIALOG = 'upPhone';

//Prompt IDs
const PHONETYPE_CHOICE = 'phoneTypeChoicePrompt';
const PHONEACTION_CHOICE = 'phoneActionChoicePrompt';
const PHONENUMBER_TEXT = 'phoneNumberTextPrompt';
const PHONE_CONFIRM = 'phoneConfirmPrompt';
const PHONE_CLOSING_CHOICE = 'phoneClosingChoicePrompt';

/**
 *  Use a Waterflow dialog to model multi-turn conversation flow
 *  Use custom prompts to validate user input
 *  Store conversation and user state
 *
 * @param {Object} conversationState convo state
 * @param {Object} userProfileAccessor property accessor for user state
 * @param {Object} userState user state
 * @param {Object} topMenu Instance of the TopMenu Dialog Object
 * @param {Object} userProfileMenu Instance of the UserProfileMenu Dialog Object
 */
class UserProfilePhone extends ComponentDialog
{
    static get Name() { return UPPHONE_DIALOG; }

    constructor(conversationState, userProfileAccessor, conversationAccessor, topMenu, userProfileMenu) {
        super(UPPHONE_DIALOG);

        // Add control flow dialogs
        this.addDialog(new WaterfallDialog(UPPHONE_DIALOG, [
            this.phoneTypeChoiceStep.bind(this),
            this.phoneActionChoiceStep.bind(this),
            this.phoneNumberTextStep.bind(this),
            this.phoneConfirmStep.bind(this),
            this.phoneClosingChoiceStep.bind(this),
            this.handlePhoneClosingChoiceStep.bind(this)
        ]));

        // Add Dialogs needed
        this.addDialog(userProfileMenu);
        this.addDialog(topMenu);
        
        // Add all Prompts needed through the conversation
        this.addDialog(new ChoicePrompt(PHONETYPE_CHOICE));
        this.addDialog(new ChoicePrompt(PHONEACTION_CHOICE));
        this.addDialog(new TextPrompt(PHONENUMBER_TEXT));
        this.addDialog(new ChoicePrompt(PHONE_CLOSING_CHOICE));
        this.addDialog(new ConfirmPrompt(PHONE_CONFIRM));

        this.topMenu = topMenu;
        this.userProfileMenu = userProfileMenu;
        this.conversationState = conversationState;
        this.userProfileAccessor = userProfileAccessor;
        this.conversationAccessor = conversationAccessor;
    }

    /**
     * Waterfall Dialog step functions.
     *
     * Using a choice prompt to prompt the user for which phone type they would like to add, update, or delete
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async phoneTypeChoiceStep(step)
    {
        const phonePrompt = `Which of your phone numbers would you like to work with?`;
        const phoneChoices = ['Home','Mobile'];
        return await step.prompt(PHONETYPE_CHOICE, phonePrompt, phoneChoices);
    }

    /**
     * Store the result in a Conversation State object and then ask for which action to perform on the Phone number
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async phoneActionChoiceStep(step)
    {
        let phoneProfile = await this.conversationAccessor.get(step.context, {
            phoneType: '',
            phoneAction: '',
            phoneNumber: '',
            UserId: 0
        });
        phoneProfile.phoneType = step.result.value;
        await step.context.sendActivity('Thank You');
        const activityPrompt = `What action would you like to perform on this number?`;
        const activityChoices = ['Add', 'Update', 'Delete'];
        await this.conversationAccessor.set(step.context, phoneProfile);
        return await step.prompt(PHONEACTION_CHOICE, activityPrompt, activityChoices);
    }

    /**
     * Store the result from the Phone Action Choice prompt and then ask for the phone number
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async phoneNumberTextStep(step)
    {
        let phoneProfile = await this.conversationAccessor.get(step.context);
        phoneProfile.phoneAction = step.result.value;
        await step.context.sendActivity('Thank You');
        // To provide the most realistic conversation, we should provide a different message depending
        // on the activity being performed
        await this.conversationAccessor.set(step.context, phoneProfile);
        switch (phoneProfile.phoneAction) {
            case 'Add':
                return step.prompt(PHONENUMBER_TEXT, `What is your new ${phoneProfile.phoneType} number XXX-XXX-XXXX?`);
            case 'Update':
                return step.prompt(PHONENUMBER_TEXT, `What is the updated ${phoneProfile.phoneType} number XXX-XXX-XXXX?`);
            case 'Delete':
                return step.prompt(PHONENUMBER_TEXT, 'Please provide the number xxx-xxx-xxxx that should be deleted for validation.');
        }
    }

    /**
     * Store the result from the Phone Number Text and then ask for confirmation of all information
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async phoneConfirmStep(step)
    {
        let phoneProfile = await this.conversationAccessor.get(step.context);
        const Phone_REGEXP = /^([0-9]{3})-([0-9]{3})-([0-9]{4})$/ig
        let validPhone = Phone_REGEXP.exec(step.result);

        if (validPhone) {
            // Need to trim the dashes out first.
            let numberOnly = Util.cleanNumber(step.result);
            //console.log(`Phone Number to Send to the API: ${numberOnly}`);

            phoneProfile.phoneNumber = numberOnly;
            await this.conversationAccessor.set(step.context, phoneProfile);
            await step.context.sendActivity('Thank You');
            await step.context.sendActivity('Before we make the necessary modification to your Phone number, I would like you to validate the information your provided');
            return await step.prompt(PHONE_CONFIRM, `You would like me to ${phoneProfile.phoneAction} your ${phoneProfile.phoneType} Number: ${step.result}. Correct?`);
        } else {
            await step.context.sendActivity("I'm sorry, but you did not provide the phone number in the correct format XXX-XXX-XXXX.");
            await step.context.sendActivity('I will need to start this User Profile update process over again.');
            return await step.replaceDialog(UPPHONE_DIALOG);
        }
    }

    /**
     * Send all information to the UserProfile API and then send a menu to ask where the user will go next
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async phoneClosingChoiceStep(step)
    {
        let phoneProfile = await this.conversationAccessor.get(step.context);
        let userProfile = await this.userProfileAccessor.get(step.context);
        phoneProfile.UserId = userProfile.userName;

        if (step.result) {
            await step.context.sendActivity('Thank You');
            await step.context.sendActivity('I will submit the changes now and let you know when it has finished.');
            
            let dataString = JSON.stringify(phoneProfile);
            console.log('Data Beign Sent to gccREST: ' + dataString);
            let responseString = await gccREST.postPhoneProfile(dataString);

            if (responseString === 1) { 
                const phoneClosingPromptText = 'The information has been saved successfully. What would you like to do next, please choose from the list of tabs below?'
                const phoneClosingChoices = ['Main Menu', 'User Profile', 'Say Goodbye'];
                return await step.prompt(PHONE_CLOSING_CHOICE, phoneClosingPromptText, phoneClosingChoices);
            }
            else {
                await step.context.sendActivity('There was a problem with the updating of your profile. Please try again.');
                return await step.replaceDialog(UPPHONE_DIALOG);
            }
        }
        else {
            return await step.replaceDialog(UPPHONE_DIALOG);
        }
    }

    /**
     * Handle the result from the Menu Choice prompt to determine which dialog to move the user to.
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async handlePhoneClosingChoiceStep(step)
    {
        switch (step.result.value)
        {
            case 'Main Menu':
                return await step.replaceDialog(this.topMenu.id);
            case 'User Profile':
                return await step.replaceDialog(this.userProfileMenu.id);
            case 'Say Goodbye':
                await step.context.sendActivity('Goodbye');
                return await step.endDialog();
        }
    }
}
exports.UPPhone = UserProfilePhone;