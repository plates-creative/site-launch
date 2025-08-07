const phrases = [
  "an AI-powered app for finding frequencies",
  "a mythical brand for engineered wonder",
  "a motion study of memory and meaning",
  "a new site shaped by what's next (soon)",
  "a publication on self-reflection"
];

const textEl = document.getElementById("typewriter-text");
let currentPhrase = 0;
let isDeleting = false;
let text = "";
let typingSpeed = 50;
let pauseTime = 1800;

function typeLoop() {
  const fullText = phrases[currentPhrase];

  if (isDeleting) {
    text = fullText.substring(0, text.length - 1);
  } else {
    text = fullText.substring(0, text.length + 1);
  }

textEl.textContent = text || "\u00A0"; // non-breaking space

  let delay = typingSpeed;

  if (!isDeleting && text === fullText) {
    delay = pauseTime;
    isDeleting = true;
  } else if (isDeleting && text === "") {
    isDeleting = false;
    currentPhrase = (currentPhrase + 1) % phrases.length;
    delay = 300;
  }

  setTimeout(typeLoop, delay);
}

setTimeout(typeLoop, 1000);
