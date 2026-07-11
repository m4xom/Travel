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
      createdAt DATETIME2,
      userId NVARCHAR(50)
    )
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
    CREATE TABLE Users (
      userId NVARCHAR(50) PRIMARY KEY,
      name NVARCHAR(200) NOT NULL,
      email NVARCHAR(200) NOT NULL UNIQUE,
      travelPreferences NVARCHAR(MAX),
      createdAt DATETIME2
    )
  `);
}

// ---------------------------------------------------------------------------
// User profile helpers
// ---------------------------------------------------------------------------

async function createUser(user) {
  const pool = await getPool();
  await pool
    .request()
    .input("userId", sql.NVarChar, user.userId)
    .input("name", sql.NVarChar, user.name)
    .input("email", sql.NVarChar, user.email)
    .input("travelPreferences", sql.NVarChar(sql.MAX), JSON.stringify(user.travelPreferences || []))
    .input("createdAt", sql.DateTime2, new Date(user.createdAt))
    .query(`
      INSERT INTO Users (userId, name, email, travelPreferences, createdAt)
      VALUES (@userId, @name, @email, @travelPreferences, @createdAt)
    `);
}

async function getUserByEmail(email) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("email", sql.NVarChar, email)
    .query("SELECT * FROM Users WHERE email = @email");
  if (result.recordset.length === 0) return null;
  const row = result.recordset[0];
  return {
    userId: row.userId,
    name: row.name,
    email: row.email,
    travelPreferences: JSON.parse(row.travelPreferences || "[]"),
    createdAt: row.createdAt,
  };
}

async function getUserById(userId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("userId", sql.NVarChar, userId)
    .query("SELECT * FROM Users WHERE userId = @userId");
  if (result.recordset.length === 0) return null;
  const row = result.recordset[0];
  return {
    userId: row.userId,
    name: row.name,
    email: row.email,
    travelPreferences: JSON.parse(row.travelPreferences || "[]"),
    createdAt: row.createdAt,
  };
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
    .input("userId", sql.NVarChar, itinerary.userId || null)
    .query(`
      INSERT INTO Itineraries (itineraryId, destination, duration, preferences, days, totalCost, createdAt, userId)
      VALUES (@itineraryId, @destination, @duration, @preferences, @days, @totalCost, @createdAt, @userId)
    `);
}

module.exports = {
  getPool,
  ensureTableExists,
  readItineraries,
  persistItinerary,
  createUser,
  getUserByEmail,
  getUserById,
};
