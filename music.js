const MUSIC = {};

//based on https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_Web_Audio_API
//and https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();

async function loadSource(url) {
	return new Promise((resolve, reject) => {
		let xhr = new XMLHttpRequest();
		xhr.addEventListener('load', () => {
			audioContext.decodeAudioData(xhr.response,
				resolve,
				() => { reject("audio decoding error for '" + url + "'"); }
			);
		});
		xhr.addEventListener('error', () => {
			reject("Error loading '" + url + "'.");
		});
		xhr.open('GET', url);
		xhr.responseType = 'arraybuffer';
		xhr.send();
	});
};

MUSIC.load = async function() {
	this.tracks = [
		await loadSource('background/bass.wav'),
		await loadSource('background/arp.wav'),
		await loadSource('background/drums2.wav'),
		await loadSource('background/drums1.wav'),
		await loadSource('background/pads.wav')
	];
};

MUSIC.stopFunctions = [];

MUSIC.stop = function() {
	this.stopFunctions.forEach((fn) => fn());
	this.stopFunctions.splice(0);
	audioContext.suspend();
};

MUSIC.play = function(bpm, startBeat, endBeat, mutes, time) {
	//clear out anything still playing:
	this.stopFunctions.forEach((fn) => fn());
	this.stopFunctions.splice(0);

	audioContext.resume(); //<-- just in case

	const now = audioContext.currentTime;
	const beatsToSeconds = 60.0 / bpm;
	const timeBeat = Math.floor(time / beatsToSeconds);

	//schedule up a new segment of track:
	for (let t = 0; t < this.tracks.length; ++t) {
		const source = audioContext.createBufferSource();
		source.buffer = this.tracks[t];
		const gain = audioContext.createGain();
		if (mutes.length > t) {
			const m = mutes[t];
			if (m[timeBeat]) {
				gain.gain.value = 0.0;
			} else {
				gain.gain.value = 1.0;
			}
			for (let beat = timeBeat + 1; beat < endBeat; ++beat) {
				if (m[beat] != m[beat-1]) {
					const t0 = beat * beatsToSeconds - time + now;
					const t1 = t0 + 1.0 / 60.0;
					if (m[beat]) {
						gain.gain.setValueAtTime(1.0, t0);
						gain.gain.linearRampToValueAtTime(0.0, t1);
					} else {
						gain.gain.setValueAtTime(0.0, t0);
						gain.gain.linearRampToValueAtTime(1.0, t1);
					}
				}
			}
		}

		source.connect(gain);
		gain.connect(audioContext.destination);
		source.start(now, time, endBeat * beatsToSeconds - time);
		this.stopFunctions.push(() => {
			source.stop();
			source.disconnect();
			gain.disconnect();
		});
		window.DEBUG_source = source;
	}
};
