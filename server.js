```js
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(express.json());
app.use(express.static(__dirname));

// ==========================================
// DATABASE FILE
// ==========================================

const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "players.json");

const TOTAL_SLOTS = 48;
const ENTRY_FEE = 16;
const KILL_BONUS = 50;
const BOOYAH_BONUS = 50;

// Create data folder
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create players file
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, "[]", "utf8");
}

// ==========================================
// READ PLAYERS
// ==========================================

function getPlayers() {
  try {
    const data = fs.readFileSync(dataFile, "utf8");

    const players = JSON.parse(data);

    if (!Array.isArray(players)) {
      return [];
    }

    return players;
  } catch (error) {
    console.error("Database read error:", error);
    return [];
  }
}

// ==========================================
// SAVE PLAYERS
// ==========================================

function savePlayers(players) {
  try {
    fs.writeFileSync(
      dataFile,
      JSON.stringify(players, null, 2),
      "utf8"
    );

    return true;
  } catch (error) {
    console.error("Database save error:", error);
    return false;
  }
}

// ==========================================
// BONUS CALCULATION
// ==========================================

function calculateBonus(player) {
  let bonus = 0;

  if (Number(player.kills || 0) >= 10) {
    bonus += KILL_BONUS;
  }

  if (
    player.booyah === true ||
    player.booyah === "true"
  ) {
    bonus += BOOYAH_BONUS;
  }

  return bonus;
}

// ==========================================
// HOME PAGE
// ==========================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "tournament.html")
  );
});

// ==========================================
// ADMIN PAGE
// ==========================================

app.get("/admin", (req, res) => {
  res.sendFile(
    path.join(__dirname, "admin.html")
  );
});

// ==========================================
// GET ALL PLAYERS
// ==========================================

app.get("/api/players", (req, res) => {
  try {
    const players = getPlayers();

    const updatedPlayers = players.map((player) => ({
      ...player,
      bonus: calculateBonus(player)
    }));

    res.json(updatedPlayers);

  } catch (error) {

    console.error(
      "Players API error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Unable to load players."
    });
  }
});

// ==========================================
// GET SLOTS
// ==========================================

app.get("/api/slots", (req, res) => {
  try {

    const players = getPlayers();

    const bookedSlots = players
      .map((player) => Number(player.slot))
      .filter(
        (slot) =>
          Number.isInteger(slot) &&
          slot >= 1 &&
          slot <= TOTAL_SLOTS
      );

    const availableSlots = [];

    for (let i = 1; i <= TOTAL_SLOTS; i++) {

      if (!bookedSlots.includes(i)) {
        availableSlots.push(i);
      }

    }

    res.json({
      totalSlots: TOTAL_SLOTS,
      bookedSlots,
      availableSlots
    });

  } catch (error) {

    console.error(
      "Slots API error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Unable to load slots."
    });
  }
});

// ==========================================
// REGISTER PLAYER
// ==========================================

app.post("/api/register", (req, res) => {

  try {

    const {
      playerName,
      uid,
      ign,
      slot
    } = req.body;

    // Check fields
    if (
      !playerName ||
      !uid ||
      !ign ||
      slot === undefined ||
      slot === null ||
      slot === ""
    ) {

      return res.status(400).json({
        success: false,
        message: "All fields are required."
      });

    }

    const cleanPlayerName =
      String(playerName).trim();

    const cleanUID =
      String(uid).trim();

    const cleanIGN =
      String(ign).trim();

    const slotNumber =
      Number(slot);

    // Check empty values
    if (
      !cleanPlayerName ||
      !cleanUID ||
      !cleanIGN
    ) {

      return res.status(400).json({
        success: false,
        message: "All fields are required."
      });

    }

    // Check slot
    if (
      !Number.isInteger(slotNumber) ||
      slotNumber < 1 ||
      slotNumber > TOTAL_SLOTS
    ) {

      return res.status(400).json({
        success: false,
        message: "Invalid slot number."
      });

    }

    const players = getPlayers();

    // Check booked slot
    const slotTaken = players.some(
      (player) =>
        Number(player.slot) === slotNumber
    );

    if (slotTaken) {

      return res.status(409).json({
        success: false,
        message: "This slot is already booked."
      });

    }

    // Check duplicate UID
    const uidExists = players.some(
      (player) =>
        String(player.uid).trim() === cleanUID
    );

    if (uidExists) {

      return res.status(409).json({
        success: false,
        message: "This FF UID is already registered."
      });

    }

    // New player
    const newPlayer = {

      id: Date.now().toString(),

      playerName:
        cleanPlayerName,

      uid:
        cleanUID,

      ign:
        cleanIGN,

      slot:
        slotNumber,

      payment:
        "pending",

      kills:
        0,

      booyah:
        false,

      bonus:
        0,

      registeredAt:
        new Date().toISOString()

    };

    players.push(newPlayer);

    const saved =
      savePlayers(players);

    if (!saved) {

      return res.status(500).json({
        success: false,
        message: "Unable to save registration."
      });

    }

    res.status(201).json({

      success: true,

      message:
        "Registration successful.",

      player:
        newPlayer

    });

  } catch (error) {

    console.error(
      "Registration error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Registration failed."
    });

  }

});

// ==========================================
// TOURNAMENT STATS
// ==========================================

app.get("/api/stats", (req, res) => {

  try {

    const players =
      getPlayers();

    const paidPlayers =
      players.filter(
        (player) =>
          player.payment === "paid"
      );

    const totalKills =
      players.reduce(
        (total, player) =>
          total +
          Number(player.kills || 0),
        0
      );

    const totalBonus =
      players.reduce(
        (total, player) =>
          total +
          calculateBonus(player),
        0
      );

    res.json({

      totalSlots:
        TOTAL_SLOTS,

      bookedSlots:
        players.length,

      available