let showColon = true;

function formatTimeWithBlink(timeString) {
  // Split into parts: "14:37" → ["14", "37"]
  const [hours, minutes] = timeString.split(':');
  return showColon ? `${hours}:${minutes}` : `${hours} ${minutes}`;
}

function updateTimes() {
  const options = { hour: '2-digit', minute: '2-digit', hour12: false };

  const atxTimeRaw = new Date().toLocaleTimeString('en-US', { ...options, timeZone: 'America/Chicago' });
  const sfTimeRaw = new Date().toLocaleTimeString('en-US', { ...options, timeZone: 'America/Los_Angeles' });

  const atxEl = document.getElementById('time-atx');
  const sfEl = document.getElementById('time-sf');

  if (atxEl && sfEl) {
    atxEl.textContent = `ATX ${formatTimeWithBlink(atxTimeRaw)}`;
    sfEl.textContent = `SF ${formatTimeWithBlink(sfTimeRaw)}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateTimes();
  setInterval(() => {
    showColon = !showColon;
    updateTimes();
  }, 500); // Toggle colon visibility every 500ms
});
