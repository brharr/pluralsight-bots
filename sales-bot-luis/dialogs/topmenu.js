const { ComponentDialog, WaterfallDialog, TextPrompt } = require('botbuilder-dialogs');
const { LuisRecognizer } = require('botbuilder-ai');

//Dialog IDs
const TOPMENU_DIALOG = 'topMenu';

//Prompt IDs
const TOPMENU_TEXT = 'tmTextPrompt';

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

    constructor(luisApplication, luisApplicationES, luisPredictionOptions, conversationState, userProfileAccessor, conversationAccessor) {
        super(TOPMENU_DIALOG);

        // Add control flow dialogs
        this.addDialog(new WaterfallDialog(TOPMENU_DIALOG, [
            this.promptStep.bind(this),
            this.handleResponseStep.bind(this)
        ]));

        this.topMenu = this;
        this.luisRecognizer = new LuisRecognizer(luisApplication, luisPredictionOptions, true);
        this.luisRecognizerES = new LuisRecognizer(luisApplicationES, luisPredictionOptions, true);
        
        this.addDialog(new TextPrompt(TOPMENU_TEXT));

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
    async promptStep(step)
    {
        return await step.prompt(TOPMENU_TEXT, "Please tell me what it is that you would like to do.");
    }

    /**
     * Waterfall Dialog step functions.
     *
     * Using a choice prompt to prompt the user for which function they would like to perform.
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async handleResponseStep(step)
    {
        //let credentials = new CognitiveServicesCredentials(this.bingSpellApplication.key);
        //let spellCheckApiClient = new Language.SpellCheckAPIClient(credentials);
        let userProfile = await this.userProfileAccessor.get(step.context);

        try {
            if (userProfile.language ==='es') {
                const luisResultsES = await this.luisRecognizerES.recognize(step.context);

                // Since the LuisRecognizer was configured to include the raw results, get the `topScoringIntent` as specified by LUIS.
                const topIntentES = luisResultsES.luisResult.topScoringIntent;
                return await step.context.sendActivity("LUIS Intent: " + topIntentES.intent);
            } else {
                const luisResults = await this.luisRecognizer.recognize(step.context);
                
                // Since the LuisRecognizer was configured to include the raw results, get the `topScoringIntent` as specified by LUIS.
                const topIntent = luisResults.luisResult.topScoringIntent;
                return await step.context.sendActivity("LUIS Intent: " + topIntent.intent);
            }
        } catch (error)
        {
            console.log("Error: " + error);
        }
    }
}
exports.TopMenu = TopMenu;