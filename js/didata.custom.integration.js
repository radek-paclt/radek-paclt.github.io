const clientId = 'c3853eb7-e2f3-402b-95d3-22491e80c996';
const redirectUri = window.location.href;

// Set purecloud objects
const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;
const conversationsApi = new platformClient.ConversationsApi();
const notificationsApi = new platformClient.NotificationsApi();
const usersApi = new platformClient.UsersApi();
const presenceApi = new platformClient.PresenceApi();

// Set PureCloud settings
client.setEnvironment('mypurecloud.de');
client.setPersistSettings(true, 'crm_test_app');

// Set local vars
let CONVERSATION_LIST_TEMPLATE = null;
let conversationList = {};
let me, webSocket, conversationsTopic, presenceTopic, notificationChannel, activeCallNumber;

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
			return usersApi.getUsersMe({'expand': ["presence"]});
		})
		.then((userMe) => {
			console.log('userMe: ', userMe);
      logApiEvent('Přihlášen agent ' + userMe.name + ' [' + userMe.username + ']');
			me = userMe;
      
      addAgentStatus('Aktuální stav agenta: ' + me.presence.presenceDefinition.systemPresence.toUpperCase());

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
      presenceTopic = 'v2.users.' + me.id + '.presence';

			const NotificationBody = [ { id: conversationsTopic }, { id: presenceTopic } ];
			return notificationsApi.putNotificationsChannelSubscriptions(notificationChannel.id, NotificationBody);
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
    return;
	} else if (notification.topicName.toLowerCase() === presenceTopic.toLowerCase()) {
		console.log('Agent status notification: ', notification);
    addAgentStatus('Agent je aktuálně ve stavu ' + notification.eventBody.presenceDefinition.systemPresence);
    return;
	} else if (notification.topicName.toLowerCase() === conversationsTopic.toLowerCase()) {
		console.debug('Notification: ', notification);
    if (isConversationDisconnected(notification.eventBody)) {
      activeCallNumber = '';
		  logApiEvent('Interakce ukončena');
    } else {
      var callDirection = '';
      var callNumber = '';

      for (let participant of conversation.participants) {
        if (participant.state === 'connected' && (participant.purpose === 'external' || participant.purpose === 'customer')){
          callDirection = participant.direction;
          callNumber = participant.address;
          break;  
        }
    	};
      
      if (callNumber !== activeCallNumber){
        if (callDirection === 'inbound') {
            logApiEvent('Příchozí hovor z čísla ' + callNumber);
        } else {
            logApiEvent('Odchozí hovor na číslo ' + callNumber);
        }
        activeCallNumber = callNumber;
      }
    }
    return;
	} else {
		console.warn('Unknown notification: ', notification);
    return;
  }
}

function logConversation(conversation) {
	
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
  
  presenceApi.getPresencedefinitions().then(function(presenceData){
    for (var x=0; x < Object.keys(presenceData.entities).length; x++){
        var presence = presenceData.entities[x];

        if(presence.systemPresence.toUpperCase() === state.toUpperCase()){
          console.log("found requested presence " + presence.id);
          var requestedPresence = presence.id;
          var newPresence = {
              "presenceDefinition" : {
                  "id": requestedPresence
              }
          };
        
          presenceApi.patchUserPresence(me.id, 'PURECLOUD', newPresence).then((data) => {
              console.log(`patchUserPresence success! data: ${JSON.stringify(data, null, 2)}`);
            })
            .catch((err) => {
              console.log('There was a failure calling patchUserPresence');
              console.error(err);
            });
          break;
        }
    }
  });
  
  
  logApiEvent('Požádáno o změnu stavu agenta: ' + state.toUpperCase());
  console.log("Change agent state requested");
}

function makeCallFromWebApp(){
  var phoneNum = document.getElementById("makeCallPhoneNumber");

  var body = {
    phoneNumber: phoneNum.value
  };

  conversationsApi.postConversationsCalls(body).then(function(result){
    console.log("call placed successfully");
    console.log(result);
    logApiEvent('Hovor vytočen');
  }).catch(function(error){
    console.error("Error Placing call", error);
    logApiEvent('Chyba při vytáčení hovoru: ' + error);
  });
}

var lifecycleStatusMessageTitle = 'CRM Demo';
var lifecycleStatusMessageId = 'CrmDemo-statusMsg';
  
jQuery(function () {

      let myClientApp = new window.purecloud.apps.ClientApp({pcEnvironmentQueryParam: 'env'});

      addAgentNotification('Client SDK version: ' + window.purecloud.apps.ClientApp.version);
      addAgentNotification(window.purecloud.apps.ClientApp.about());
    
      myClientApp.lifecycle.addBootstrapListener(() => {

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
