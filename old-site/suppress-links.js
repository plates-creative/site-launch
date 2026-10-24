document.addEventListener("DOMContentLoaded", function() {
  console.log("Suppress-links.js loaded");

  document.querySelectorAll('a[href="#"]').forEach(function(link) {
    link.addEventListener("click", function(event) {
      event.preventDefault();
      console.log("Prevented default on:", link);
    });
  });
});
