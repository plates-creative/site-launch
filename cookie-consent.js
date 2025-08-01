var cookieBannerSliderPos = 0;

function showCookieBanner() {
  var cookiebanner = document.getElementById("cookiebanner");
  var dialogHeight = parseInt(cookiebanner.offsetHeight);
  cookiebanner.style.bottom = (cookieBannerSliderPos - dialogHeight) + "px";
  cookieBannerSliderPos += 4;
  if (cookieBannerSliderPos < dialogHeight) {
    setTimeout(showCookieBanner, 1);
  } else {
    cookieBannerSliderPos = 0;
    cookiebanner.style.bottom = "0px";
  }
}

function hideCookieBanner() {
  var cookiebanner = document.getElementById("cookiebanner");
  cookiebanner.style.display = "none";
}

function loadGoogleAnalytics() {
  var gtagScript = document.createElement('script');
  gtagScript.src = "https://www.googletagmanager.com/gtag/js?id=G-2BK93H9RBS"; // Replace with your ID
  gtagScript.async = true;
  document.head.appendChild(gtagScript);

  gtagScript.onload = function () {
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', 'G-2BK93H9RBS'); // Replace with your ID again
  };
}

function onAcceptCookies() {
  localStorage.setItem('cookieConsentGiven', 'true'); // Store user consent
  loadGoogleAnalytics();
  hideCookieBanner();
}

// On page load: check if consent exists
window.addEventListener('load', function () {
  var hasConsent = localStorage.getItem('cookieConsentGiven') === 'true';

  if (hasConsent) {
    loadGoogleAnalytics();
  } else {
    showCookieBanner();
  }
});
