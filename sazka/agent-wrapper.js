const clientId = '5012f6b6-f441-4ef7-8642-841b376a8bfe';
const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;
const conversationsApi = new platformClient.ConversationsApi();
const usersApi = new platformClient.UsersApi();

const redirectUri = 'http://localhost:5500/index.html';

// Set PureCloud settings
client.setEnvironment('mypurecloud.de');
client.setPersistSettings(true, 'agent-helper-app');

const queryString = window.location.search;
console.log(queryString);
const urlParams = new URLSearchParams(queryString);

document.addEventListener("DOMContentLoaded", function(){
    console.debug("starting custom app");
    client.loginImplicitGrant(clientId, redirectUri)
        .then(() => {
            return usersApi.getUsersMe({'expand': ["presence"]});
        })
        .then((userMe) => {
            console.log('userMe: ', userMe);
            me = userMe;
            if (urlParams.has('conversationId') && urlParams.has('communicationId')){
                let communicationId = urlParams.get('communicationId');
                let conversationId = urlParams.get('conversationId');
                console.log("conversationId: " + conversationId);
                console.log("communicationId: " + communicationId);

                let messageContent = "Dobrý den, jmenuji se " + me.name + " a budu se snažit Vám dnes pomoci.";
                let body = { "textBody": messageContent }; // Object | Message
                let opts = { 
                'useNormalizedMessage': true // Boolean | If true, response removes deprecated fields (textBody, media, stickers)
                };

                conversationsApi.postConversationsMessageCommunicationMessages(conversationId, communicationId, body, opts)
                    .then((data) => {
                        console.log(`postConversationsMessageCommunicationMessages success! data: ${JSON.stringify(data, null, 2)}`);
                        const pageMessage = document.getElementById("message");
                        pageMessage.innerText = "Welcome message sent: " + messageContent;
                    })
                    .catch((err) => {
                        console.log('There was a failure calling postConversationsMessageCommunicationMessages');
                        const pageMessage = document.getElementById("message");
                        pageMessage.innerText = "Welcome message failed";
                        console.error(err);
                    });
            }
        })
        .catch((err) => {
            console.error(err)
        });
});