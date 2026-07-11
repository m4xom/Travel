const sql = require("mssql");

// Connection details come from Azure App Service Application Settings
// (never hardcode credentials in source). Locally, set these as
// environment variables (e.g. in a .env file loaded by your shell) if
// you want to test against the real database from your machine.
const config = {
  server: process.env.SQL_SERVER,       // e.g. travelportal-sql.database.windows.net
  database: process.env.SQL_DATABASE,   // e.g. TravelPortalDB
  user: process.env.SQL_USER,           // e.g. travelportaladmin
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: true,               // required for Azure SQL
    trustServerCertificate: false,
  },
  connectionTimeout: 60000, // 60s — Serverless tier can take a while to wake from auto-pause
  requestTimeout: 60000,
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}

async function ensureTableExists() {
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Itineraries' AND xtype='U')
    CREATE TABLE Itineraries (
      itineraryId NVARCHAR(50) PRIMARY KEY,
      destination NVARCHAR(200) NOT NULL,
      duration INT NOT NULL,
      preferences NVARCHAR(MAX),
      days NVARCHAR(MAX),
      totalCost INT,
      createdAt DATETIME2
    )
  `);
}

async function readItineraries() {
  const pool = await getPool();
  const result = await pool.request().query("SELECT * FROM Itineraries");
  return result.recordset.map((row) => ({
    itineraryId: row.itineraryId,
    destination: row.destination,
    duration: row.duration,
    preferences: JSON.parse(row.preferences),
    days: JSON.parse(row.days),
    totalCost: row.totalCost,
    createdAt: row.createdAt,
  }));
}

async function persistItinerary(itinerary) {
  const pool = await getPool();
  await pool
    .request()
    .input("itineraryId", sql.NVarChar, itinerary.itineraryId)
    .input("destination", sql.NVarChar, itinerary.destination)
    .input("duration", sql.Int, itinerary.duration)
    .input("preferences", sql.NVarChar(sql.MAX), JSON.stringify(itinerary.preferences))
    .input("days", sql.NVarChar(sql.MAX), JSON.stringify(itinerary.days))
    .input("totalCost", sql.Int, itinerary.totalCost)
    .input("createdAt", sql.DateTime2, new Date(itinerary.createdAt))
    .query(`
      INSERT INTO Itineraries (itineraryId, destination, duration, preferences, days, totalCost, createdAt)
      VALUES (@itineraryId, @destination, @duration, @preferences, @days, @totalCost, @createdAt)
    `);
}

module.exports = { getPool, ensureTableExists, readItineraries, persistItinerary };