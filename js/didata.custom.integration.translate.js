function Page_Loaded() {  
  
  Array.from(parent.document.getElementsByClassName('navbar-brand')).forEach(
    function(element, index, array) {
        element.innerHTML = "fdfdfdf";
    }
  );
}
