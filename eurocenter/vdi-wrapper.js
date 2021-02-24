const clientId = '89333897-d43e-428e-ac31-e973c14bfb1d';
const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;
const conversationsApi = new platformClient.ConversationsApi();
const notificationsApi = new platformClient.NotificationsApi();
const usersApi = new platformClient.UsersApi();
const presenceApi = new platformClient.PresenceApi();

const redirectUri = 'https://radek-paclt.github.io/eurocenter/vdi-wrapper.html';

// Set PureCloud settings
client.setEnvironment('mypurecloud.de');
client.setPersistSettings(true, 'vdi-helper-app');

// Set local vars
//let CONVERSATION_LIST_TEMPLATE = null;
let customInitalizationDone = false;
//let conversationList = {};
let me, webSocket, conversationsTopic, userCallsTopic, presenceTopic, notificationChannel, activeCallNumber, agentPart, customerPart, conversationId;

function LoadGenesysCloud(){
  console.debug("loading genesys cloud");
  client.loginImplicitGrant(clientId, redirectUri)
		.then(() => {

			// Get authenticated user's info
			return usersApi.getUsersMe({'expand': ["presence"]});
		})
		.then((userMe) => {
			console.log('userMe: ', userMe);
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
      userCallsTopic = 'v2.users.' + me.id + '.conversations.calls'; 
      presenceTopic = 'v2.users.' + me.id + '.presence';

			const NotificationBody = [ { id: conversationsTopic }, { id: presenceTopic }, { id: userCallsTopic } ];
			return notificationsApi.putNotificationsChannelSubscriptions(notificationChannel.id, NotificationBody);
		})
		.then((topicSubscriptions) => {
			console.log('topicSubscriptions: ', topicSubscriptions);
		})
		.catch((err) => {
      console.err("Error during initializing custom part");
      console.error(err)
    });
  } 


function handleNotification(message) {
	// Parse notification string to a JSON object
	const notification = JSON.parse(message.data);

  console.info('Processing my message: ', notification);

	// Discard unwanted notifications
	if (notification.topicName.toLowerCase() === 'channel.metadata') {
		console.info('Ignoring metadata: ', notification);
    return;
	} else if (notification.topicName.toLowerCase() === presenceTopic.toLowerCase()) {
		console.log('Agent status notification: ', notification);
    console.log('Agent in state ' + notification.eventBody.presenceDefinition.systemPresence);
    if (notification.eventBody.presenceDefinition.systemPresence !== 'OFFLINE' && !customInitalizationDone)
      customInitializationProcess();
    return;
	} else if (notification.topicName.toLowerCase() === userCallsTopic.toLowerCase()) {
    console.debug('Call notification: ', notification);

    if (isConversationDisconnected(notification.eventBody)) {
      activeCallNumber = '';
      $("#NewCallRingingWindow").hide();
    } else {
      var callDirection = '';
      var callNumber = '';

      for (let participant of notification.eventBody.participants) {
        if (participant.state === 'connected' && (participant.purpose === 'external' || participant.purpose === 'customer')){
          callDirection = participant.direction;
          callNumber = participant.address;
            $("#NewCallRingingWindow").hide();
        } else{
            $("#NewCallRingingWindow").show();
        }
        if ((participant.purpose == "user") || (participant.purpose == "agent")) {
          if (participant.user.id == me.id) {
            agentPart = participant;
          }
          else
            customerPart = participant;
        }
        if (participant.name === 'eurocenter_infoline_vdi_init' && participant.state === 'terminated'){
          $("#initializationModalCenter").modal("hide") ;
        }
    	};
      
      conversationId = notification.eventBody.id;

      if (callNumber !== activeCallNumber && callNumber !== ''){
        if (callDirection === 'inbound') {
          console.debug('Incomming call from number ' + callNumber);
        } else {
          console.debug('Outbound call to number ' + callNumber);
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

function customInitializationProcess(){
  console.debug("custom initialization started");
  customInitalizationDone = false;
  $("#initializationModalCenter").modal("show") ;
  makeCall("EuroCenter_Infoline_VDI_Init@localhost");
}

function answerCall() {
  let body = {
    "state": "CONNECTED"
  };
  console.log("Answering call with conversationId: " + conversationId + " and participantId: " + agentPart.id);
  conversationsApi.patchConversationsCallParticipant(conversationId, agentPart.id, body)
    .then((data) => {
      console.log('patchConversationsCallParticipant success! data: ' + JSON.stringify(data, null, 2));
      console.log("answered call with conversationId " + conversationId + " and participantId: " + agentPart.id);
    }).catch((err) => {
      console.log('There was a failure calling patchConversationsCallParticipant');
      console.error(err);
    });
}

function hangupCall() {
  let body = {
    "state": "DISCONNECTED"
  };
  console.log("Releasing call with conversationId: " + conversationId);
  conversationsApi.patchConversationsCall(conversationId, body)
    .then((data) => {
      console.log('patchConversationsCall success! data: ' + JSON.stringify(data, null, 2));
      console.log("released call with conversationId " + conversationId);
    })
    .catch((err) => {
      console.log('There was a failure calling postConversationsCall');
      console.error(err);
    });
}

function makeCall(phoneNumber){
    var phoneField = document.getElementById("phone");
    let body = {
        "phoneNumber": phoneNumber
    };
    conversationsApi.postConversationsCalls(body)
        .then((data) => {
             console.log('postConversationsCall success! data: ' + JSON.stringify(data, null, 2));
             conversationId = data.id;
             console.log("conversationId: " + conversationId + ", started at " + new Date().toISOString());
        })
        .catch((err) => {
            console.log('There was a failure calling postConversationsCall');
            console.error(err);
        });
}

$(document).ready(function(){
  $("#CustomMenuButton").click(function(){
    if ($("#CustomMenuIcon").hasClass("fa-bars")){
      $("#CustomMenuIcon").removeClass("fa-bars");
      $("#CustomMenuIcon").addClass("fa-angle-double-up");
      $("#GenesysCloudFrame").css("top","50px");

    } else{
      $("#CustomMenuIcon").removeClass("fa-angle-double-up");
      $("#CustomMenuIcon").addClass("fa-bars");
      $("#GenesysCloudFrame").css("top","0px");
      
    }
  });

  console.debug("starting custom part");
  LoadGenesysCloud();

});