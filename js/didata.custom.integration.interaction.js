function Page_Loaded() {
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
        addUrlParameters("Parametr: " + key + ", Hodnota: " + value);
    });
}

function addUrlParameters(text){
    var ul = document.getElementById("url-params-history");
    var li = document.createElement("li");
    li.setAttribute('class','list-group-item');
    li.appendChild(document.createTextNode(text));
    ul.appendChild(li);
}
