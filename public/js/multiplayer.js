let socket = io();
let myColor = "";
let roomID = "";

let handlePlayerChange = (data) => {
    let playerIDs = [];
    let players = $("#players");

    // Add new players
    for (let i = 0; i < data.players.length; i++) {
        let player = data.players[i];
        playerIDs.push(player.socket_id);

        if ($("#" + player.socket_id).length < 1) {
            // Add player
            players.append("<p id='" + player.socket_id + "'><span id='" + player.socket_id + "_span' " +
                "style='display: inline-block; width: 10px; height: 10px; background-color: " + player.color +
                "; border: 1px solid black;'></span> " + player.name + "</p>");
        }
    }

    // Remove old players
    players.children().each((player) => {
        if(!playerIDs.includes(players.children()[player].id)) {
            $("#" + players.children()[player].id).remove();
        }
    });
};

let handleStateChange = (data) => {
    const gameState = data.newState.gameState;
    const playerState  = data.newState.playerState;

    for(let i = 0; i < gameState.length; i++) {
        let game = $("#game_" + i);

        if(gameState[i]) {
            game.removeClass("gray");
            game.addClass("on");
        }
        else {
            game.removeClass("on");
            game.addClass("gray");
        }
    }

    for(let j = 0; j < 4; j++) $("#button_" + j).removeClass("colorFilter");
    for(let i = 0; i < playerState.length; i++) {
        if(playerState[i].buttonID) {
            let button = $("#button_" + playerState[i].buttonID);
            // if(playerState[i].id !== socket.id) button.addClass("preventClick");
            button.css("--playerColor", $("#" + playerState[i].id + "_span").css("backgroundColor"));
            button.addClass("colorFilter");
        }
    }
};

const eventListeners = {
    "playerChange": handlePlayerChange,
    "stateChange": handleStateChange
};

// Setup event handlers for socket
for (let event in eventListeners) {
    if (eventListeners.hasOwnProperty(event)) {
        socket.on(event, eventListeners[event]);
        console.log("Registered", event, "event");
    }
}

let input = (el) => {
    buttonID = el.id.substr(-1);
    console.log("Clicked on:", buttonID);
    socket.emit("submitStateChange", {
        roomID: roomID,
        button: buttonID
    });
};

let unclick = (el) => {
    buttonID = el.id.substr(-1);
    console.log("Released:", buttonID);
    socket.emit("submitStateChange", {
        roomID: roomID,
        gameObject: buttonID,
        button: null
    });
};

let enterRoom = async () => {
    let name = $("#name").val();

    if (!name) {
        alert("Please enter a name");
        return;
    }

    // Assign a color for yourself
    myColor = randomColor();

    const res = await fetch("/room", {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: name,
            color: myColor,
            socketID: socket.id
        })
    });

    const body = await res.json();

    if (body.error) {
        // Handle error
        return
    }

    roomID = body.roomID;
    console.log("Joined room", roomID);

    // Show the game
    $("#enter").hide();
    $("#game").show();
};