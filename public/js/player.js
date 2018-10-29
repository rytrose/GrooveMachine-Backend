const SAMPLE = 0;
const HIGHPASS = 1;
const LOWPASS = 2;
const numModFilesPerSample = 3;
const numSamplePacks = 4;
const samplesPerPack = 12;
const numTotalFiles = numModFilesPerSample * numSamplePacks * samplesPerPack;
let numFilesLoaded = 0;

class Player {
    constructor(baseURL) {
        // N.B. SHOULD INCLUDE TRAILING SLASH
        this.baseURL = baseURL;
        this.sequencer = null;
    }

    loadSounds(callback) {
        console.log("Loading sounds...");
        this.sounds = [];

        const baseName = "SampleSet";
        let sampleNames = this.generateFileNames(baseName, "");
        let highpassNames = this.generateFileNames(baseName, "Highpass");
        let lowpassNames = this.generateFileNames(baseName, "Lowpass");

        let sampleSettings = {
            "volume": 0,
            "onload": (players) => {
                console.log("Loaded samples.");
                players.toMaster();
            }
        };

        let highpassSettings = {
            "volume": 0,
            "onload": (players) => {
                console.log("Loaded highpass samples.");
                players.toMaster();
            }
        };

        let lowpassSettings = {
            "volume": 0,
            "onload": (players) => {
                console.log("Loaded lowpass samples.");
                players.toMaster();
            }
        };

        this.sounds[SAMPLE] = new Tone.Players(sampleNames, sampleSettings);
        this.sounds[HIGHPASS] = new Tone.Players(highpassNames, highpassSettings);
        this.sounds[LOWPASS] = new Tone.Players(lowpassNames, lowpassSettings);

        Tone.Buffer.on("load", callback);
    }

    generateFileNames(baseName, type) {
        let names = {};

        let typeName = type;
        if (typeName !== "") typeName = type + "_";

        // Define a naming convention for accessing a sample file
        // SamplePackNumber_ID
        // [0-4]-[0-11]
        for (let pack = 0; pack < numSamplePacks; pack++) {
            for (let id = 0; id < samplesPerPack; id++) {
                // Pack names are 1-indexed
                let packName = pack + 1;
                // ID names are 1-indexed
                let idName = id + 1;
                // ID names are 2-digit zero-padded
                if (idName < 10) idName = "0" + idName;
                names[pack + "_" + id] = this.baseURL + baseName + packName + "_" + typeName + idName + ".wav";
            }
        }

        return names
    }

    defineSequencer(onStep) {
        this.sequencer = new Tone.Sequence((time, step) => onStep(time, step, this.sounds), range(8), "2n");
    }

    getOfflineSounds() {
        let offlineSounds = Array.from(new Array(numModFilesPerSample), () => null);

        // Samples
        let sampleBuffers = {};
        for(let name in this.sounds[SAMPLE]._players) sampleBuffers[name] = this.sounds[SAMPLE]._players[name]._buffer;
        offlineSounds[SAMPLE] = new Tone.Players(sampleBuffers).toMaster();

        // Highpass
        let highpassBuffers = {};
        for(let name in this.sounds[HIGHPASS]._players) highpassBuffers[name] = this.sounds[HIGHPASS]._players[name]._buffer;
        offlineSounds[HIGHPASS] = new Tone.Players(highpassBuffers).toMaster();

        // Lowpass
        let lowpassBuffers = {};
        for(let name in this.sounds[LOWPASS]._players) lowpassBuffers[name] = this.sounds[LOWPASS]._players[name]._buffer;
        offlineSounds[LOWPASS] = new Tone.Players(lowpassBuffers).toMaster();

        return offlineSounds;
    }

    renderOut() {
        Tone.Offline((Transport) => {
            let offlineSounds = this.getOfflineSounds();
            let offlineSequencer = new Tone.Sequence((time, step) => onStep(time, step, offlineSounds), range(8), "2n");
            offlineSequencer.start();
            Transport.start();
        }, this.sequencer.length).then((buffer) => {
            let wav = audioBufferToWav(buffer._buffer);
            let blob = new window.Blob([ new DataView(wav) ], {
                type: 'audio/wav'
            });

            let url = window.URL.createObjectURL(blob);

            // Prompts a download
            let anchor = document.createElement('a');
            document.body.appendChild(anchor);
            anchor.style = 'display: none';
            anchor.href = url;
            anchor.download = 'audio.wav';
            anchor.click();

            window.URL.revokeObjectURL(url);
        });
    }

}