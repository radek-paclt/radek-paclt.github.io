const clientId = '5012f6b6-f441-4ef7-8642-841b376a8bfe';
const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;
const conversationsApi = new platformClient.ConversationsApi();
const usersApi = new platformClient.UsersApi();
const notificationsApi = new platformClient.NotificationsApi();

var redirectUri = window.location.href.split('?')[0];

// Set PureCloud settings
client.setEnvironment('mypurecloud.de');
client.setPersistSettings(true, 'agent-helper-app');

const queryString = window.location.search;
console.log(queryString);
const urlParams = new URLSearchParams(queryString);

let conversationId, communicationId, welcomeMessage, executedConversationId = "";

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
                communicationId = urlParams.get('communicationId');
                conversationId = urlParams.get('conversationId');
                console.log("conversationId: " + conversationId);
                console.log("communicationId: " + communicationId);
            }

            conversationsApi.getConversations()
            .then((data) => {
                console.log(`getConversations success! data: ${JSON.stringify(data, null, 2)}`);
                if(data.entities.length > 0){
                    for(const entity of data.entities){
                        if (entity.id === conversationId && executedConversationId !== conversationId)
                        {
                            executedConversationId = conversationId;
                            sendWelcomeMessage(entity);
                        }
                    }
                }
            })
            .catch((err) => {
                console.log('There was a failure calling getConversations');
                console.error(err);
            });
            
            return notificationsApi.postNotificationsChannels();
        }).then((channel) => {
			console.log('channel: ', channel);
			notificationChannel = channel;

			// Set up web socket
			webSocket = new WebSocket(notificationChannel.connectUri);
			webSocket.onmessage = handleNotification;

			// Subscribe to authenticated user's conversations
            //v2.users.{id}.conversations.messages
			conversationsTopic = 'v2.users.' + me.id + '.conversations.messages';

			const NotificationBody = [ { id: conversationsTopic } ];
			return notificationsApi.putNotificationsChannelSubscriptions(notificationChannel.id, NotificationBody);
		})
        .catch((err) => {
            console.error(err)
        });
});

function handleNotification(message) {
	// Parse notification string to a JSON object
	const notification = JSON.parse(message.data);

	// Discard unwanted notifications
	if (notification.topicName.toLowerCase() === 'channel.metadata') {
		console.info('Ignoring metadata: ', notification);
        return;
	} else if (notification.topicName.toLowerCase() === conversationsTopic.toLowerCase()) {
		console.debug('Notification: ', notification);
        if (isConversationDisconnected(notification.eventBody)) {
            return;
        } else {
            console.log(`${notification.eventBody.id} = ${conversationId} = ${executedConversationId}`);
            if (notification.eventBody.id === conversationId && executedConversationId !== conversationId)
            {
                executedConversationId = conversationId;
                sendWelcomeMessage(notification.eventBody);
            }
        }
        return;
    } else {
        console.warn('Unknown notification: ', notification);
    return;
  }
}

function sendWelcomeMessage(entity){
    for (let participant of entity.participants) {
        if (participant.attributes && participant.attributes.hasOwnProperty("Agent Message")){
            welcomeMessage = participant.attributes['Agent Message'];
        }
    };

    if (conversationId !== '' && communicationId !== '' && welcomeMessage !== ''){
        let messageContent = welcomeMessage.replace("{{nickname}}",me.name);

        let body = { "textBody": messageContent };
        let opts = { 
            'useNormalizedMessage': true
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
}

function isConversationDisconnected(conversation) {
	let isConnected = false;
	conversation.participants.some((participant) => {
		if (participant.state === 'connected') {
			isConnected = true;
			return true;
		}
	});

	return !isConnected;
}