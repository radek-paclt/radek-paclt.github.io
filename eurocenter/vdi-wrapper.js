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
//let conversationList = {}; conversationsTopic
let me, webSocket, userCallsTopic, presenceTopic, aggregatesTopic, notificationChannel, activeCallNumber;
let agentPart, customerPart, conversationId;

String.prototype.toMMSS = function () {
  var sec_num = parseInt(this, 10); // don't forget the second param
  var hours   = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
  var seconds = sec_num - (hours * 3600) - (minutes * 60);

  if (hours   < 10) {hours   = "0"+hours;}
  if (minutes < 10) {minutes = "0"+minutes;}
  if (seconds < 10) {seconds = "0"+seconds;}
  return minutes+':'+seconds;
}

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
			//conversationsTopic = 'v2.users.' + me.id + '.conversations';
      userCallsTopic = 'v2.users.' + me.id + '.conversations.calls'; 
      presenceTopic = 'v2.users.' + me.id + '.presence';
      //v2.analytics.users.6951bad8-09a7-43da-8bdc-c5a408219951.aggregates
      aggregatesTopic = 'v2.analytics.users.' + me.id + '.aggregates';

			const NotificationBody = [ { id: presenceTopic }, { id: userCallsTopic }, { id: aggregatesTopic } ];
      //removed { id: conversationsTopic },
			return notificationsApi.putNotificationsChannelSubscriptions(notificationChannel.id, NotificationBody);
		})
		.then((topicSubscriptions) => {
			console.log('topicSubscriptions: ', topicSubscriptions);
      if (me.presence.presenceDefinition.systemPresence.toUpperCase() !== 'OFFLINE'  && !customInitalizationDone){
        customInitializationProcess();
      }
		})
		.catch((err) => {
      console.err("Error during initializing custom part");
      console.error(err)
    });
  } 

function aggregatedDataForAgent(message){
  for (let data of message.data){
    for (let metric of data.metrics){
      if (metric.metric === 'tAlert'){
        //AgentStatInbound
        $("#AgentStatInbound").text(metric.stats.count);
      } else if (metric.metric === 'tDialing'){
        //AgentStatOutbound
        $("#AgentStatOutbound").text(metric.stats.count);
      } else if (metric.metric === 'tAnswered'){
        
      } else if (metric.metric === 'tTalk'){
        
      } else if (metric.metric === 'tSystemPresence' && metric.qualifier === 'AVAILABLE'){
        //AgentStatTotalAvailable
        $("#AgentStatTotalAvailable").text(String(metric.stats.sum).toMMSS());
      }
    }
  }
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
    return;
	} else if (notification.topicName.toLowerCase() === aggregatesTopic.toLowerCase()) {
		console.log('Aggregated data of logged agent: ', notification);
    aggregatedDataForAgent(notification.eventBody);
    return;
	} else if (notification.topicName.toLowerCase() === userCallsTopic.toLowerCase()) {
    console.debug('Call notification: ', notification);

    // if (isConversationDisconnected(notification.eventBody)) {
    //   activeCallNumber = '';
    //   //$("#NewCallRingingWindow").hide();
    // } else {
      var callDirection = '';
      var callNumber = '';

      let activeCallControl = false;
      for (let participant of notification.eventBody.participants) {
        if (participant.state === 'connected' && (participant.purpose === 'external' || participant.purpose === 'customer')){
          callDirection = participant.direction;
          callNumber = participant.address;
            //$("#NewCallRingingWindow").hide();
        } else{
            //$("#NewCallRingingWindow").show();
        }
        if ((participant.purpose == "user") || (participant.purpose == "agent")) {
          if (participant.user.id == me.id) {
            agentPart = participant;
          }
          else
            customerPart = participant;
        }
        if (participant.name === 'eurocenter_infoline_vdi_init' && participant.state === 'disconnected'){
          $("#initializationModalCenter").modal("hide") ;
        }

        //outbound voice interaction
          //"purpose": "user",
          //"state": "dialing", -> "state": "connected",
          //"direction": "outbound",
        //inbound voice interaction
          //"purpose": "agent",
          //"state": "alerting", -> "state": "connected",
          //"direction": "inbound",

        //if (participant.direction === "inbound" && participant.purpose === "agent" && (participant.state === "alerting" || participant.state === "connected")){
        //} else if (participant.direction === "outbound" && participant.purpose === "user" && (participant.state === "dialing" || participant.state === "connected")){
        if (participant.direction === "inbound" && participant.purpose === "agent" && participant.state === "alerting"){
          // active inbound call
          activeCallControl = true;
        } else if (participant.direction === "outbound" && participant.purpose === "user" && participant.state === "dialing"){
          // active outbound call
          activeCallControl = true;
        }
    	};

      if(activeCallControl){
        console.info("Active call control");
        if (!$("#CustomMenuIcon").hasClass("fa-bars")){
          $("#CustomMenuIcon").removeClass("fa-angle-double-up");
          $("#CustomMenuIcon").addClass("fa-bars");
          $("#GenesysCloudFrame").css("top","0px");
        }
        $("#NewCallRingingWindow").show();
      } else{
        console.info("Inactive call control");
        $("#NewCallRingingWindow").hide();
      }
      
      conversationId = notification.eventBody.id;

      if (callNumber !== activeCallNumber && callNumber !== ''){
        if (callDirection === 'inbound') {
          console.debug('Incomming call from number ' + callNumber);
        } else {
          console.debug('Outbound call to number ' + callNumber);
        }
        activeCallNumber = callNumber;
      }
    // }
    // return;
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
  customInitalizationDone = true;
  $("#initializationModalCenter").modal("show") ;
  makeCallInternal("EuroCenter_Infoline_VDI_Init@localhost");
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

function makeCall(phoneNumber, onbehalf){
    if (onbehalf){
      makeCallOnBehalfQueue(phoneNumber,"c9c3a47b-07ff-4bb7-a130-09e4ca6b4d1e");
    } else{
      makeCallInternal(phoneNumber);
    }
}

function makeCallInternal(phoneNumber){
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

function makeCallOnBehalfQueue(phoneNumber, queueId){
  let body = {
    "phoneNumber": phoneNumber,
    "callFromQueueId": queueId
};
conversationsApi.postConversationsCalls(body)
    .then((data) => {
         console.log('postConversationsCall behalf of queue success! data: ' + JSON.stringify(data, null, 2));
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