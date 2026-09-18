```js
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const TOTAL_SLOTS = 48;
const ENTRY_FEE = 16;
const KILL_BONUS = 50;
const BOOYAH_BONUS = 50;

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "players.json");

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Create database folder/file
function setupDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf8");
  }
}

setupDatabase();

// Read players
function getPlayers() {
  try {
    const data = fs.readFileSync(DATA_FILE, "utf8");

    if (!data.trim()) {
      return [];
    }

    const players = JSON.parse(data);

    return Array.isArray(players) ? players : [];
  } catch (error) {
    console.error("READ DATABASE ERROR:", error);
    return [];
  }
}

// Save players
function savePlayers(players) {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(players, null, 2),
      "utf8"
    );

    return true;
  } catch (error) {
    console.error("SAVE DATABASE ERROR:", error);
    return false;
  }
}

// Calculate bonus
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
// WEBSITE
// ==========================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "tournament.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// ==========================================
// HEALTH
// ==========================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "online",
    server: "FF Tournament Server",
    time: new Date().toISOString()
  });
});

// ==========================================
// PLAYERS
// ==========================================

app.get("/api/players", (req, res) => {
  const players = getPlayers();

  res.json(
    players.map((player) => ({
      ...player,
      bonus: calculateBonus(player)
    }))
  );
});

// ==========================================
// SLOTS
// ==========================================

app.get("/api/slots", (req, res) => {
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

  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    if (!bookedSlots.includes(slot)) {
      availableSlots.push(slot);
    }
  }

  res.json({
    totalSlots: TOTAL_SLOTS,
    bookedSlots,
    availableSlots
  });
});

// ==========================================
// REGISTER
// ==========================================

app.post("/api/register", (req, res) => {
  try {
    const playerName = String(
      req.body.playerName || ""
    ).trim();

    const uid = String(
      req.body.uid || ""
    ).trim();

    const ign = String(
      req.body.ign || ""
    ).trim();

    const slot = Number(req.body.slot);

    if (!playerName || !uid || !ign) {
      return res.status(400).json({
        success: false,
        message: "All fields are required."
      });
    }

    if (
      !Number.isInteger(slot) ||
      slot < 1 ||
      slot > TOTAL_SLOTS
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid slot."
      });
    }

    const players = getPlayers();

    if (
      players.some(
        (player) => Number(player.slot) === slot
      )
    ) {
      return res.status(409).json({
        success: false,
        message: "This slot is already booked."
      });
    }

    if (
      players.some(
        (player) =>
          String(player.uid).trim() === uid
      )
    ) {
      return res.status(409).json({
        success: false,
        message: "This UID is already registered."
      });
    }

    const player = {
      id: Date.now().toString(),
      playerName,
      uid,
      ign,
      slot,
      payment: "pending",
      kills: 0,
      booyah: false,
      bonus: 0,
      registeredAt: new Date().toISOString()
    };

    players.push(player);

    if (!savePlayers(players)) {
      return res.status(500).json({
        success: false,
        message: "Could not save player."
      });
    }

    res.status(201).json({
      success: true,
      message: "Registration successful.",
      player
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Registration failed."
    });
  }
});

// ==========================================
// STATS
// ==========================================

app.get("/api/stats", (req, res) => {
  const players = getPlayers();

  const paidPlayers = players.filter(
    (player) => player.payment === "paid"
  );

  const totalKills = players.reduce(
    (total, player) =>
      total + Number(player.kills || 0),
    0
  );

  const totalBonus = players.reduce(
    (total, player) =>
      total + calculateBonus(player),
    0
  );

  res.json({
    totalSlots: TOTAL_SLOTS,
    totalPlayers: players.length,
    bookedSlots: players.length,
    availableSlots:
      TOTAL_SLOTS - players.length,
    paidPlayers: paidPlayers.length,
    totalKills,
    totalBonus,
    entryFee: ENTRY_FEE
  });
});

// ==========================================
// PAYMENT
// ==========================================

app.patch(
  "/api/players/:slot/payment",
  (req, res) => {
    const slot = Number(req.params.slot);
    const payment = req.body.payment;

    if (
      payment !== "paid" &&
      payment !== "pending"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status."
      });
    }

    const players = getPlayers();

    const player = players.find(
      (p) => Number(p.slot) === slot
    );

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player not found."
      });
    }

    player.payment = payment;

    if (!savePlayers(players)) {
      return res.status(500).json({
        success: false,
        message: "Could not save payment."
      });
    }

    res.json({
      success: true,
      message: "Payment updated.",
      player
    });
  }
);

// ==========================================
// RESULT
// ==========================================

app.patch(
  "/api/players/:slot/result",
  (req, res) => {
    const slot = Number(req.params.slot);

    const players = getPlayers();

    const player = players.find(
      (p) => Number(p.slot) === slot
    );

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player not found."
      });
    }

    let kills = Number(req.body.kills);

    if (!Number.isFinite(kills)) {
      kills = 0;
    }

    kills = Math.max(
      0,
      Math.floor(kills)
    );

    player.kills = kills;

    player.booyah =
      req.body.booyah === true ||
      req.body.booyah === "true";

    player.bonus =
      calculateBonus(player);

    if (!savePlayers(players)) {
      return res.status(500).json({
        success: false,
        message: "Could not save result."
      });
    }

    res.json({
      success: true,
      message: "Result updated.",
      player
    });
  }
);

// ==========================================
// DELETE PLAYER
// ==========================================

app.delete(
  "/api/players/:slot",
  (req, res) => {
    const slot = Number(req.params.slot);

    const players = getPlayers();

    const exists = players.some(
      (player) =>
        Number(player.slot) === slot
    );

    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Player not found."
      });
    }

    const updatedPlayers =
      players.filter(
        (player) =>
          Number(player.slot) !== slot
      );

    if (!savePlayers(updatedPlayers)) {
      return res.status(500).json({
        success: false,
        message: "Could not remove player."
      });
    }

    res.json({
      success: true,
      message: "Player removed."
    });
  }
);

// ==========================================
// START
// ==========================================

app.listen(PORT, () => {
  console.log(
    `FF Tournament Server running on port ${PORT}`
  );
});
```