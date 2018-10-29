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
        this.loaded = Array.from(new Array(numModFilesPerSample), () => false);
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
                numFilesLoaded++;
                console.log("Loaded samples.");
                this.loaded[SAMPLE] = true;

                // Check if last to load, if so, callback
                if(this.loaded.every((e) => e)) callback();

                players.toMaster();
            }
        };

        let highpassSettings = {
            "volume": 0,
            "onload": (players) => {
                numFilesLoaded++;
                console.log("Loaded highpass samples.");
                this.loaded[HIGHPASS] = true;

                // Check if last to load, if so, callback
                if(this.loaded.every((e) => e)) callback();

                players.toMaster();
            }
        };

        let lowpassSettings = {
            "volume": 0,
            "onload": (players) => {
                numFilesLoaded++;
                console.log("Loaded lowpass samples.");
                this.loaded[LOWPASS] = true;

                // Check if last to load, if so, callback
                if(this.loaded.every((e) => e)) callback();

                players.toMaster();
            }
        };

        this.sounds[SAMPLE] = new Tone.Players(sampleNames, sampleSettings);
        this.sounds[HIGHPASS] = new Tone.Players(highpassNames, highpassSettings);
        this.sounds[LOWPASS] = new Tone.Players(lowpassNames, lowpassSettings);
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
        this.sequencer = new Tone.Sequence((time, step) => onStep(), range(8), "2n");
    }

}