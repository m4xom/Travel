const API_BASE_URL = "https://boutique-travel-sahana-bkczdzdtdefnfxd0.centralus-01.azurewebsites.net/api";

// ---------------------------------------------------------------------------
// Duration slider label
// ---------------------------------------------------------------------------
const durationInput = document.getElementById("duration");
const durationValue = document.getElementById("duration-value");
durationInput.addEventListener("input", () => {
  durationValue.textContent = durationInput.value;
});

// ---------------------------------------------------------------------------
// Quiz form -> POST /api/generate-itinerary
// ---------------------------------------------------------------------------
const quizForm = document.getElementById("quiz-form");
const quizSubmitBtn = document.getElementById("quiz-submit");
const errorBanner = document.getElementById("error-banner");
const itineraryPane = document.getElementById("itinerary-pane");
const itineraryPlaceholder = document.getElementById("itinerary-placeholder");
const itineraryMeta = document.getElementById("itinerary-meta");
const itineraryDays = document.getElementById("itinerary-days");

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}
function clearError() {
  errorBanner.textContent = "";
  errorBanner.hidden = true;
}

quizForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  const destination = document.getElementById("destination").value;
  const duration = Number(durationInput.value);
  const preferences = Array.from(
    quizForm.querySelectorAll('input[name="preferences"]:checked')
  ).map((el) => el.value);

  quizSubmitBtn.disabled = true;
  quizSubmitBtn.textContent = "Generating...";

  try {
    const response = await fetch(`${API_BASE_URL}/generate-itinerary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination, duration, preferences }),
    });

    if (!response.ok) {
      const errorPayload = await safeParseJson(response);
      throw new Error(errorPayload?.error || `Request failed with status ${response.status}`);
    }

    const itinerary = await response.json();
    renderItinerary(itinerary);
  } catch (err) {
    if (err instanceof TypeError) {
      showError(
        "Could not reach the Boutique Travel Portal server. Make sure the backend is running at http://localhost:5000, then try again."
      );
    } else {
      showError(err.message);
    }
  } finally {
    quizSubmitBtn.disabled = false;
    quizSubmitBtn.textContent = "Generate My Itinerary";
  }
});

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function renderItinerary(itinerary) {
  itineraryMeta.innerHTML = `
    <span class="px-4 py-1 border border-outline text-xs uppercase tracking-widest">${itinerary.destination}</span>
    <span class="px-4 py-1 border border-outline text-xs uppercase tracking-widest">${itinerary.duration} day${itinerary.duration > 1 ? "s" : ""}</span>
    <span class="px-4 py-1 border border-outline text-xs uppercase tracking-widest">ID: ${itinerary.itineraryId}</span>
    ${itinerary.preferences.map((p) => `<span class="px-4 py-1 bg-primary text-white text-xs uppercase tracking-widest">${p}</span>`).join("")}
  `;

  itineraryDays.innerHTML = itinerary.days.map(renderDayCard).join("");

  itineraryPlaceholder.style.display = "none";
  itineraryPane.style.display = "block";
}

function renderDayCard(day) {
  const activitiesHtml = day.activities
    .map(
      (activity) => `
        <div class="flex justify-between items-center border-b border-outline/50 py-3">
          <div>
            <p class="font-medium">${activity.title}</p>
            <p class="text-xs text-on-surface-variant uppercase tracking-widest mt-1">Hosted by ${activity.host}</p>
          </div>
          <div class="font-headline-lg text-lg text-secondary">$${activity.cost}</div>
        </div>
      `
    )
    .join("");

  return `
    <div class="bg-surface p-8">
      <h5 class="font-headline-lg text-xl mb-4 text-primary">Day ${day.day}</h5>
      ${activitiesHtml}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Signature Experiences grid -> GET /api/experiences
// ---------------------------------------------------------------------------
const experienceGrid = document.getElementById("experience-grid");

async function loadExperiences() {
  try {
    const response = await fetch(`${API_BASE_URL}/experiences`);
    if (!response.ok) throw new Error("Failed to load experiences");
    const experiences = await response.json();
    experienceGrid.innerHTML = experiences
      .slice(0, 6)
      .map(
        (exp) => `
        <div class="group cursor-pointer border border-outline/30 p-8 hover:border-primary transition-colors">
          <p class="text-[10px] font-bold text-secondary tracking-[0.3em] uppercase mb-3">${exp.tags.join(" · ")}</p>
          <h4 class="font-headline-lg text-xl mb-3 text-primary">${exp.title}</h4>
          <p class="text-sm text-on-surface-variant mb-4">Hosted by ${exp.host}</p>
          <p class="font-headline-lg text-lg text-secondary">$${exp.cost}</p>
        </div>
      `
      )
      .join("");
  } catch (err) {
    experienceGrid.innerHTML = `<p class="text-on-surface-variant italic col-span-3">Experiences will appear here once the backend is running.</p>`;
  }
}

// ---------------------------------------------------------------------------
// Local Guardians (hosts) grid -> GET /api/hosts
// ---------------------------------------------------------------------------
const hostGrid = document.getElementById("host-grid");

async function loadHosts() {
  try {
    const response = await fetch(`${API_BASE_URL}/hosts`);
    if (!response.ok) throw new Error("Failed to load hosts");
    const hosts = await response.json();
    hostGrid.innerHTML = hosts
      .map(
        (host) => `
        <div class="p-10 border border-outline/30 flex flex-col items-center text-center">
          <div class="w-24 h-24 rounded-full bg-surface-container flex items-center justify-center mb-6">
            <span class="material-symbols-outlined text-3xl text-primary">person</span>
          </div>
          <h4 class="font-headline-lg text-xl mb-1">${host.name}</h4>
          <p class="text-[10px] font-bold text-secondary tracking-[0.2em] uppercase mb-4">${host.location}</p>
          <p class="text-on-surface-variant text-sm italic leading-relaxed mb-4">${host.sampleExperience}</p>
          <div class="flex flex-wrap gap-2 justify-center">
            ${host.specialties.map((s) => `<span class="text-[10px] uppercase tracking-widest border border-outline px-3 py-1">${s}</span>`).join("")}
          </div>
        </div>
      `
      )
      .join("");
  } catch (err) {
    hostGrid.innerHTML = `<p class="text-on-surface-variant italic col-span-3">Host directory will appear here once the backend is running.</p>`;
  }
}

loadExperiences();
loadHosts();

// ---------------------------------------------------------------------------
// Concierge Chat widget (mock guide replies)
// ---------------------------------------------------------------------------
const chatWidget = document.getElementById("chat-widget");
const chatToggle = document.getElementById("chat-toggle");
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

chatToggle.addEventListener("click", () => {
  chatWidget.classList.toggle("collapsed");
});

const MOCK_GUIDE_REPLIES = [
  { keywords: ["hello", "hi", "hey"], reply: "Hello! I'm looking forward to showing you around. What would you like to know?" },
  { keywords: ["weather"], reply: "This time of year is generally mild — pack light layers and a compact umbrella." },
  { keywords: ["food", "eat", "restaurant", "vegetarian", "allergy"], reply: "I know several fantastic spots that accommodate dietary preferences — just tell me what to avoid." },
  { keywords: ["time", "schedule", "start"], reply: "We can shift the schedule earlier or later to fit your pace — mornings tend to be quieter and more scenic." },
  { keywords: ["virtual", "tour", "preview", "360"], reply: "I'll send over a private 360° walkthrough link shortly — keep an eye on your inbox." },
  { keywords: ["thank"], reply: "You're very welcome! Excited to host you soon." },
];

function getMockGuideReply(userText) {
  const lowerText = userText.toLowerCase();
  const matched = MOCK_GUIDE_REPLIES.find((entry) => entry.keywords.some((k) => lowerText.includes(k)));
  return matched ? matched.reply : "Thanks for the message! I'll follow up shortly with more details about your trip.";
}

function appendChatMessage(text, sender) {
  const wrapper = document.createElement("div");
  wrapper.className = `chat-msg chat-msg--${sender}`;
  wrapper.innerHTML = `<span class="bubble inline-block px-4 py-2">${text}</span>`;
  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  appendChatMessage(text, "user");
  chatInput.value = "";
  const replyText = getMockGuideReply(text);
  setTimeout(() => appendChatMessage(replyText, "host"), 450);
});
