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

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(express.json());
app.use(express.static(__dirname));

// ==========================================
// DATABASE SETUP
// ==========================================

function setupDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, "[]", "utf8");
    }
  } catch (error) {
    console.error("DATABASE SETUP ERROR:", error);
  }
}

setupDatabase();

// ==========================================
// READ PLAYERS
// ==========================================

function getPlayers() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      setupDatabase();
    }

    const data = fs.readFileSync(DATA_FILE, "utf8");

    if (!data.trim()) {
      return [];
    }

    const players = JSON.parse(data);

    if (!Array.isArray(players)) {
      return [];
    }

    return players;
  } catch (error) {
    console.error("READ DATABASE ERROR:", error);
    return [];
  }
}

// ==========================================
// SAVE PLAYERS
// ==========================================

function savePlayers(players) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

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

// ==========================================
// CALCULATE BONUS
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
// WEBSITE
// ==========================================

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "tournament.html")
  );
});

app.get("/admin", (req, res) => {
  res.sendFile(
    path.join(__dirname, "admin.html")
  );
});

// ==========================================
// HEALTH CHECK
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
// GET ALL PLAYERS
// ==========================================

app.get("/api/players", (req, res) => {
  try {
    const players = getPlayers();

    const result = players.map((player) => ({
      ...player,
      bonus: calculateBonus(player)
    }));

    res.json(result);
  } catch (error) {
    console.error("GET PLAYERS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Could not load players."
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

    for (
      let slot = 1;
      slot <= TOTAL_SLOTS;
      slot++
    ) {
      if (!bookedSlots.includes(slot)) {
        availableSlots.push(slot);
      }
    }

    res.json({
      totalSlots: TOTAL_SLOTS,
      bookedSlots,
      availableSlots
    });
  } catch (error) {
    console.error("GET SLOTS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Could not load slots."
    });
  }
});

// ==========================================
// REGISTER PLAYER
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

    // Check required fields
    if (!playerName || !uid || !ign) {
      return res.status(400).json({
        success: false,
        message: "All fields are required."
      });
    }

    // Check slot
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

    // Check duplicate slot
    const slotAlreadyBooked = players.some(
      (player) =>
        Number(player.slot) === slot
    );

    if (slotAlreadyBooked) {
      return res.status(409).json({
        success: false,
        message: "This slot is already booked."
      });
    }

    // Check duplicate UID
    const uidAlreadyRegistered = players.some(
      (player) =>
        String(player.uid).trim() === uid
    );

    if (uidAlreadyRegistered) {
      return res.status(409).json({
        success: false,
        message: "This UID is already registered."
      });
    }

    // Create player
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

    // Save
    const saved = savePlayers(players);

    if (!saved) {
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
  try {
    const players = getPlayers();

    const paidPlayers = players.filter(
      (player) =>
        player.payment === "paid"
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

  } catch (error) {
    console.error("STATS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Could not load stats."
    });
  }
});

// ==========================================
// PAYMENT STATUS
// ==========================================

app.patch(
  "/api/players/:slot/payment",
  (req, res) => {
    try {
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

      const saved = savePlayers(players);

      if (!saved) {
        return res.status(500).json({
          success: false,
          message: "Could not save payment status."
        });
      }

      res.json({
        success: true,
        message: "Payment status updated.",
        player
      });

    } catch (error) {
      console.error(
        "PAYMENT UPDATE ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Could not update payment status."
      });
    }
  }
);

// ==========================================
// UPDATE RESULT
// ==========================================

app.patch(
  "/api/players/:slot/result",
  (req, res) => {
    try {
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

      let kills = Number(
        req.body.kills
      );

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

      const saved = savePlayers(players);

      if (!saved) {
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

    } catch (error) {
      console.error(
        "RESULT UPDATE ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Could not update result."
      });
    }
  }
);

// ==========================================
// DELETE PLAYER
// ==========================================

app.delete(
  "/api/players/:slot",
  (req, res) => {
    try {
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

      const saved =
        savePlayers(updatedPlayers);

      if (!saved) {
        return res.status(500).json({
          success: false,
          message: "Could not remove player."
        });
      }

      res.json({
        success: true,
        message: "Player removed."
      });

    } catch (error) {
      console.error(
        "DELETE PLAYER ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Could not remove player."
      });
    }
  }
);

// ==========================================
// 404 API HANDLER
// ==========================================

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found."
  });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(
    `FF Tournament Server running on port ${PORT}`
  );
});