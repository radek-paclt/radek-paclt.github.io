const clientId = '5012f6b6-f441-4ef7-8642-841b376a8bfe';
const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;
const apiInstance = new platformClient.IntegrationsApi();
const usersApi = new platformClient.UsersApi();
const responseApi = new platformClient.ResponseManagementApi();
const conversationsApi = new platformClient.ConversationsApi();
const notificationsApi = new platformClient.NotificationsApi();

//const redirectUri = 'https://radek-paclt.github.io/sazka/support.html';
var redirectUri = window.location.href.split('?')[0];
//https://radek-paclt.github.io/sazka/index.html
//http://localhost:5500/index.html
//https://radek-paclt.github.io/sazka/support.html
//http://localhost:5500/support.html

// Set PureCloud settings
client.setEnvironment('mypurecloud.de');
client.setPersistSettings(true, 'agent-helper-app');

const queryString = window.location.search;
console.log(queryString);

const forms = document.querySelectorAll('.needs-validation')

let me;
let searchingById = true;
let selectedBrancheInfo;
let selectedStandardResponse;
let activeCallNumber, customerParticipantId, conversationId = "";


document.addEventListener("DOMContentLoaded", function(){
    console.debug("starting support app");
    client.loginImplicitGrant(clientId, redirectUri)
        .then(() => {
            return usersApi.getUsersMe({'expand': ["presence"]});
        })
        .then((userMe) => {
            console.log('userMe: ', userMe);
            me = userMe;

            let opts = { 
                'communicationType': "Call"
            };
            
            conversationsApi.getConversations(opts)
            .then((data) => {
                console.log(`getConversations success! data: ${JSON.stringify(data, null, 2)}`);
                if(data.entities.length > 0){
                    for(const entity of data.entities){
                        var callDirection = '';
                        var callNumber = '';

                        for(const participant of entity.participants){
                            if (participant.calls[0].state === 'connected' && (participant.purpose === 'external' || participant.purpose === 'customer')){
                                callDirection = participant.direction;
                                callNumber = participant.address;
                                if (participant.purpose === 'customer')
                                    customerParticipantId = participant.id;
                                break;  
                            }
                        }

                        if (callNumber !== activeCallNumber && callNumber !== ''){
                            if (callDirection === 'inbound') {
                                console.log('Příchozí hovor z čísla ' + callNumber);
                            } else {
                                console.log('Odchozí hovor na číslo ' + callNumber);
                            }
                            //if (activeCallNumber !== callNumber){
                                activeCallNumber = callNumber;
                                conversationId = entity.id;

                                if (activeCallNumber.length > 9){
                                    activeCallNumber = activeCallNumber.slice(-9);
                                }
            
                                searchingById = false;
                                document.getElementById('posSearchingById').classList.replace('btn-primary','btn-outline-primary');
                                document.getElementById('searchingByPhone').classList.replace('btn-outline-primary','btn-primary');
            
                                document.getElementById("posSearchByInput").value = activeCallNumber;
            
                                FindPos();
                            //}
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
			conversationsTopic = 'v2.users.' + me.id + '.conversations';

			const NotificationBody = [ { id: conversationsTopic } ];
			return notificationsApi.putNotificationsChannelSubscriptions(notificationChannel.id, NotificationBody);
		})
		.then((topicSubscriptions) => {
			console.log('topicSubscriptions: ', topicSubscriptions);
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
            activeCallNumber = "";
            conversationId = "";
            customerParticipantId = "";
        } else {
            var callDirection = '';
            var callNumber = '';

            for (let participant of notification.eventBody.participants) {
                if (participant.calls[0].state === 'connected' && (participant.purpose === 'external' || participant.purpose === 'customer')){
                    callDirection = participant.direction;
                    callNumber = participant.address;

                    if (participant.purpose === 'customer')
                        customerParticipantId = participant.id;
                    break;  
                }
            };
            
            if (callNumber !== activeCallNumber && callNumber !== ''){
                if (callDirection === 'inbound') {
                    console.log('Příchozí hovor z čísla ' + callNumber);
                } else {
                    console.log('Odchozí hovor na číslo ' + callNumber);
                }
                if (activeCallNumber === "" && activeCallNumber !== callNumber){
                    activeCallNumber = callNumber;

                    conversationId = notification.eventBody.id;

                    if (activeCallNumber.length > 9){
                        activeCallNumber = activeCallNumber.slice(-9);
                    }

                    searchingById = false;
                    document.getElementById('posSearchingById').classList.replace('btn-primary','btn-outline-primary');
                    document.getElementById('searchingByPhone').classList.replace('btn-outline-primary','btn-primary');

                    document.getElementById("posSearchByInput").value = activeCallNumber;

                    FindPos();
                }
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
		if (participant.calls[0].state === 'connected') {
			isConnected = true;
			return true;
		}
	});

	return !isConnected;
}

//vyhledani POS dle tel. cisla nebo ID
document.getElementById("SearchPos").addEventListener("click", function(){
    console.debug("SearchPosButton clicked");
    FindPos();
});

function FindPos(){
    selectedBrancheInfo = null;
    selectedStandardResponse = null;
    document.getElementById("posEscalateButton").disabled = true;

    if (searchingById){
        //BranchesInformations by ID
        let actionId = "custom_-_05df122d-daef-4107-9093-05d65faad051";
        let body = {
            "GUID": me.id,
            "Id": document.getElementById("posSearchByInput").value
        };

        CallingBranchInfoRequest(actionId,body,document.getElementById("posSearchByInput").value);
    } else{
        //BranchesInformations by Phone
        let actionId = "custom_-_65489fa7-c5ea-4fad-8d98-bcaf37f07ba6";
        let body = {
            "GUID": me.id,
            "phoneNumber": document.getElementById("posSearchByInput").value
        };

        CallingBranchInfoRequest(actionId,body,document.getElementById("posSearchByInput").value);
    }
}

//Kliknuti na pozadavek na eskalovani do JIRA - vola se ulozena akce v Genesys Cloud
document.getElementById("posEscalateButton").addEventListener("click", function(){
    console.debug("posEscalateButton clicked");
    if (selectedBrancheInfo){
        var content = document.getElementById("posEscalationContent").value;
        //KCES-Service Request-Eskalace_TEST ESB_QA
        const standardResponseArray = selectedStandardResponse.split("-");

        let actionId = "custom_-_20af130a-192d-4291-bc98-16b60a75b410";
        let body = {
            "GUID": me.id,
            "projectKey": standardResponseArray[0], //KCES - do projektu KC Eskalace (SD) / KCPOS - do projektu KC - Stížnosti na POS
            "issueTypeName": standardResponseArray[1], //v současné chvíli pracuje KC jen s hodnotou “"Service Request", přípustný je i “Incident” a “Task”
            "summary": selectedBrancheInfo.Region+"_"+selectedBrancheInfo.Cislo+"_"+standardResponseArray[2], //cislo regionu_cisloPOS_název eskalace
            "description": content.replaceAll("\n","\\n"), //obsah 
            "requestType": GenerateRequestTypeForPosEscalation(selectedBrancheInfo.Region) //region 1_RSA 2_RSB 3_RSC 4_RSD 5_RSE 6_RSF 7_RSG
        };
        console.log(`postIntegrationsActionExecute data: ${JSON.stringify(body, null, 2)}`);

        apiInstance.postIntegrationsActionExecute(actionId, body)
        .then((data) => {
            console.log(`postIntegrationsActionExecute done! data: ${JSON.stringify(data, null, 2)}`);
            //posEscalateButtonResponse
            document.getElementById("posEscalateButtonResponse").innerHTML = "Požadavek úspěšně založen";
            document.getElementById("posEscalateButtonResponse").style.display = "block";
            document.getElementById("posEscalateButton").disabled = true;
        })
        .catch((err) => {
            console.log('There was a failure calling postIntegrationsActionExecute');
            console.error(err);
        });
    }
});

function GenerateRequestTypeForPosEscalation(region){
    switch(region) {
        case "1":
          return "1_RSA";
        case "2":
          return "2_RSB";
        case "3":
          return "3_RSC";
        case "4":
            return "4_RSD";
        case "5":
            return "5_RSE";
        case "6":
            return "6_RSF";
        case "7":
            return "7_RSG";
      }
}

//Naplneni vybraneho POSu do stranky
function ProcessingBranchInfo(branchInfo) {
    document.getElementById("posDetails").style.display = "block";
    document.getElementById("posId").value = branchInfo.Cislo;
    document.getElementById("posOz").value = branchInfo.Oz ?? "";
    document.getElementById("posAdresaPOS").value = branchInfo.AdresaPOS ?? "";
    document.getElementById("posNazevProvozovny").value = branchInfo.NazevProvozovny ?? "";
    document.getElementById("posRegion").value = branchInfo.Region ?? "";

    if(branchInfo.finSluzby === "ano")
        document.getElementById('posfinSluzby').classList.replace('btn-danger','btn-success');
    if(branchInfo.DPD === "ano")
        document.getElementById('posDPD').classList.replace('btn-danger','btn-success');
    if(branchInfo.CP === "ano")
        document.getElementById('posCP').classList.replace('btn-danger','btn-success');
    if(branchInfo.cornPobocka === "ano")
        document.getElementById('poscornPobocka').classList.replace('btn-danger','btn-success');
    if(branchInfo.Unipok){
        document.getElementById('posUnipok').classList.replace('btn-danger','btn-success');
        document.getElementById("posUnipok").innerHTML = "UNIPOK " + branchInfo.Unipok;
    }

    if (conversationId !== "" && customerParticipantId !== ""){

        let body = { 
            'attributes': {
                "POS-ID": branchInfo.Cislo
            }
        };

        conversationsApi.patchConversationParticipantAttributes(conversationId, customerParticipantId, body).then(() => {
                    console.log('patchConversationParticipantAttributes returned successfully.');
            }).catch((err) => {
                    console.log('There was a failure calling patchConversationParticipantAttributes');
                    console.error(err);
            });
    }
}

//Vybrana standardni odpoved - nahrazeny zastupne texty za hodnoty z POSu a vlozeno do stranky
function FillStandardResponse(id, name, content){
    console.log(`Standard response ${id}: ${name} selected [${content}]`);
    selectedStandardResponse = name;
    var updatedContent = content;
    //{{POS_ID}}
    updatedContent = updatedContent.replaceAll("{{POS_ID}}",selectedBrancheInfo.Cislo);
    //{{POS_NazevProvozovny}}
    updatedContent = updatedContent.replaceAll("{{POS_NazevProvozovny}}",selectedBrancheInfo.NazevProvozovny);
    //{{POS_AdresaPOS}}
    updatedContent = updatedContent.replaceAll("{{POS_AdresaPOS}}",selectedBrancheInfo.AdresaPOS);
    //{{POS_OZ}}
    updatedContent = updatedContent.replaceAll("{{POS_OZ}}",selectedBrancheInfo.OZ);
    //{{POS_Technik}}
    updatedContent = updatedContent.replaceAll("{{POS_Technik}}",selectedBrancheInfo.Technik);
    //{{POS_Kategorie}}
    updatedContent = updatedContent.replaceAll("{{POS_Kategorie}}",selectedBrancheInfo.Kategorie);
    //{{POS_Cinnost}}
    updatedContent = updatedContent.replaceAll("{{POS_Cinnost}}",selectedBrancheInfo.Cinnost);

    document.getElementById("posEscalationContent").value = updatedContent;
    document.getElementById("posEscalateButton").disabled = false;
}

//Metoda pro volani BrancheInfo na SAGu pro vraceni detailu POSu - zobrazuje se jen a pouze v pripade singlematch
function CallingBranchInfoRequest(actionId, body, lookedValue){
    document.getElementById("posSearchResultMessage").innerHTML = "";
    document.getElementById("posSearchResultMessage").style.display = "none";
    document.getElementById("posDetails").style.display = "none";
    document.getElementById("posEscalateButtonResponse").style.display = "none";
    document.getElementById("posEscalationContent").value = "";

    apiInstance.postIntegrationsActionExecute(actionId, body)
    .then((data) => {
        console.log(`postIntegrationsActionExecute done! data: ${JSON.stringify(data, null, 2)}`);
        if (data && data.branchesInformations){
            if (data.branchesInformations.length == 1){
                console.log("exact one item found");
                selectedBrancheInfo = data.branchesInformations[0];

                ProcessingBranchInfo(selectedBrancheInfo);

                let libraryId = "eab5a099-2beb-42c1-ba5b-3db5dd3b3093";
                let opts = { 
                    'pageNumber': 1,
                    'pageSize': 250,
                };

                responseApi.getResponsemanagementResponses(libraryId, opts)
                    .then((data) => {
                        console.log(`getResponsemanagementResponses success! data: ${JSON.stringify(data, null, 2)}`);
                        if (data && data.entities && data.entities.length > 0){
                            var responsesMenu = document.getElementById("posEscalationTypeList");
                            responsesMenu.innerHTML = '';
                            //<li><a class="dropdown-item" href="#">Action</a></li>
                            for (var i = 0; i < data.entities.length; i++) {
                                var oneStandardResponse = data.entities[i];
                                if (oneStandardResponse.texts && oneStandardResponse.texts.length > 0 
                                    && oneStandardResponse.texts[0].content && oneStandardResponse.texts[0].contentType === "text/plain"){
                                    var li = document.createElement("li");
                                    var a = document.createElement("a");
                                    a.classList.add("dropdown-item");
                                    a.text = oneStandardResponse.name;
                                    a.responseId = oneStandardResponse.id;
                                    a.responseName = oneStandardResponse.name;
                                    a.responseText = oneStandardResponse.texts[0].content;
                                    a.addEventListener('click', function handleClick(event) {
                                        console.log('standard response selected', event);
                                        if (event && event.target 
                                            && event.target.responseId 
                                            && event.target.responseText
                                            && event.target.responseName){
                                                FillStandardResponse(event.target.responseId, 
                                                    event.target.responseName,
                                                    event.target.responseText);
                                        }
                                      });
                                    a.href = "#";
                                    li.appendChild(a);
                                    responsesMenu.appendChild(li);
                                }
                            }
                        }
                    })
                    .catch((err) => {
                        console.log('There was a failure calling getResponsemanagementResponses');
                        console.error(err);
                    });
                
            } else if (data.branchesInformations.length > 1){
                console.log("multimatch");
                document.getElementById("posSearchResultMessage").innerHTML = `Nalezeno více záznamů pro ${lookedValue}`;
                document.getElementById("posSearchResultMessage").style.display = "block";
            } else{
                console.log("nomatch");
                document.getElementById("posSearchResultMessage").innerHTML = `Záznam ${lookedValue} nenalezen`;
                document.getElementById("posSearchResultMessage").style.display = "block";
            }
        } else{
            console.log("no data found");
            document.getElementById("posSearchResultMessage").innerHTML = `Záznam ${lookedValue} nenalezen`;
            document.getElementById("posSearchResultMessage").style.display = "block";
        }
    })
    .catch((err) => {
        console.log('There was a failure calling postIntegrationsActionExecute');
        console.error(err);
    }).then(() =>{
        document.getElementById("posSearchByInput").value = "";
    });
}