const { ComponentDialog, WaterfallDialog, TextPrompt, ConfirmPrompt, ChoicePrompt } = require('botbuilder-dialogs');
const gccREST = require('../middleware/gccREST');
const Utils = require('../middleware/utils');

//Dialog ID
const UPADDRESS_DIALOG = 'upAddress';

//Prompt IDs
const ADDRESS_STREETTEXT = 'addressStreetTextPrompt';
const ADDRESS_CITYTEXT = 'addressCityTextPrompt';
const ADDRESS_STATETEXT = 'addressStateTextPrompt';
const ADDRESS_ZIPTEXT = 'addressZipTextPrompt';
const ADDRESS_CONFIRM = 'addressConfirmPrompt';
const ADDRESS_CLOSING_CHOICE = 'addressClosingChoicePrompt';

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
class Address extends ComponentDialog
{
    static get Name() { return UPADDRESS_DIALOG; }

    constructor(conversationState, userProfileAccessor, conversationAccessor, topMenu, userProfileMenu) {
        super(UPADDRESS_DIALOG);

        // Add control flow dialogs
        this.addDialog(new WaterfallDialog(UPADDRESS_DIALOG, [
            this.addressStreetTextStep.bind(this),
            this.cityTextStep.bind(this),
            this.stateTextStep.bind(this),
            this.zipTextStep.bind(this),
            this.addressConfirmStep.bind(this),
            this.addressClosingChoiceStep.bind(this),
            this.handleAddressClosingChoiceStep.bind(this)
        ]));

        // Add Dialogs needed
        this.addDialog(userProfileMenu);
        this.addDialog(topMenu);
        
        // Add all Prompts needed through the conversation
        this.addDialog(new TextPrompt(ADDRESS_STREETTEXT));
        this.addDialog(new TextPrompt(ADDRESS_CITYTEXT));
        this.addDialog(new TextPrompt(ADDRESS_STATETEXT));
        this.addDialog(new TextPrompt(ADDRESS_ZIPTEXT));
        this.addDialog(new ChoicePrompt(ADDRESS_CLOSING_CHOICE));
        this.addDialog(new ConfirmPrompt(ADDRESS_CONFIRM));

        this.topMenu = topMenu;
        this.userProfileMenu = userProfileMenu;
        this.conversationState = conversationState;
        this.userProfileAccessor = userProfileAccessor;
        this.conversationAccessor = conversationAccessor;
    }

    /**
     * Waterfall Dialog step functions.
     *
     * Ask the user what is the new street for the address
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async addressStreetTextStep(step)
    {
        return await step.prompt(ADDRESS_STREETTEXT, `What is your new street address?`);
    }

    /**
     * Waterfall Dialog step functions.
     *
     * Store the street information and ask the user for the city 
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async cityTextStep(step)
    {
        let addressProfile = await this.conversationAccessor.get(step.context, {
            street: '',
            city: '',
            state: '',
            zip: '',
            UserId: 0
        });
        addressProfile.street = step.result;
        await this.conversationAccessor.set(step.context, addressProfile);
        await step.context.sendActivity('Thank You');
        return await step.prompt(ADDRESS_CITYTEXT, `What is the City for this address?`);
    }
    
    /**
     * Waterfall Dialog step functions.
     *
     * Store the city information and ask the user for the state 
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async stateTextStep(step)
    {
        let addressProfile = await this.conversationAccessor.get(step.context);
        addressProfile.city = step.result;
        await this.conversationAccessor.set(step.context, addressProfile);
        await step.context.sendActivity('Thank You');
        return await step.prompt(ADDRESS_STATETEXT, `What is the State for this address?`);
    }

    /**
     * Waterfall Dialog step functions.
     *
     * Store the state information and ask the user for the zip 
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async zipTextStep(step)
    {
        let addressProfile = await this.conversationAccessor.get(step.context);
        addressProfile.state = step.result;
        await this.conversationAccessor.set(step.context, addressProfile);
        await step.context.sendActivity('Thank You');
        return await step.prompt(ADDRESS_ZIPTEXT, `What is the Zip Code for this address?`);
    }

    /**
     * Waterfall Dialog step functions.
     *
     * Process the address information to validate it is in the correct format and then ask for confirmation
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async addressConfirmStep(step)
    {
        let addressProfile = await this.conversationAccessor.get(step.context);
        addressProfile.zip = step.result;
            
        await this.conversationAccessor.set(step.context, addressProfile);
        await step.context.sendActivity('Before we make the necessary modification to your Address, I would like you to validate the information your provided');
        return await step.prompt(ADDRESS_CONFIRM, `Please confirm you'd like to update your address to ${addressProfile.street}, ${addressProfile.city}, ${addressProfile.state} ${addressProfile.zip}. Is that correct?`);
    }        
    
    /**
     * Waterfall Dialog step functions.
     *
     * Send the Address inforamtion to the UserProfile API and then send menu for where to go next
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async addressClosingChoiceStep(step)
    {
        let addressProfile = await this.conversationAccessor.get(step.context);
        let userProfile = await this.userProfileAccessor.get(step.context);
        addressProfile.UserId = userProfile.userName;

        if (step.result) {
            await step.context.sendActivity('Thank You');
            await step.context.sendActivity('I will submit the changes now and let you know when it has happened');
            
            // Create variable for REST POST options
            let dataString = JSON.stringify({ 
                "street": addressProfile.street,
                "city": addressProfile.city,
                "state": addressProfile.state,
                "zip": addressProfile.zip,
                "UserId": addressProfile.UserId
            });
            let responseString = await gccREST.postAddressProfile(dataString);

            if (responseString === 1) {
                const addressClosingPromptText = 'The information has been saved successfully. What would you like to do next, please choose from the list of tabs below?'
                const addressClosingChoices = ['Main Menu', 'User Profile', 'Say Goodbye'];
                return await step.prompt(ADDRESS_CLOSING_CHOICE, addressClosingPromptText, addressClosingChoices);
            }
            else {
                await step.context.sendActivity('There was a problem with the updating of your profile. Please try again.');
                return await step.replaceDialog(UPADDRESS_DIALOG);
            }
        }
        else {
            return await step.replaceDialog(UPADDRESS_DIALOG);
        }
    }
    
    /**
     * Waterfall Dialog step functions.
     *
     * Handle the menu choice and then send the user to the new dialog
     *
     * @param {WaterfallStepContext} step contextual information for the current step being executed
     */
    async handleAddressClosingChoiceStep(step)
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

exports.UPAddress = Address;
