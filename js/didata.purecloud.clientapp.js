const clientId = 'c3853eb7-e2f3-402b-95d3-22491e80c996';
const redirectUri = window.location.href;

// Set purecloud objects
const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;
const conversationsApi = new platformClient.ConversationsApi();
const notificationsApi = new platformClient.NotificationsApi();
const usersApi = new platformClient.UsersApi();

// Set PureCloud settings
client.setEnvironment('mypurecloud.de');
client.setPersistSettings(true, 'crm_test_app');

// Set local vars
let CONVERSATION_LIST_TEMPLATE = null;
let conversationList = {};
let me, webSocket, conversationsTopic, notificationChannel;

// jQuery calls this when the DOM is available
$(document).ready(() => {
	// Authenticate with PureCloud
	client.loginImplicitGrant(clientId, redirectUri)
		.then(() => {
			console.log('Logged in');
      logApiEvent('Agent logged in');

			// Get authenticated user's info
			return usersApi.getUsersMe();
		})
		.then((userMe) => {
			console.log('userMe: ', userMe);
      logApiEvent(JSON.stringify(userMe));
			me = userMe;

			// Create notification channel
			return notificationsApi.postNotificationsChannels();
		})
		.then((channel) => {
			console.log('channel: ', channel);
      logApiEvent(JSON.stringify(channel));
			notificationChannel = channel;

			// Set up web socket
			webSocket = new WebSocket(notificationChannel.connectUri);
			webSocket.onmessage = handleNotification;

			// Subscribe to authenticated user's conversations
			conversationsTopic = 'v2.users.' + me.id + '.conversations';
			const body = [ { id: conversationsTopic } ];
			return notificationsApi.putNotificationsChannelSubscriptions(notificationChannel.id, body);
		})
		.then((topicSubscriptions) => {
			console.log('topicSubscriptions: ', topicSubscriptions);
		})
		.catch((err) => console.error(err));
});

function logApiEvent(logText) {
          $tgt = jQuery('.lifecycle-events .log')
          var newItem = $('<li>' + logText + '</li>');
          $tgt.prepend(newItem);
}

// Handle incoming PureCloud notification from WebSocket
function handleNotification(message) {
	// Parse notification string to a JSON object
	const notification = JSON.parse(message.data);

	// Discard unwanted notifications
	if (notification.topicName.toLowerCase() === 'channel.metadata') {
		// Heartbeat
		console.info('Ignoring metadata: ', notification);
		return;
	} else if (notification.topicName.toLowerCase() !== conversationsTopic.toLowerCase()) {
		// Unexpected topic
		console.warn('Unknown notification: ', notification);
		return;
	} else {
		console.debug('Conversation notification: ', notification);
    if (isConversationDisconnected(notification.eventBody))
		  logApiEvent('interaction finished');;
  	else
      logConversation(notification.eventBody);
	}
}

function logConversation(conversation) {
	conversation.participants.forEach((participant) => {
    logApiEvent(participant.calls[0].self.addressNormalized + '/' + participant.calls[0].direction + '/' + participant.calls[0].state);
	});
}

function isConversationDisconnected(conversation) {
	let isConnected = false;
	conversation.participants.some((participant) => {
		if (participant.state !== 'disconnected') {
			isConnected = true;
			return true;
		}
	});

	return !isConnected;
}
