const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { ensureTableExists, readItineraries, persistItinerary } = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

const EXPERIENCES_PATH = path.join(__dirname, "data", "mock_experiences.json");

const MIN_DURATION = 1;
const MAX_DURATION = 7;
const ACTIVITIES_PER_DAY = 2;

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function readExperiences() {
  const raw = fs.readFileSync(EXPERIENCES_PATH, "utf-8");
  return JSON.parse(raw);
}

function generateItineraryId() {
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  return `itin-${randomSuffix}`;
}

// ---------------------------------------------------------------------------
// Recommendation / scoring engine
// ---------------------------------------------------------------------------

/**
 * Scores an experience by how many of its tags overlap with the traveler's
 * stated preferences. Ties are broken by lower cost (better value first).
 */
function scoreExperience(experience, preferences) {
  const tagSet = new Set(experience.tags.map((t) => t.toLowerCase()));
  const prefSet = preferences.map((p) => p.toLowerCase());
  const matchCount = prefSet.filter((p) => tagSet.has(p)).length;
  return matchCount;
}

function filterAndScoreExperiences(destination, preferences) {
  const experiences = readExperiences();
  const normalizedDestination = destination.trim().toLowerCase();

  const matchingByDestination = experiences.filter((exp) =>
    exp.location.trim().toLowerCase().includes(normalizedDestination)
  );

  if (matchingByDestination.length === 0) {
    return [];
  }

  const scored = matchingByDestination.map((exp) => ({
    ...exp,
    matchScore: scoreExperience(exp, preferences),
  }));

  scored.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return a.cost - b.cost;
  });

  return scored;
}

/**
 * Builds a day-by-day distribution matrix. Cycles back through the ranked
 * experience pool (round-robin) if there aren't enough unique experiences
 * to fill every day/slot, so no day is ever left empty.
 */
function buildDayByDayPlan(rankedExperiences, duration) {
  const days = [];
  let cursor = 0;

  for (let dayNumber = 1; dayNumber <= duration; dayNumber++) {
    const activities = [];
    for (let slot = 0; slot < ACTIVITIES_PER_DAY; slot++) {
      const experience = rankedExperiences[cursor % rankedExperiences.length];
      activities.push({
        id: experience.id,
        title: experience.title,
        host: experience.host,
        cost: experience.cost,
        tags: experience.tags,
      });
      cursor++;
    }
    days.push({ day: dayNumber, activities });
  }

  return days;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Boutique Travel Portal API is running" });
});

app.get("/api/experiences", (req, res) => {
  try {
    const experiences = readExperiences();
    res.json(experiences);
  } catch (err) {
    console.error("Failed to read experiences:", err);
    res.status(500).json({ error: "Could not load experiences data." });
  }
});

// Derives a unique local-host directory from the experiences catalogue.
// Powers the "Local Guardians" section on the frontend.
app.get("/api/hosts", (req, res) => {
  try {
    const experiences = readExperiences();
    const hostMap = new Map();

    experiences.forEach((exp) => {
      if (!hostMap.has(exp.host)) {
        hostMap.set(exp.host, {
          name: exp.host,
          location: exp.location,
          specialties: new Set(),
          sampleExperience: exp.title,
        });
      }
      exp.tags.forEach((t) => hostMap.get(exp.host).specialties.add(t));
    });

    const hosts = Array.from(hostMap.values()).map((h) => ({
      ...h,
      specialties: Array.from(h.specialties),
    }));

    res.json(hosts);
  } catch (err) {
    console.error("Failed to derive hosts:", err);
    res.status(500).json({ error: "Could not load host directory." });
  }
});

app.post("/api/generate-itinerary", async (req, res) => {
  const { destination, duration, preferences } = req.body || {};

  if (!destination || typeof destination !== "string" || !destination.trim()) {
    return res.status(400).json({ error: "A valid 'destination' string is required." });
  }

  const durationNum = Number(duration);
  if (!Number.isInteger(durationNum) || durationNum < MIN_DURATION || durationNum > MAX_DURATION) {
    return res.status(400).json({
      error: `'duration' must be an integer between ${MIN_DURATION} and ${MAX_DURATION}.`,
    });
  }

  const preferenceList = Array.isArray(preferences) ? preferences.filter((p) => typeof p === "string") : [];

  let rankedExperiences;
  try {
    rankedExperiences = filterAndScoreExperiences(destination, preferenceList);
  } catch (err) {
    console.error("Failed to read/filter experiences:", err);
    return res.status(500).json({ error: "Could not load experiences data." });
  }

  if (rankedExperiences.length === 0) {
    return res.status(404).json({
      error: `No experiences found for destination "${destination}". Try "Kyoto, Japan".`,
    });
  }

  const days = buildDayByDayPlan(rankedExperiences, durationNum);

  const totalCost = days.reduce(
    (sum, day) => sum + day.activities.reduce((daySum, activity) => daySum + activity.cost, 0),
    0
  );

  const itinerary = {
    itineraryId: generateItineraryId(),
    destination: destination.trim(),
    duration: durationNum,
    preferences: preferenceList,
    days,
    totalCost,
    createdAt: new Date().toISOString(),
  };

  try {
    await persistItinerary(itinerary);
  } catch (err) {
    console.error("Failed to persist itinerary:", err);
    return res.status(500).json({ error: "Itinerary was generated but could not be saved." });
  }

  res.status(201).json(itinerary);
});

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

app.listen(PORT, async () => {
  console.log(`Boutique Travel Portal backend running at http://localhost:${PORT}`);
  try {
    await ensureTableExists();
    console.log("Connected to Azure SQL and confirmed Itineraries table exists.");
  } catch (err) {
    console.error("Could not connect to Azure SQL:", err.message);
  }
});
