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

function Page_Loaded() {
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
        addUrlParameters("Parametr: " + key + ", Hodnota: " + value);
    });
}

function addAgentStatus(text){
    var ul = document.getElementById("agent-state-history");
    var li = document.createElement("li");
    li.setAttribute('id',text);
    li.setAttribute('class','list-group-item');
    li.appendChild(document.createTextNode(text));
    ul.appendChild(li);
}

function addAgentNotification(text){
    var ul = document.getElementById("agent-notification-history");
    var li = document.createElement("li");
    li.setAttribute('id',text);
    li.setAttribute('class','list-group-item');
    li.appendChild(document.createTextNode(text));
    ul.appendChild(li);
}

function addUrlParameters(text){
    var ul = document.getElementById("url-params-history");
    var li = document.createElement("li");
    li.setAttribute('class','list-group-item');
    li.appendChild(document.createTextNode(text));
    ul.appendChild(li);
}

$(document).ready(() => {
	client.loginImplicitGrant(clientId, redirectUri)
		.then(() => {

			// Get authenticated user's info
			return usersApi.getUsersMe();
		})
		.then((userMe) => {
			console.log('userMe: ', userMe);
      logApiEvent('Přihlášen agent ' + userMe.name + ' [' + userMe.username + ']');
			me = userMe;

			return notificationsApi.postNotificationsChannels();
		})
		.then((channel) => {
			console.log('channel: ', channel);
			notificationChannel = channel;

			// Set up web socket
			webSocket = new WebSocket(notificationChannel.connectUri);
			webSocket.onmessage = handleNotification;

			// Subscribe to authenticated user's conversations
			conversationsTopic = 'v2.users.' + me.id + '.conversations';
			const ConversationBody = [ { id: conversationsTopic } ];
			notificationsApi.putNotificationsChannelSubscriptions(notificationChannel.id, ConversationBody);
      
      presenceTopic = 'v2.users.' + me.id + '.presence';
			const presenceBody = [ { id: presenceTopic } ];
			notificationsApi.putNotificationsChannelSubscriptions(notificationChannel.id, presenceBody);
		})
		.then((topicSubscriptions) => {
			console.log('topicSubscriptions: ', topicSubscriptions);
		})
		.catch((err) => console.error(err));
});

function logApiEvent(logText) {
  addAgentNotification(logText);
}

function handleNotification(message) {
	// Parse notification string to a JSON object
	const notification = JSON.parse(message.data);

	// Discard unwanted notifications
	if (notification.topicName.toLowerCase() === 'channel.metadata') {
		console.info('Ignoring metadata: ', notification);
	} else if (notification.topicName.toLowerCase() !== conversationsTopic.toLowerCase()) {
		console.warn('Unknown notification: ', notification);
	} else if (notification.topicName.toLowerCase()endsWith('.presence')) {
		console.warn('Agent status notification: ', notification);
    logApiEvent('Agent je aktuálně ve stavu ' + notification.presenceDefinition.systemPresence);
		return;
	} else {
		console.debug('Notification: ', notification);
    if (isConversationDisconnected(notification.eventBody))
		  logApiEvent('Interakce ukončena');
  	else
      logApiEvent('Interakce probíhá');
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

function changeAgentState(state){
  BootstrapDialog.show({
      message: 'Změna stavu zaslána ' + state,
      buttons: [{
          label: 'Uzavřít',
          action: function(dialogItself){
              dialogItself.close();
          }
      }]
  });
}

function makeCallFromWebApp(phoneNumber){

conversationsApi.postConversationsCalls(body).then(function(result){
  console.log("call placed successfully");
  console.log(result);
}).catch(function(error){
  console.error("Error Placing call", error);
});


}

var lifecycleStatusMessageTitle = 'CRM Demo';
var lifecycleStatusMessageId = 'CrmDemo-statusMsg';
  
jQuery(function () {

      let myClientApp = new window.purecloud.apps.ClientApp({pcEnvironmentQueryParam: 'env'});

      addAgentNotification('Client SDK version: ' + window.purecloud.apps.ClientApp.version);
      addAgentNotification(window.purecloud.apps.ClientApp.about());
    
      myClientApp.lifecycle.addBootstrapListener(() => {
          logLifecycleEvent('Lifecycle Event: bootstrap', true);

          // Simulating bootstrap delay of 500ms
          window.setTimeout(() => {
              myClientApp.lifecycle.bootstrapped();

              myClientApp.alerting.showToastPopup(
                  lifecycleStatusMessageTitle,
                  'Webová prezentace načtena', {
                      id: lifecycleStatusMessageId,
                      type: 'success'
                  }
              );
          }, 500);
      });

      function onAppFocus () {
          logLifecycleEvent('Lifecycle Event: focus', true);

          myClientApp.alerting.showToastPopup(
              lifecycleStatusMessageTitle,
              'Webová prezentace na popředí', {
                  id: lifecycleStatusMessageId
              }
          );
      }
      myClientApp.lifecycle.addFocusListener(onAppFocus);

      function onAppBlur () {
          logLifecycleEvent('Lifecycle Event: blur', true);

          myClientApp.alerting.showToastPopup(
              lifecycleStatusMessageTitle,
              'Webová prezentace na pozadí', {
                  id: lifecycleStatusMessageId
              }
          );
      }
      myClientApp.lifecycle.addBlurListener(onAppBlur);

      myClientApp.lifecycle.addStopListener(() => {
          logLifecycleEvent('Lifecycle Event: stop', true);

          // Clean up other, persistent listeners
          myClientApp.lifecycle.removeFocusListener(onAppFocus);
          myClientApp.lifecycle.removeBlurListener(onAppBlur);

          // Simulating delay of 500ms
          window.setTimeout(() => {
              myClientApp.lifecycle.stopped();

              myClientApp.alerting.showToastPopup(
                  lifecycleStatusMessageTitle,
                  'Webová prezentace zastavena', {
                      id: lifecycleStatusMessageId,
                      type: 'error',
                      showCloseButton: true
                  }
              );
          }, 500);
      });

      function logLifecycleEvent(logText, incommingEvent) {
          addAgentNotification(incommingEvent + ': ' + logText);
      }
  });