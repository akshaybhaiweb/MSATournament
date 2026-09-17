/* =====================================================
   FF SOLO TOURNAMENT
   DATABASE.JS
   =====================================================

   Temporary browser database using localStorage.

   Data:
   - Players
   - 48 Slots
   - Payment status
   - Kills
   - Booyah
   - Registration time
   ===================================================== */


/* ================================
   DATABASE KEY
================================ */

const DATABASE_KEY = "ff_tournament_players";


/* ================================
   GET ALL PLAYERS
================================ */

function getPlayers() {

    const data =
        localStorage.getItem(DATABASE_KEY);

    if (!data) {
        return [];
    }

    try {

        return JSON.parse(data);

    } catch (error) {

        console.error(
            "Database read error:",
            error
        );

        return [];

    }
}


/* ================================
   SAVE PLAYERS
================================ */

function savePlayers(players) {

    localStorage.setItem(
        DATABASE_KEY,
        JSON.stringify(players)
    );

}


/* ================================
   ADD PLAYER
================================ */

function addPlayer(playerData) {

    const players = getPlayers();


    /* Check 48 slots */

    if (players.length >= 48) {

        return {
            success: false,
            message: "All 48 slots are full."
        };

    }


    /* Check selected slot */

    const slotTaken =
        players.some(
            player =>
                Number(player.slot) ===
                Number(playerData.slot)
        );


    if (slotTaken) {

        return {
            success: false,
            message: "This slot is already booked."
        };

    }


    /* Check duplicate UID */

    const duplicateUID =
        players.some(
            player =>
                player.uid ===
                String(playerData.uid)
        );


    if (duplicateUID) {

        return {
            success: false,
            message: "This UID is already registered."
        };

    }


    /* Create player */

    const newPlayer = {

        id:
            Date.now(),

        name:
            String(playerData.name)
                .trim(),

        uid:
            String(playerData.uid)
                .trim(),

        ign:
            String(playerData.ign)
                .trim(),

        slot:
            Number(playerData.slot),

        payment:
            "pending",

        kills:
            0,

        booyah:
            false,

        registeredAt:
            new Date().toISOString()

    };


    players.push(newPlayer);

    savePlayers(players);


    return {

        success: true,

        message:
            "Registration successful.",

        player:
            newPlayer

    };

}


/* ================================
   FIND PLAYER
================================ */

function getPlayerBySlot(slot) {

    const players = getPlayers();

    return players.find(
        player =>
            Number(player.slot) ===
            Number(slot)
    ) || null;

}


/* ================================
   FIND PLAYER BY UID
================================ */

function getPlayerByUID(uid) {

    const players = getPlayers();

    return players.find(
        player =>
            player.uid ===
            String(uid)
    ) || null;

}


/* ================================
   CHECK SLOT
================================ */

function isSlotAvailable(slot) {

    const player =
        getPlayerBySlot(slot);

    return player === null;

}


/* ================================
   GET AVAILABLE SLOTS
================================ */

function getAvailableSlots() {

    const players =
        getPlayers();

    const available = [];


    for (
        let slot = 1;
        slot <= 48;
        slot++
    ) {

        const booked =
            players.some(
                player =>
                    Number(player.slot) === slot
            );


        if (!booked) {
            available.push(slot);
        }

    }


    return available;

}


/* ================================
   GET BOOKED SLOTS
================================ */

function getBookedSlots() {

    const players =
        getPlayers();

    return players.map(
        player =>
            Number(player.slot)
    );

}


/* ================================
   UPDATE PAYMENT
================================ */

function updatePayment(
    slot,
    status
) {

    const players =
        getPlayers();


    const player =
        players.find(
            p =>
                Number(p.slot) ===
                Number(slot)
        );


    if (!player) {

        return {
            success: false,
            message: "Player not found."
        };

    }


    if (
        status !== "paid" &&
        status !== "pending"
    ) {

        return {
            success: false,
            message: "Invalid payment status."
        };

    }


    player.payment =
        status;


    savePlayers(players);


    return {
        success: true,
        message: "Payment status updated."
    };

}


/* ================================
   UPDATE RESULT
================================ */

function updateResult(
    slot,
    kills,
    booyah
) {

    const players =
        getPlayers();


    const player =
        players.find(
            p =>
                Number(p.slot) ===
                Number(slot)
        );


    if (!player) {

        return {
            success: false,
            message: "Player not found."
        };

    }


    player.kills =
        Math.max(
            0,
            Number(kills) || 0
        );


    player.booyah =
        Boolean(booyah);


    savePlayers(players);


    return {
        success: true,
        message: "Result updated.",
        player: player
    };

}


/* ================================
   REMOVE PLAYER
================================ */

function removePlayer(slot) {

    const players =
        getPlayers();


    const newPlayers =
        players.filter(
            player =>
                Number(player.slot) !==
                Number(slot)
        );


    if (
        newPlayers.length ===
        players.length
    ) {

        return {
            success: false,
            message: "Player not found."
        };

    }


    savePlayers(newPlayers);


    return {
        success: true,
        message: "Player removed."
    };

}


/* ================================
   GET TOURNAMENT STATS
================================ */

function getTournamentStats() {

    const players =
        getPlayers();


    const booked =
        players.length;


    const available =
        48 - booked;


    const paid =
        players.filter(
            player =>
                player.payment === "paid"
        ).length;


    const pending =
        players.filter(
            player =>
                player.payment === "pending"
        ).length;


    return {

        totalSlots: 48,

        bookedSlots:
            booked,

        availableSlots:
            available,

        paidPlayers:
            paid,

        pendingPayments:
            pending

    };

}


/* ================================
   CLEAR DATABASE
================================ */

function clearDatabase() {

    localStorage.removeItem(
        DATABASE_KEY
    );

}


/* ================================
   EXPORT
================================ */

window.TournamentDB = {

    getPlayers,

    savePlayers,

    addPlayer,

    getPlayerBySlot,

    getPlayerByUID,

    isSlotAvailable,

    getAvailableSlots,

    getBookedSlots,

    updatePayment,

    updateResult,

    removePlayer,

    getTournamentStats,

    clearDatabase

};