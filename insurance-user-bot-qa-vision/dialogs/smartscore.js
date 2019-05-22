const { ComponentDialog, WaterfallDialog, ChoicePrompt } = require('botbuilder-dialogs');
const { FAQ } = require('./faq');
const { TopMenu } = require('./topmenu');

//Dialog IDs
const SMARTSCORE_DIALOG = 'smartScore';

//Prompt IDs
const PARAMETERS_TEXT = 'tmChoicePrompt';

/**
 *  Use a Waterflow dialog to model multi-turn conversation flow
 *  Use custom prompts to validate user input
 *
 * @param {Object} conversationState convo state
 * @param {Object} userProfileAccessor property accessor for user state
 * @param {Object} userState user state
 */
class SmartScore extends ComponentDialog
{
    static get Name() { return SMARTSCORE_DIALOG; }

    constructor(conversationState, userProfileAccessor, conversationAccessor, topMenu) {
        super(SMARTSCORE_DIALOG);

        // Add control flow dialogs
        this.addDialog(new WaterfallDialog(SMARTSCORE_DIALOG, [
            this.requestParametersStep.bind(this),
            this.handleSmartScoreStep.bind(this)
        ]));

        this.topMenu = this;

        this.addDialog(this.topMenu);
        
        this.addDialog(new TextPrompt(PARAMETERSTEXT_PROMPT));

        this.conversationAccessor = conversationAccessor;
        this.userProfileAccessor = userProfileAccessor;
        this.conversationState = conversationState;
    }

    /**
     * Waterfall Dialog step functions.
     *
     * Ask the user for all the parameters needed to process a Claim Score
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async requestParametersStep(step) {
        await step.context.sendActivity('In order to return a valid score for your request, I will need the following pieces of information: (Age, State, Primary ICD Code, Secondary ICD Code, Last Date Worked, Today’s Date, & Current Salary).');
        return await step.prompt(PARAMETERS_TEXT, 'Please provide each piece of information separated by a pipe (|)');
    }

    /**
     * Waterfall Dialog step functions.
     *
     * Ask the user for all the parameters needed to process a Claim Score
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async handleSmartScoreStep(step) {
        
    }
}