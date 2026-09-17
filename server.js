const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Data folder/file
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "players.json");

// Tournament settings
const TOTAL_SLOTS = 48;
const ENTRY_FEE = 16;
const KILL_BONUS = 50;
const BOOYAH_BONUS = 50;

// Create data folder/file if they don't exist
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, "[]", "utf8");
}

// Read players
function getPlayers() {
    try {
        const data = fs.readFileSync(dataFile, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Database read error:", error);
        return [];
    }
}

// Save players
function savePlayers(players) {
    fs.writeFileSync(
        dataFile,
        JSON.stringify(players, null, 2),
        "utf8"
    );
}

// Calculate bonus
function calculateBonus(player) {
    let bonus = 0;

    if (Number(player.kills) >= 10) {
        bonus += KILL_BONUS;
    }

    if (player.booyah === true) {
        bonus += BOOYAH_BONUS;
    }

    return bonus;
}

// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "tournament.html"));
});

// ===============================
// GET ALL PLAYERS
// ===============================

app.get("/api/players", (req, res) => {
    const players = getPlayers();

    const updatedPlayers = players.map(player => ({
        ...player,
        bonus: calculateBonus(player)
    }));

    res.json(updatedPlayers);
});

// ===============================
// GET AVAILABLE SLOTS
// ===============================

app.get("/api/slots", (req, res) => {
    const players = getPlayers();

    const bookedSlots = players.map(player => Number(player.slot));

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
});

// ===============================
// REGISTER PLAYER
// ===============================

app.post("/api/register", (req, res) => {
    const { playerName, uid, ign, slot } = req.body;

    // Basic validation
    if (!playerName || !uid || !ign || !slot) {
        return res.status(400).json({
            success: false,
            message: "All fields are required."
        });
    }

    const slotNumber = Number(slot);

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

    // Check slot
    const slotTaken = players.some(
        player => Number(player.slot) === slotNumber
    );

    if (slotTaken) {
        return res.status(409).json({
            success: false,
            message: "This slot is already booked."
        });
    }

    // Check UID
    const uidExists = players.some(
        player => String(player.uid) === String(uid)
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
        playerName: String(playerName).trim(),
        uid: String(uid).trim(),
        ign: String(ign).trim(),
        slot: slotNumber,

        payment: "pending",

        kills: 0,
        booyah: false,

        bonus: 0,

        registeredAt: new Date().toISOString()
    };

    players.push(newPlayer);
    savePlayers(players);

    res.status(201).json({
        success: true,
        message: "Registration successful.",
        player: newPlayer
    });
});

// ===============================
// TOURNAMENT STATS
// ===============================

app.get("/api/stats", (req, res) => {
    const players = getPlayers();

    const paidPlayers = players.filter(
        player => player.payment === "paid"
    );

    const totalKills = players.reduce(
        (total, player) => total + Number(player.kills || 0),
        0
    );

    const totalBonus = players.reduce(
        (total, player) => total + calculateBonus(player),
        0
    );

    res.json({
        totalSlots: TOTAL_SLOTS,
        bookedSlots: players.length,
        availableSlots: TOTAL_SLOTS - players.length,

        entryFee: ENTRY_FEE,

        totalPlayers: players.length,
        paidPlayers: paidPlayers.length,

        totalKills,
        totalBonus
    });
});

// ===============================
// UPDATE PAYMENT STATUS
// ===============================

app.patch("/api/players/:slot/payment", (req, res) => {
    const slot = Number(req.params.slot);
    const { payment } = req.body;

    if (!["paid", "pending"].includes(payment)) {
        return res.status(400).json({
            success: false,
            message: "Payment must be paid or pending."
        });
    }

    const players = getPlayers();

    const player = players.find(
        p => Number(p.slot) === slot
    );

    if (!player) {
        return res.status(404).json({
            success: false,
            message: "Player not found."
        });
    }

    player.payment = payment;

    savePlayers(players);

    res.json({
        success: true,
        message: "Payment status updated.",
        player
    });
});

// ===============================
// UPDATE RESULT
// ===============================

app.patch("/api/players/:slot/result", (req, res) => {
    const slot = Number(req.params.slot);
    const { kills, booyah } = req.body;

    const players = getPlayers();

    const player = players.find(
        p => Number(p.slot) === slot
    );

    if (!player) {
        return res.status(404).json({
            success: false,
            message: "Player not found."
        });
    }

    player.kills = Math.max(0, Number(kills) || 0);
    player.booyah = Boolean(booyah);

    player.bonus = calculateBonus(player);

    savePlayers(players);

    res.json({
        success: true,
        message: "Result updated.",
        player
    });
});

// ===============================
// DELETE / REMOVE PLAYER
// ===============================

app.delete("/api/players/:slot", (req, res) => {
    const slot = Number(req.params.slot);

    const players = getPlayers();

    const playerExists = players.some(
        p => Number(p.slot) === slot
    );

    if (!playerExists) {
        return res.status(404).json({
            success: false,
            message: "Player not found."
        });
    }

    const updatedPlayers = players.filter(
        p => Number(p.slot) !== slot
    );

    savePlayers(updatedPlayers);

    res.json({
        success: true,
        message: "Player removed successfully."
    });
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
    console.log("-----------------------------------");
    console.log("FF Tournament Server Started");
    console.log(`http://localhost:${PORT}`);
    console.log("-----------------------------------");
});