const { ComponentDialog, WaterfallDialog, TextPrompt, ChoicePrompt } = require('botbuilder-dialogs');
const { QnAMaker } = require('botbuilder-ai');
const { gennaQnAMaker } = require('../middleware/gennaQnAMaker');

//Dialog IDs
const FAQ_DIALOG = 'FAQ';

//Prompt IDs
const FAQ_TEXT = 'faqTextPrompt';
const FAQ_CLOSING_CHOICE = 'faqClosingChoicePrompt';

const AUDIT_CONFIGURATION = (process.env.auditFunction || 0);

/**
 *  Use a Waterflow dialog to model multi-turn conversation flow
 *  Use custom prompts to validate user input
 *  Store conversation and user state
 *
 * @param {Object} qnaSettings json Object containing information for connecting to a QnA Maker KB
 * @param {Object} conversationState convo state
 * @param {Object} userProfileAccessor property accessor for user state
 * @param {Object} topMenu Instance of the TopMenu Dialog
 */
class FAQ extends ComponentDialog
{
    static get Name() { return FAQ_DIALOG; }

    constructor(qnaSettings, conversationState, userProfileAccessor, topMenu) {
        super(FAQ_DIALOG);
        if (AUDIT_CONFIGURATION == 1) {
            this.QnA = new gennaQnAMaker(qnaSettings, {}, true, true);
        }
        else {
            this.QnA = new QnAMaker(qnaSettings, {});
        }

        // Add control flow dialogs
        this.addDialog(new WaterfallDialog(FAQ_DIALOG, [
            this.questionStep.bind(this),
            this.handleQnAResponseStep.bind(this),
            this.handleClosingMenu.bind(this)
        ]));

        this.topMenu = topMenu;
        this.addDialog(topMenu);
        
        this.addDialog(new TextPrompt(FAQ_TEXT));
        this.addDialog(new ChoicePrompt(FAQ_CLOSING_CHOICE));

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
    async questionStep(step)
    {
        return await step.prompt(FAQ_TEXT, 'Please ask your question.');
    }

    /**
     * Waterfall Dialog step functions.
     *
     * Take the question that was provided by the user and send to the Q&A Maker KB to get an answer.
     * Then return a new Menu of choices to ask the user what to do net. 
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async handleQnAResponseStep(step)
    {
        let qnaResults = null;
        if (AUDIT_CONFIGURATION == 1)
            qnaResults = await this.QnA.generateAnswer(step);
        else
            qnaResults = await this.QnA.generateAnswer(step.result);

        //console.log('Number of Results: ' + qnaResults.length);
        if (qnaResults && qnaResults.length > 0) {
            await step.context.sendActivity(qnaResults[0].answer);

            const faqClosingPromptText = 'What would you like to do next, please choose one of the options below.'
            const faqClosingChoices = ['Main Menu', 'Ask Genna', 'Say Goodbye'];
            return await step.prompt(FAQ_CLOSING_CHOICE, faqClosingPromptText, faqClosingChoices);
        } else {
            await step.context.sendActivity(`I don't have an answer to your question. Please try again.`);
            return await step.replaceDialog(FAQ_DIALOG);
        }
    }  

     /**
     * Waterfall Dialog step functions.
     *
     * Handle the response from the user to send the user to the next dialog.
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async handleClosingMenu(step)
    {
        switch (step.result.value)
        {
            case 'Main Menu':
                return await step.replaceDialog(this.topMenu.id);
            case 'Ask Genna':
                return await step.replaceDialog(FAQ_DIALOG);
            case 'Say Goodbye':
                await step.context.sendActivity('Goodbye');
                return await step.endDialog();
        }
    }
}

exports.FAQ = FAQ;