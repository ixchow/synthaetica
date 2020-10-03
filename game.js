"use string";
//Based, in part, on the MDN webGL tutorials:
// https://threejs.org/build/three.min.js
//and also based on the 15-466-f18 notes:
// http://graphics.cs.cmu.edu/courses/15-466-f18/notes/gl-helpers.js
// http://graphics.cs.cmu.edu/courses/15-466-f18/notes/brdf-toy.html
//and some helpers from on-forgetting:
// https://github.com/ixchow/on-forgetting
//and some helpers from gridwords:
// https://github.com/ixchow/gridwords


const CANVAS = document.getElementById("game");
const gl = CANVAS.getContext("webgl", {} );
if (gl === null) {
	alert("Unable to init webgl");
	throw new Error("Init failed.");
}

let loading = 0;

SHADERS.load();

function addLoad(fn) {
	loading += 1;
	TITLE.innerHTML = "Loading (" + loading + " remain)";
	fn(function(){
		loading -= 1;
		TITLE.innerHTML = "Loading (" + loading + " remain)";
		if (loading == 0) {
			if (document.location.search.match(/^\?\d+/)) {
				setLevel(parseInt(document.location.search.substr(1)));
			} else {
				setLevel(0);
			}
		}
		queueUpdate();
	});
}

//onresize resizes the canvas's contents based on its external size:
function resized() {
	const size = {x:CANVAS.clientWidth, y:CANVAS.clientHeight};
	CANVAS.width = size.x;
	CANVAS.height = size.y;
	queueUpdate();
}

window.addEventListener('resize', resized);
resized();

function queueUpdate() {
	if (queueUpdate.queued) return;
	queueUpdate.queued = true;
	window.requestAnimationFrame(function(timestamp){
		delete queueUpdate.queued;
		if (!('prevTimestamp' in queueUpdate)) {
			queueUpdate.prevTimestamp = timestamp;
		}
		const delta = (timestamp - queueUpdate.prevTimestamp);
		update(delta / 1000.0);
		queueUpdate.prevTimestamp = timestamp;
	});
}

//-----------------------------

const MOUSE = {
	at:{x:NaN, y:NaN},
};

function setMouse(evt) {
	const rect = CANVAS.getBoundingClientRect();
	MOUSE.at = {
		x:(evt.clientX - rect.left) / rect.width * 2.0 - 1.0,
		y:(evt.clientY - rect.bottom) / -rect.height * 2.0 - 1.0
	};
	queueUpdate();
}

MOUSE.getGrid = function MOUSE_getGrid() {
}

window.addEventListener('mousemove', function(evt){
	evt.preventDefault();
	setMouse(evt);
	return false;
});
window.addEventListener('mousedown', function(evt){
	evt.preventDefault();
	setMouse(evt);
	if (evt.target === CANVAS) {
		/*
		handleDown(MOUSE.getGrid());
		*/
	}
	return false;
});
window.addEventListener('click', function(evt){
/*
	evt.preventDefault();
	if (evt.target === PREV) {
		prevLevel();
	} else if (evt.target === NEXT) {
		nextLevel();
	} else if (evt.target === UNDO) {
		undo();
	} else if (evt.target === RESET) {
		reset();
	}
	return false;
*/
});

window.addEventListener('mouseup', function(evt){
	evt.preventDefault();
	setMouse(evt);
	//handleUp(MOUSE.getGrid());
	return false;
});

const ROLL_HEIGHT = 0.4; //relative to [-1,1] y-axis

const CAMERA = {
	x:0.0, y:0.0, radius:2.0
};

const TRANSPORT = {
	playhead:0.0,
	loop_start:0, //in measures
	loop_end:4, //in measures
	playing:true,
	measurePos:new Float32Array(LEVEL.measures.length+1) //position of every measure's start+end in terms of [-1,1] window
};

const CONTROLS = new Uint8Array(LEVEL.beatsPerMeasure * LEVEL.measures.length);

//DEBUG: init controls somehow:
for (let i = 0; i < CONTROLS.length; ++i) {
	if ((i % 20) < 5)     CONTROLS[i] |= 1;
	if (i % 10 > 3)       CONTROLS[i] |= 2;
	if ((i / 10) % 2)     CONTROLS[i] |= 4;
	if ((i + 4) % 13 < 3) CONTROLS[i] |= 8;
}

function setTime(time) {
	if (TRANSPORT.playhead == time) return;
	TRANSPORT.playhead = time;

	let beat = TRANSPORT.playhead * 60.0 / LEVEL.beatsPerMinute;
	{ //set camera position:
		let i = 0;
		while (i + 1 < LEVEL.camera.length && LEVEL.camera[i+1].beat > beat) {
			++i;
		}
		const from = LEVEL.camera[i];
		const to = LEVEL.camera[i+1];
		if (beat <= from.beat) {
			CAMERA.x = from.x; CAMERA.y = from.y; CAMERA.radius = from.radius;
		} else if (beat >= to.beat) {
			CAMERA.x = to.x; CAMERA.y = to.y; CAMERA.radius = to.radius;
		} else {
			const amt = (beat - from.beat) / (to.beat - from.beat);
			CAMERA.x = amt * (to.x - from.x) + from.x;
			CAMERA.y = amt * (to.y - from.y) + from.y;
			CAMERA.radius = amt * (to.radius - from.radius) + from.radius;
		}
	}
}

function setLoop(loop_start, loop_end) {
	//TODO: clamp start/end based on locks in level and always force at least one measure to be inside loop range
	if (TRANSPORT.loop_start == loop_start && TRANSPORT.loop_end == loop_end) return;
	TRANSPORT.loop_start = loop_start;
	TRANSPORT.loop_end = loop_end;

	//set measure positions:
	const LOOP_FACTOR = 4.0; //selected measures should be this much longer than unselected
	const loop_measures = loop_end - loop_start;
	const other_measures = LEVEL.measures.length - loop_measures + 0.5; //quarter-measure of padding on the ends
	const scale = 2.0 / (LOOP_FACTOR * loop_measures + other_measures);
	for (let m = 0; m <= LEVEL.measures.length; ++m) {
		TRANSPORT.measurePos[m] = scale * ( 0.25
				+ (Math.min(loop_start,m) - 0.0)
				+ LOOP_FACTOR * (Math.min(loop_end,Math.max(loop_start,m)) - loop_start)
				+ (Math.max(loop_end,m) - loop_end)
			) - 1.0;
	}
}

TRANSPORT.playhead = NaN;
setTime(0.0);
TRANSPORT.loop_start = TRANSPORT.loop_end = NaN;
setLoop(0,4);


function update(elapsed) {

	let playhead = TRANSPORT.playhead;
	let loop_start = TRANSPORT.loop_start * LEVEL.beatsPerMeasure * 60.0 / LEVEL.beatsPerMinute;
	let loop_end = TRANSPORT.loop_end * LEVEL.beatsPerMeasure * 60.0 / LEVEL.beatsPerMinute;
	if (TRANSPORT.playing) {
		playhead += elapsed;
		playhead = (playhead - loop_start) % (loop_end - loop_start) + loop_start;
		if (playhead < loop_start) playhead += (loop_end - loop_start);
	} else {
		if (playhead < loop_start) playhead = loop_start;
		if (playhead > loop_end) playhead = loop_end;
	}
	setTime(playhead);

	draw();

	if (TRANSPORT.playing) queueUpdate();
}

const MISC_BUFFER = gl.createBuffer();

function draw() {
	const size = {
		x:parseInt(CANVAS.width),
		y:parseInt(CANVAS.height)
	};
	gl.viewport(0,0,size.x,size.y);

	if (loading) {
		gl.clearColor(0.5,0.5,0.5, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		//TODO: fancy loading bar or something.
		return;
	}

	//update camera:
	CAMERA.aspect = size.x / size.y;

	//build uniforms:
	const u = {};
	
	u.uObjectToClip = new Float32Array([
		1.0 / CAMERA.aspect, 0.0, 0.0, 0.0,
		0.0, 1.0, 0.0, 0.0,
		0.0, 0.0, 1.0, 0.0,
		0.0, 0.0, 0.0, 1.0
	]);

	let uiAttribs = [];

	function uiRect(x, y, w, h, c0, c1, c2, c3) {
		if (uiAttribs.length > 0) uiAttribs.push(...uiAttribs.slice(-6));
		uiAttribs.push(x,y,...c0);
		if (uiAttribs.length !== 6) uiAttribs.push(...uiAttribs.slice(-6));
		uiAttribs.push(x,y+h,...c1);
		uiAttribs.push(x+w,y,...c2);
		uiAttribs.push(x+w,y+h,...c3);
	}

	for (let measure = 0; measure < LEVEL.measures.length; ++measure) {
		let x0 = TRANSPORT.measurePos[measure];
		let x1 = TRANSPORT.measurePos[measure+1];

		uiRect(x0, -1.0, x1-x0, ROLL_HEIGHT,
			[0.5, 0.5, 0.5, 1.0],
			[0.6, 0.6, 0.6, 1.0],
			[0.45, 0.45, 0.45, 1.0],
			[0.5, 0.5, 0.5, 1.0]
		);
	}

	for (let track = 0; track < 4; ++track) {
		let y = ROLL_HEIGHT / 4 * track - 1.0;
		let h = ROLL_HEIGHT / 4;
		for (let measure = 0; measure < LEVEL.measures.length; ++measure) {
			let x0 = TRANSPORT.measurePos[measure];
			let x1 = TRANSPORT.measurePos[measure+1];
			let w = (x1 - x0) / LEVEL.beatsPerMeasure;
			for (let beat = 0; beat < LEVEL.beatsPerMeasure; ++beat) {
				if (CONTROLS[beat] & (1 << track)) {
					uiRect(x0 + beat*w, y, w, h,
						[1.0, 1.0, 1.0, 1.0],
						[1.0, 1.0, 1.0, 1.0],
						[1.0, 1.0, 1.0, 1.0],
						[1.0, 1.0, 1.0, 1.0]
					);
				} else {
					uiRect(x0 + beat*w, y, w, h,
						[0.0, 0.0, 0.0, 0.5],
						[0.0, 0.0, 0.0, 0.25],
						[0.0, 0.0, 0.0, 0.25],
						[0.0, 0.0, 0.0, 0.25]
					);
				}
			}
		}
	}

	{ //playhead:
		let beat = TRANSPORT.playhead / 60.0 * LEVEL.beatsPerMinute;
		let measure = Math.floor(beat / LEVEL.beatsPerMeasure);
		let amt = (beat - measure * LEVEL.beatsPerMeasure) / LEVEL.beatsPerMeasure;

		let x0 = TRANSPORT.measurePos[measure];
		let x1 = TRANSPORT.measurePos[measure+1];

		let x = amt * (x1-x0) + x0;

		uiRect(x, -1.0, 0.02, ROLL_HEIGHT,
			[0.1, 0.0, 0.4, 0.4],
			[0.1, 0.0, 0.4, 0.4],
			[0.1, 0.0, 0.4, 0.0],
			[0.1, 0.0, 0.4, 0.0]
		);
		uiRect(x-0.04, -1.0, 0.04, ROLL_HEIGHT,
			[1.0, 1.0, 0.7, 0.0],
			[1.0, 1.0, 0.7, 0.0],
			[1.0, 1.0, 0.7, 0.6],
			[1.0, 1.0, 0.7, 0.6]
		);
		let h = 0.07;
		let w = h / CAMERA.aspect;
		uiRect(x - 0.5 * w, -1.0 + ROLL_HEIGHT, w, h,
			[1.0, 1.0, 0.9, 1.0],
			[1.0, 1.0, 0.9, 1.0],
			[1.0, 1.0, 0.9, 1.0],
			[1.0, 1.0, 0.9, 1.0]
		);
	}

	{ //Loop start:
		let x = TRANSPORT.measurePos[TRANSPORT.loop_start];
		uiRect(x - 0.02, -1.0, 0.02, ROLL_HEIGHT,
			[0.2, 0.2, 0.2, 0.4],
			[0.2, 0.2, 0.2, 0.4],
			[0.0, 0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0, 0.0]
		);
		let h = 0.07;
		let w = h / CAMERA.aspect;
		uiRect(x - 0.5 * w, -1.0 + ROLL_HEIGHT, w, h,
			[1.0, 1.0, 0.9, 1.0],
			[1.0, 1.0, 0.9, 1.0],
			[1.0, 1.0, 0.9, 1.0],
			[1.0, 1.0, 0.9, 1.0]
		);
	}

	{ //Loop end:
		let x = TRANSPORT.measurePos[TRANSPORT.loop_end];
		uiRect(x, -1.0, 0.04, ROLL_HEIGHT,
			[0.0, 0.0, 0.0, 0.6],
			[0.0, 0.0, 0.0, 0.6],
			[0.0, 0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0, 0.0]
		);
		let h = 0.07;
		let w = h / CAMERA.aspect;
		uiRect(x - 0.5 * w, -1.0 + ROLL_HEIGHT, w, h,
			[1.0, 1.0, 0.9, 1.0],
			[1.0, 1.0, 0.9, 1.0],
			[1.0, 1.0, 0.9, 1.0],
			[1.0, 1.0, 0.9, 1.0]
		);
	}

	//--------- actually drawing now -----------

	gl.colorMask(true, true, true, true);
	gl.clearColor(0.0,0.0,0.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.enable(gl.BLEND);
	gl.blendEquation(gl.FUNC_ADD);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	gl.colorMask(true, true, true, false);

	if (uiAttribs.length) {
		let prog = SHADERS.color;

		u.uObjectToClip = new Float32Array([
			1.0, 0.0, 0.0, 0.0,
			0.0, 1.0, 0.0, 0.0,
			0.0, 0.0, 1.0, 0.0,
			0.0, 0.0, 0.0, 1.0
		]);

		setUniforms(prog, u);

		//upload and draw arrow attribs:
		gl.bindBuffer(gl.ARRAY_BUFFER, MISC_BUFFER);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uiAttribs), gl.STREAM_DRAW);

		const stride = 2*4+4*4;
		//0 => Position
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
		//1 => Color
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 2*4);

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, uiAttribs.length/(stride/4));
	}
}


