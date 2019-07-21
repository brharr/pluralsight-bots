# pluralsight-bots
Repository for the Conversational AI application that is discussed within the Pluralsight course "Implementing a Microsoft AI Bot Framework Solution"

**DISCLAIMER**: I cannot guarantee that this code will work as Microsoft updates the Bot Framework SDK. If you should find a bug, please file an Issue against the Repo and I will do my best to resolve the problem.

This Repo contains all of the code necessary to deploy the same Bot that was developed and deployed within the course as well as all reference files, specifically:

* luisfiles - Contains LuDown and JSON Output of the LUIS Applications
* output - Contains the example API Output files
* pluralsight-bot - Contains all of the source code to run the Bot Locally or in Azure
* SampleComics.json - This is the JSON used to create a CosmosDB that the Azure Search Index was built off of.
* pluralsight.bot - Bot file used for the Bot Framework Emulator to connect to your bot and LUIS application.

If you are working with the code in your local development environment, then you will need to create your own .env file to store the required environment variables. An example of this file can be seen below:

    microsoftAppID=<Production Bot Channel App ID>
    microsoftAppKey=<Production Bot Channel Registration Key>
    auditFunction=0 <Used to turn on Cosmos based Auditing>
    useMSAZUREmsi=0 <Used to determine if your are using MSI or standard SP User>
    vaultName=<Name of your Azure Key Vault>
    keyvaultsp=<Application ID of your SP>
    keyvaultspkey=<Key value for your SP>
    tenant=<ID of your AAD tenant>
    luisEndpoint=<LUIS Endpoint>
    searchIndex=<Name of Search Index>
    searchEndpoint=<URL from Azure Search>

If you are doing everything local, then you will need to add the following values to your .env file: 

searchKey, luisAuthor, luisENAppID, luisESAppID, auditConnString

## Additional Resources

All of the available links that were provided as addition documentation for the modules can be found in a list below:

