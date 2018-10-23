const express = require('express');
const path = require('path');
const uuidv4 = require('uuid/v4');
const {Pool} = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true
});

let client;

let connect = async () => {
    client = await pool.connect();
};

connect();

// Set up express
let app = express();
let server = require('http').createServer(app);
let io = require('socket.io')(server);
const PORT = process.env.PORT || 5004;

const initialState = {
    gameState: [false, false, false, false],
    playerState: []
};

// Serve files from 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Expect body in json
app.use(express.json());

// One path, root
app.get('/', (req, res) => {
    res.sendFile('public/index.html');
});

app.post("/room", async (req, res) => {
    let name = req.body.name;
    let socketID = req.body.socketID;
    let color = req.body.color;

    // const client = await pool.connect();

    try {
        // Make sure this happens as a transaction
        await client.query("BEGIN");

        // Get a list of empty rooms
        const emptyRooms = await client.query("SELECT room_id FROM rooms WHERE num_players < 4");

        let roomID;
        if (emptyRooms.rows.length > 0) { // There exists a room to join
            // Join the room
            roomID = emptyRooms.rows[0].room_id;

            // Increment number of members in the room
            await client.query("UPDATE rooms SET " +
                "num_players = 1 + (SELECT num_players FROM rooms WHERE room_id = $1) WHERE room_id = $1", [roomID]);
        }
        else { // Need to create a room
            // Create the room
            roomID = uuidv4();

            // Add room to database
            await client.query("INSERT INTO rooms(room_id, num_players, state) VALUES ($1, $2, $3)",
                [roomID, 1, JSON.stringify(initialState)]);
        }

        // Create a new player entry
        await client.query("INSERT INTO players(room_id, name, socket_id, color) VALUES ($1, $2, $3, $4)",
            [roomID, name, socketID, color]);

        // Get all players
        const roomPlayers = await client.query("SELECT * FROM players WHERE room_id = $1", [roomID]);

        // Add player to state
        const roomState = await client.query("SELECT state FROM rooms WHERE room_id = $1", [roomID]);
        let roomStateJson = roomState.rows[0].state;
        roomStateJson.playerState.push({
            id: socketID,
            buttonID: null
        });
        await client.query("UPDATE rooms SET state = $1 WHERE room_id = $2", [JSON.stringify(roomStateJson), roomID]);

        // Commit the SQL transaction
        await client.query("COMMIT");

        // Add socket to room
        io.sockets.sockets[socketID].join(roomID);
        console.log("Added socket", socketID, "to room", roomID);

        // Add handler for state change
        io.sockets.sockets[socketID].on("submitStateChange", async (data) => {
            let roomID = data.roomID;
            // const client = await pool.connect();

            try {
                // Make sure this happens as a transaction
                await client.query("BEGIN");

                // Get old state
                const roomState = await client.query("SELECT state FROM rooms WHERE room_id = $1", [roomID]);
                let roomStateJson = roomState.rows[0].state;

                // Handle input state change
                if(data.button !== undefined) {
                    for(let i = 0; i < roomStateJson.playerState.length; i++) {
                        let player = roomStateJson.playerState[i];
                        if(player.id === socketID) {
                            player.buttonID = data.button;
                            break;
                        }
                    }
                }

                // Handle game state change
                if(data.gameObject !== undefined) {
                    roomStateJson.gameState[data.gameObject] = !roomStateJson.gameState[data.gameObject];
                }

                // Set new state
                await client.query("UPDATE rooms SET state = $1 WHERE room_id = $2", [JSON.stringify(roomStateJson), roomID]);

                // Update the room with the newest state
                io.to(roomID).emit('stateChange', {
                    newState: roomStateJson
                });

                await client.query("COMMIT");
            }
            catch (err) {
                // Database error
                await client.query("ROLLBACK");
                console.log(err);
            }
            finally {
                // Release the database connection
                // client.release();
            }
        });

        // Add handler for on disconnect
        io.sockets.sockets[socketID].on("disconnect", async (data) => {
            console.log("Socket", socketID, "disconnected.");
            try {
                // Make sure this happens as a transaction
                await client.query("BEGIN");

                // Delete player from DB
                await client.query("DELETE FROM players WHERE socket_id = $1", [socketID]);

                // Get new number of players
                const numPlayersQuery = await client.query("SELECT COUNT(*) FROM players WHERE room_id = $1", [roomID]);
                let numPlayers = numPlayersQuery.rows[0].count;

                if(numPlayers > 0) { // Update room if still people in it
                    // Decrement number of members in the room
                    await client.query("UPDATE rooms SET num_players = $1 WHERE room_id = $2", [numPlayers, roomID]);

                    // Remove player from playerState
                    const roomState = await client.query("SELECT state FROM rooms WHERE room_id = $1", [roomID]);
                    let roomStateJson = roomState.rows[0].state;
                    roomStateJson.playerState = roomStateJson.playerState.filter( player => player.socketID !== socketID );
                    await client.query("UPDATE rooms SET state = $1 WHERE room_id = $2", [JSON.stringify(roomStateJson), roomID]);

                    // Get all players
                    const roomPlayers = await client.query("SELECT * FROM players WHERE room_id = $1", [roomID]);

                    // Tell the room there is a player change
                    io.to(roomID).emit('playerChange', {
                        players: roomPlayers.rows
                    });

                } else { // Otherwise delete the room
                    await client.query("DELETE FROM rooms WHERE room_id = $1", [roomID]);
                }

                await client.query("COMMIT");
            }
            catch (err) {
                // Database error
                await client.query("ROLLBACK");
                console.log(err);
            }
        });

        // Tell the room there is a player change
        io.to(roomID).emit('playerChange', {
            players: roomPlayers.rows
        });
        
        // Update the room with the newest state
        io.to(roomID).emit('stateChange', {
            newState: roomStateJson
        });

        // Return roomID
        res.json({
            roomID: roomID
        });
    } catch (err) {
        // Database error
        await client.query("ROLLBACK");
        console.log(err);
        res.json({
            error: err
        });
    } finally {
        // Release the database connection
        // client.release();
    }
});

io.on('test', (data) => { console.log("Server received:", data); });

// Serve the page
server.listen(PORT, () => console.log(`Serving at localhost:${PORT}`));