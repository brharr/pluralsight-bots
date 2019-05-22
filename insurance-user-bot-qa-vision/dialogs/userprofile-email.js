const { ComponentDialog, WaterfallDialog, TextPrompt, ConfirmPrompt, ChoicePrompt } = require('botbuilder-dialogs');
const gccREST = require('../middleware/gccREST');

//Dialog ID
const UPEMAIL_DIALOG = 'upEmail';

//Prompt IDs
const EMAIL_TEXT = 'emailTextPrompt';
const EMAIL_CONFIRM = 'emailConfirmPrompt';
const EMAIL_CLOSING_CHOICE = 'emailClosingChoicePrompt';

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
class UserProfileEmail extends ComponentDialog
{
    static get Name() { return UPEMAIL_DIALOG; }

    constructor(conversationState, userProfileAccessor, conversationAccessor, topMenu, userProfileMenu) {
        super(UPEMAIL_DIALOG);

        // Add control flow dialogs
        this.addDialog(new WaterfallDialog(UPEMAIL_DIALOG, [
            this.emailTextStep.bind(this),
            this.emailConfirmStep.bind(this),
            this.emailClosingChoiceStep.bind(this),
            this.handleEmailClosingChoiceStep.bind(this)
        ]));

        // Add Dialogs needed
        this.addDialog(userProfileMenu);
        this.addDialog(topMenu);
        
        // Add all Prompts needed through the conversation
        this.addDialog(new TextPrompt(EMAIL_TEXT));
        this.addDialog(new ChoicePrompt(EMAIL_CLOSING_CHOICE));
        this.addDialog(new ConfirmPrompt(EMAIL_CONFIRM));

        this.topMenu = topMenu;
        this.userProfileMenu = userProfileMenu;
        this.conversationState = conversationState;
        this.userProfileAccessor = userProfileAccessor;
        this.conversationAccessor = conversationAccessor;
    }

    /**
     * Waterfall Dialog step functions.
     *
     * Ask the user for the email address that should be stored for the User
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async emailTextStep (step) {
        // To provide the most realistic conversation, we should provide a different message depending
        // on the activity being performed
        return await step.prompt(EMAIL_TEXT, 'What is the new email address xxx.xxx@xxx.xxx?');
    }

    /**
     * Waterfall Dialog step functions.
     *
     * Validate that the Email is in the correct format and then ask for confirmation
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async emailConfirmStep (step) {
        let emailProfile = await this.conversationAccessor.get(step.context, {
            email: '',
            UserId: 0
        });
        const Email_REGEXP = /^([a-z0-9_\.-]+)@([\da-z\.-]+)\.([a-z\.]{2,6})$/ig
        let validEmail = Email_REGEXP.exec(step.result);

        if (validEmail) {
            emailProfile.email = step.result;
            await this.conversationAccessor.set(step.context, emailProfile);
            await step.context.sendActivity('Thank You');
            await step.context.sendActivity('Before we make the necessary modification to your Email address, I would like you to validate the information your provided');
            return await step.prompt(EMAIL_CONFIRM, `You would like me to change your email address with the following: ${emailProfile.email}. Correct?`);
        } else {
            await step.context.sendActivity("I'm sorry, but you did not provide the email address in the correct format xxx.xxx@xxx.xxx.");
            await step.context.sendActivity('I will need to start this process over again.');
            return await step.replaceDialog(UPEMAIL_DIALOG);
        }
    }

    /**
     * Waterfall Dialog step functions.
     *
     * Send the email information to the UserProfile API and then send a menu for what to do next
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async emailClosingChoiceStep (step) {
        let emailProfile = await this.conversationAccessor.get(step.context);
        let userProfile = await this.userProfileAccessor.get(step.context);
        emailProfile.UserId = userProfile.userName;
        
        if (step.result) {
            await step.context.sendActivity('Thank You');
            await step.context.sendActivity('I will submit the changes now and let you know when it has finished.');
            
            // Create variable for REST POST options
            let dataString = JSON.stringify({ 
                "email": emailProfile.email,
                "UserId": emailProfile.UserId
            });
            let responseString = await gccREST.postEmailProfile(dataString);

            if (responseString === 1) {
                const emailClosingPromptText = 'The information has been saved successfully. What would you like to do next, please choose from the list of tabs below?'
                const emailClosingChoices = ['Main Menu', 'User Profile', 'Say Goodbye'];
                return await step.prompt(EMAIL_CLOSING_CHOICE, emailClosingPromptText, emailClosingChoices);
            }
            else {
                await step.context.sendActivity('There was a problem with the updating of your profile. Please try again.');
                return await step.replaceDialog(UPEMAIL_DIALOG);
            }
        }
        else {
            return await step.replaceDialog(UPEMAIL_DIALOG);
        }
    }

    /**
     * Waterfall Dialog step functions.
     *
     * Take the response from the user and then send them to the right dialog
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async handleEmailClosingChoiceStep(step) {
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

exports.UPEmail = UserProfileEmail;
