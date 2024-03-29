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

document.addEventListener("DOMContentLoaded", function(){
    console.debug("starting custom app");
    client.loginImplicitGrant(clientId, redirectUri)
        .then(() => {
            return usersApi.getUsersMe({'expand': ["presence"]});
        })
        .then((userMe) => {
            console.log('userMe: ', userMe);
            me = userMe;         
            return notificationsApi.postNotificationsChannels();
        }).then((channel) => {
			console.log('channel: ', channel);
			notificationChannel = channel;

			// Set up web socket
			webSocket = new WebSocket(notificationChannel.connectUri);
			webSocket.onmessage = handleNotification;

			// Subscribe to authenticated user's conversations
            //v2.users.{id}.conversations.messages
			conversationsTopic = 'v2.users.' + me.id + '.conversations';

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
        const welcomeSent = localStorage.getItem("welcome-chatbot-" + notification.eventBody.id);
        if (welcomeSent === notification.eventBody.id)
            return;

        if (isConversationDisconnected(notification.eventBody)) {
            return;
        } else {
            localStorage.setItem("welcome-chatbot-" + notification.eventBody.id, notification.eventBody.id);
            executedConversationId = notification.eventBody.id;
            sendWelcomeMessage(notification.eventBody);
        }
        return;
    } else {
        console.warn('Unknown notification: ', notification);
    return;
  }
}

function sendWelcomeMessage(entity){
    var welcomeMessage = "";
    var conversationId = entity.id;
    var communicationId = "";
    for (let participant of entity.participants) {
        if (participant.purpose === 'agent'){
            communicationId = participant.messages[0].id;
        }

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
                pageMessage.innerText = "Uvítáno";
            })
            .catch((err) => {
                console.log('There was a failure calling postConversationsMessageCommunicationMessages');
                const pageMessage = document.getElementById("message");
                pageMessage.innerText = "CHYBA";
                console.error(err);
            });
    }
}

function isConversationDisconnected(conversation) {
	let isConnected = false;
	conversation.participants.some((participant) => {
		if (participant.messages[0].state === 'connected') {
			isConnected = true;
			return true;
		}
	});

	return !isConnected;
}