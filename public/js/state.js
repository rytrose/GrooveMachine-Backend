let state = {
    0: "hi",
    1: "bye"
};

let player = new Player("https://s3.amazonaws.com/rytrose-personal-website/groove-machine-sounds/");

let onStep = (time, step, sounds) => {
    console.log("oh shit, the state is", state);
    sounds[0].get("0_" + step).start();
};

player.loadSounds(() => {
    console.log("...sounds loaded.");
    player.defineSequencer(onStep);

    Tone.Transport.start();
});