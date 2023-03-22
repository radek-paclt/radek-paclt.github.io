const clientId = '5012f6b6-f441-4ef7-8642-841b376a8bfe';
const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;
const apiInstance = new platformClient.IntegrationsApi();
const usersApi = new platformClient.UsersApi();

const redirectUri = 'https://radek-paclt.github.io/sazka/support.html';
//https://radek-paclt.github.io/sazka/index.html
//http://localhost:5500/index.html
//https://radek-paclt.github.io/sazka/support.html
//http://localhost:5500/support.html

// Set PureCloud settings
client.setEnvironment('mypurecloud.de');
client.setPersistSettings(true, 'agent-helper-app');

const queryString = window.location.search;
console.log(queryString);
const urlParams = new URLSearchParams(queryString);

const forms = document.querySelectorAll('.needs-validation')

let me;

Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
        if (!form.checkValidity()) {
        event.preventDefault()
        event.stopPropagation()
        }

        form.classList.add('was-validated')
    }, false)
});


document.addEventListener("DOMContentLoaded", function(){
    console.debug("starting support app");
    client.loginImplicitGrant(clientId, redirectUri)
        .then(() => {
            return usersApi.getUsersMe({'expand': ["presence"]});
        })
        .then((userMe) => {
            console.log('userMe: ', userMe);
            me = userMe;
        })
        .catch((err) => {
            console.error(err)
        });
});

document.getElementById("SendSMSButton").addEventListener("click", function(){
    console.debug("CreateSMS clicked");
    let actionId = "custom_-_d356a0e2-77b8-42c8-989e-f1e23ac2f853";
    let body = {
        "PhoneNumber": document.getElementById("validationCustomPhoneNumber").value,
        "PreferredAgent": me.id,
        "AgentName": me.name,
        "ServiceName": "SMS Automat",
        "CurrentTime": new Date().toISOString(),
        "PreviousActivityTask": document.getElementById("validationCustomPreviousActivity").value ?? ""
    };

    apiInstance.postIntegrationsActionExecute(actionId, body)
        .then((data) => {
            console.log(`postIntegrationsActionExecute done! data: ${JSON.stringify(data, null, 2)}`);
        })
        .catch((err) => {
            console.log('There was a failure calling postIntegrationsActionExecute');
            console.error(err);
        });
});

document.getElementById("CreateTaskButton").addEventListener("click", function(){
    console.debug("CreateTaskButton clicked");
    let actionId = "custom_-_96939603-0bc1-44f9-a2a9-80e6402c20d8";
    let body = {
        "PreferredAgent": me.id,
        "AgentName": me.name,
        "ServiceName": document.getElementById("validationCustomTask").value ?? "",
        "CurrentTime": new Date().toISOString(),
        "Message": document.getElementById("validationCustomTaskDescription").value ?? ""
    };

    apiInstance.postIntegrationsActionExecute(actionId, body)
        .then((data) => {
            console.log(`postIntegrationsActionExecute done! data: ${JSON.stringify(data, null, 2)}`);
        })
        .catch((err) => {
            console.log('There was a failure calling postIntegrationsActionExecute');
            console.error(err);
        });
});

//1cb9cd5e-a0b6-4369-8386-2e6d27020380