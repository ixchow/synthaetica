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


const INFO = document.getElementById("info");
const CANVAS = document.getElementById("game");
const gl = CANVAS.getContext("webgl", {
		alpha:false,
		depth:false,
		preserveDrawingBuffer:false,
		stencil:false
	} );
if (gl === null) {
	alert("Unable to init webgl");
	throw new Error("Init failed.");
}

let LOADED = false;
async function load() {
	try {
		INFO.innerHTML = "Loading shaders...";
		await SHADERS.load();

		INFO.innerHTML = "Loading textures...";
		await TEXTURES.load();

		INFO.style.display = "none";
	} catch (e) {
		INFO.innerHTML = "LOADING FAILED: " + e;
		return;
	}
	LOADED = true;
	if (document.location.search.length > 1) {
		try {
			CONTROLS.decode(document.location.search.substr(1));
		} catch (e) {
			console.log("Failed to load controls, setting to default.");
			CONTROLS.decode("");
		}
	}
	queueUpdate();
}
load();

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

MOUSE.getHovered = function MOUSE_getHovered() {
	const x = this.at.x;
	const y = this.at.y;
	let hovered = {
		beat:null,
		track:null,
	};
	//look for handles:
	if (y >= -1.0 + ROLL_HEIGHT && y <= -1.0 + ROLL_HEIGHT + HANDLE_HEIGHT) {
		let w = HANDLE_HEIGHT / CANVAS.aspect;
		{
			let beat = TRANSPORT.playhead / 60.0 * LEVEL.beatsPerMinute;
			let measure = Math.floor(beat / LEVEL.beatsPerMeasure);
			let x0 = TRANSPORT.measurePos[measure];
			let x1 = TRANSPORT.measurePos[measure+1];
			let amt = (beat - LEVEL.beatsPerMeasure * measure) / LEVEL.beatsPerMeasure;
			let c = amt * (x1 - x0) + x0;

			if (Math.abs(c - x) < 0.5 * w) {
				hovered.playhead = true;
			}
		}

		{ //check loop start
			let c = TRANSPORT.measurePos[TRANSPORT.loop_start];
			if (Math.abs(c - x) < 0.5 * w) hovered.loop_start = true;
		}
		{ //check loop end
			let c = TRANSPORT.measurePos[TRANSPORT.loop_end];
			if (Math.abs(c - x) < 0.5 * w) hovered.loop_end = true;
		}
		
	}
	//set track:
	if (y >= -1.0 && y <= -1.0 + ROLL_HEIGHT) {
		hovered.track = Math.floor((y - -1.0) / ROLL_HEIGHT * 4);
	}
	{ //set beat:
		let a = 0;
		let b = LEVEL.measures.length;
		if (TRANSPORT.measurePos[a] <= x && x <= TRANSPORT.measurePos[b]) {
			while (a + 1 < b) {
				let c = Math.floor((a+1 + b)/2);
				if (TRANSPORT.measurePos[c] < x) {
					a = c;
				} else {
					b = c;
				}
			}
			hovered.beat = a * LEVEL.beatsPerMeasure + Math.floor((x - TRANSPORT.measurePos[a]) / (TRANSPORT.measurePos[a+1] - TRANSPORT.measurePos[a]) * LEVEL.beatsPerMeasure);
		}
	}
	return hovered;
};

window.addEventListener('mousemove', function(evt){
	evt.preventDefault();
	setMouse(evt);
	if ('drag' in MOUSE) MOUSE.drag();
	return false;
});
window.addEventListener('mousedown', function(evt){
	evt.preventDefault();
	setMouse(evt);
	if (evt.target === CANVAS && !('drag' in MOUSE)) {
		const hovered = MOUSE.getHovered();
		console.log(hovered);
		if (hovered.playhead) {
			const wasPlaying = TRANSPORT.playing;
			TRANSPORT.playing = false;
			MOUSE.drag = () => {
				const hovered = MOUSE.getHovered();
				if (hovered.beat !== null) {
					const measure = Math.floor(hovered.beat / LEVEL.beatsPerMeasure);
					const x0 = TRANSPORT.measurePos[measure];
					const x1 = TRANSPORT.measurePos[measure+1];
					const t0 = measure * LEVEL.beatsPerMeasure * 60.0 / LEVEL.beatsPerMinute;
					const t1 = (measure+1) * LEVEL.beatsPerMeasure * 60.0 / LEVEL.beatsPerMinute;
					let t = ((MOUSE.at.x - x0) / (x1 - x0) * (t1 - t0) + t0);
					setTime(t);
				}
			};
			MOUSE.dragEnd = () => { TRANSPORT.playing = wasPlaying; };
			MOUSE.drag();
		} else if (hovered.loop_start) {
			MOUSE.drag = () => {
				const ref = Math.abs(MOUSE.at.x - TRANSPORT.measurePos[TRANSPORT.loop_start]);
				if (TRANSPORT.loop_start > 0) {
					const test = Math.abs(MOUSE.at.x - TRANSPORT.measurePos[TRANSPORT.loop_start-1]);
					if (test < ref) {
						setLoop(TRANSPORT.loop_start-1, TRANSPORT.loop_end);
						return;
					}
				}
				if (TRANSPORT.loop_start + 1 < TRANSPORT.loop_end) {
					const test = Math.abs(MOUSE.at.x - TRANSPORT.measurePos[TRANSPORT.loop_start+1]);
					if (test < ref) {
						setLoop(TRANSPORT.loop_start+1, TRANSPORT.loop_end);
						return;
					}
				}
			};
			MOUSE.drag();
		} else if (hovered.loop_end) {
			MOUSE.drag = () => {
				const ref = Math.abs(MOUSE.at.x - TRANSPORT.measurePos[TRANSPORT.loop_end]);
				if (TRANSPORT.loop_end > TRANSPORT.loop_start + 1) {
					const test = Math.abs(MOUSE.at.x - TRANSPORT.measurePos[TRANSPORT.loop_end-1]);
					if (test < ref) {
						setLoop(TRANSPORT.loop_start, TRANSPORT.loop_end-1);
						return;
					}
				}
				if (TRANSPORT.loop_end + 1 <= LEVEL.measures.length) {
					const test = Math.abs(MOUSE.at.x - TRANSPORT.measurePos[TRANSPORT.loop_end+1]);
					if (test < ref) {
						setLoop(TRANSPORT.loop_start, TRANSPORT.loop_end+1);
						return;
					}
				}
			};
			MOUSE.drag();
		} else if (hovered.track !== null && hovered.beat !== null) {
			const bit = (1 << hovered.track);
			const setting = (CONTROLS[hovered.beat] & (1 << hovered.track) ? 0x0 : 0xf);
			TRACKS_BUFFER.dirty = true;
			MOUSE.drag = () => {
				const hovered = MOUSE.getHovered();
				if (hovered.track !== null && hovered.beat !== null) {
					const bit = (1 << hovered.track);
					const old = CONTROLS[hovered.beat];
					CONTROLS[hovered.beat] = (old & ~bit) | (setting & bit);
					if (CONTROLS[hovered.beat] !== old) {
						CONTROLS.dirty = true;
						TRACKS_BUFFER.dirty = true;
						STATES.dirty = Math.min(STATES.dirty, hovered.beat * LEVEL.ticksPerBeat + 1);
					}
				}
			};
			MOUSE.drag();
		}
	}
	return false;
});


window.addEventListener('mouseup', function(evt){
	evt.preventDefault();
	setMouse(evt);
	if ('drag' in MOUSE) {
		delete MOUSE.drag;
	}
	if ('dragEnd' in MOUSE) {
		MOUSE.dragEnd();
		delete MOUSE.dragEnd;
	}
	//handleUp(MOUSE.getGrid());
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

const ROLL_HEIGHT = 0.4; //relative to [-1,1] y-axis
const HANDLE_HEIGHT = 0.05;

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

CONTROLS.dirty = true;

CONTROLS.encode = function() {
	let chars = "";
	for (let i = 0; i < CONTROLS.length; i += 2) {
		let val = CONTROLS[i];
		if (i+1 < CONTROLS.length) val += (CONTROLS[i+1] << 4);
		chars += String.fromCharCode(val);
	}
	return btoa(chars);
};

CONTROLS.decode = function(b64) {
	let chars = atob(b64);
	for (let i = 0; i < CONTROLS.length; i += 2) {
		let val = (i/2 < chars.length ? chars.codePointAt(i/2) : 0);
		CONTROLS[i] = val & 0xf;
		if (i+1 < CONTROLS.length) CONTROLS[i+1] = val >> 4;
	}
};

const TRACK_COLORS = [
	[0.5, 0.3, 1.0],
	[1.0, 1.0, 0.5],
	[0.5, 1.0, 0.5],
	[1.0, 0.5, 0.5]
];

function States() {
	this.dirty = 0;
	this.ticks = LEVEL.ticksPerBeat * LEVEL.beatsPerMeasure * LEVEL.measures.length + 1;
	this.ship = new Float32Array(6 * this.ticks);
	this.enemies = []; //TODO!
	this.sparks = new Int32Array(LEVEL.sparks.length);

	// --- initial state ---

	//ship is at starting position:
	this.setShip(0, LEVEL.start);

	//sparks all not collected:
	for (let i = 0; i < this.sparks.length; ++i) {
		this.sparks[i] = this.ticks + 1;
	}

	//computation needs to start at tick 1:
	this.dirty = 1;
};

States.prototype.setShip = function States_setShip(tick, ship) {
	this.ship[tick * 6 + 0] = ship.x;
	this.ship[tick * 6 + 1] = ship.y;
	this.ship[tick * 6 + 2] = ship.r;
	this.ship[tick * 6 + 3] = ship.vx;
	this.ship[tick * 6 + 4] = ship.vy;
	this.ship[tick * 6 + 5] = ship.vr;
};
States.prototype.getShip = function States_getShip(tick) {
	const ship = {
		x:this.ship[tick * 6 + 0],
		y:this.ship[tick * 6 + 1],
		r:this.ship[tick * 6 + 2],
		vx:this.ship[tick * 6 + 3],
		vy:this.ship[tick * 6 + 4],
		vr:this.ship[tick * 6 + 5]
	};
	return ship;
};

States.prototype.interpolate = function States_interpolate(time, DEBUG) {
	let amt = time / 60.0 * (LEVEL.beatsPerMinute * LEVEL.ticksPerBeat);
	let tick = Math.floor(amt);
	amt -= tick;
	let glitch = false;

	if (DEBUG) console.log(tick, amt); //DEBUG
	if (tick < 0) {
		tick = 0;
		amt = 0.0;
		glitch = true;
	} if (tick > this.dirty - 1) {
		tick = this.dirty - 1;
		amt = 0.0;
		glitch = true;
	}
	if (DEBUG) console.log(tick, amt); //DEBUG

	let from = {
		ship:this.getShip(tick),
		sparks:[]
	};
	if (glitch) from.glitch = true;

	//fill in sparks by comparison:
	for (let i = 0; i < this.sparks.length; ++i) {
		if (this.sparks[i] <= tick) {
			from.sparks[i] = tick;
		} else {
			from.sparks[i] = null;
		}
	}
	if (amt == 0.0) return from;
	//interpolate:
	let to = {
		ship:this.getShip(tick+1)
	};
	from.ship.x = amt * (to.ship.x - from.ship.x) + from.ship.x;
	from.ship.y = amt * (to.ship.y - from.ship.y) + from.ship.y;
	if (to.ship.r > from.ship.r + Math.PI) to.ship.r -= 2.0 * Math.PI;
	if (to.ship.r < from.ship.r - Math.PI) to.ship.r += 2.0 * Math.PI;
	from.ship.r = amt * (to.ship.r - from.ship.r) + from.ship.r;

	return from;
};

const GRAVITY = 2.0;
const GLOBE_RADIUS = 0.3;
const JET_RADIUS = 0.45;
const DISH_RADIUS = 0.6;
const SHIP_MASS = 1.0;
const SHIP_MOMENT = SHIP_MASS * (GLOBE_RADIUS * GLOBE_RADIUS);
const JET_THRUST = SHIP_MASS * GRAVITY * 0.75;

const MAX_ROTATION = 2.0 * Math.PI * 5.0;
const MAX_VELOCITY = 10.0;

States.prototype.calculate = function States_calculate() {
	if (this.dirty >= this.ticks) return; //everything is calculated
	if (this.dirty == 0) {
		console.log("Will never compute 0 !!!");
		this.dirty = 1;
		return;
	}
	const delta = 60.0 / (LEVEL.ticksPerBeat * LEVEL.beatsPerMinute);
	const ship = this.getShip(this.dirty-1);
	const controls = {};
	{
		let val = CONTROLS[Math.floor((this.dirty-1) / LEVEL.ticksPerBeat)];
		controls.left = val & (1 << 3);
		controls.right = val & (1 << 2);
		controls.beam = val & (1 << 1);
		controls.grab = val & (1 << 0);
	}

	{ //damping:
		const fac = Math.pow(0.5, delta / 1.5);
		ship.vx *= fac;
		ship.vy *= fac;
		ship.vr *= fac;
	}

	//gravity:
	ship.vy += delta * -GRAVITY;

	function applyForce(x,y,fx,fy) {
		ship.vx += delta * fx / SHIP_MASS;
		ship.vy += delta * fy / SHIP_MASS;
		ship.vr += delta * (fx * -y + fy * x) / SHIP_MOMENT;
	}

	{ //jets:
		let right = {
			x:Math.cos(ship.r),
			y:Math.sin(ship.r)
		};
		let up = {
			x:-right.y,
			y:right.x
		};
		if (controls.right) {
			applyForce(right.x * JET_RADIUS, right.y * JET_RADIUS, JET_THRUST*up.x, JET_THRUST*up.y);
		}
		if (controls.left) {
			applyForce(right.x * -JET_RADIUS, right.y * -JET_RADIUS, JET_THRUST*up.x, JET_THRUST*up.y);
		}
	}

	//absolute limits on speed:
	ship.vr = Math.max(Math.min(ship.vr, MAX_ROTATION), -MAX_ROTATION);
	{
		let vel2 = ship.vx * ship.vx + ship.vy * ship.vy;
		if (vel2 > MAX_VELOCITY * MAX_VELOCITY) {
			let fac = MAX_VELOCITY / Math.sqrt(vel2);
			ship.vx *= fac;
			ship.vy *= fac;
		}
	}

	ship.x += delta * ship.vx;
	ship.y += delta * ship.vy;
	ship.r += delta * ship.vr;

	ship.r = ship.r % (2.0 * Math.PI);

	if (this.dirty < 10) {
		console.log(this.dirty, ship, delta);
	}

	this.setShip(this.dirty, ship);

	this.dirty += 1;

};

const STATES = new States();

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

	let beat = TRANSPORT.playhead / 60.0 * LEVEL.beatsPerMinute;
	{ //set camera position:
		let i = 0;
		while (i + 1 < LEVEL.camera.length && LEVEL.camera[i+1].beat < beat) {
			++i;
		}
		CAMERA.beat = beat; //DEBUG
		CAMERA.i = i; //DEBUG
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

	TRACKS_BUFFER.dirty = true;
}




function update(elapsed) {
	if (!LOADED) {
		draw();
		return;
	}

	if (CONTROLS.dirty) {
		CONTROLS.dirty = false;
		if (history && history.replaceState) history.replaceState({},"","?" + CONTROLS.encode());
	}

	STATES.calculate();
	STATES.calculate();
	STATES.calculate();

	if (TERRAIN_BUFFER.dirty) TERRAIN_BUFFER.update();
	if (TRACKS_BUFFER.dirty) TRACKS_BUFFER.update();

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

	queueUpdate();
}

const TERRAIN_BUFFER = gl.createBuffer();
TERRAIN_BUFFER.dirty = true;
TERRAIN_BUFFER.update = function TERRAIN_BUFFER_update() {
	this.dirty = false;
	
	//(x,y, r,g,b,a)
	let attribs = [];

	function block(points, color) {
		if (attribs.length > 0) attribs.push(...attribs.slice(-6));
		attribs.push(points[0], points[1], ...color);
		if (attribs.length !== 6) attribs.push(...attribs.slice(-6));
		attribs.push(points[2], points[3], ...color);
		let count = points.length/2;
		for (let i = 1; count-i >= 1+i; ++i) {
			attribs.push(points[2*(count-i)], points[2*(count-i)+1], ...color);
			attribs.push(points[2*(1+i)], points[2*(1+i)+1], ...color);
		}
	}

	LEVEL.terrain.forEach((t) => {
		block(t.points, [...t.color, 1.0]);
	});


	const stride = 2*4+4*4;
	if (attribs.length) {
		//upload and draw arrow attribs:
		gl.bindBuffer(gl.ARRAY_BUFFER, this);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(attribs), gl.STATIC_DRAW);

		this.bind = function() {
			gl.bindBuffer(gl.ARRAY_BUFFER, this);
			//0 => Position
			gl.enableVertexAttribArray(0);
			gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
			//1 => Color
			gl.enableVertexAttribArray(1);
			gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 2*4);
		};
	}

	console.log(attribs.length / stride + " terrain attribs.");
	this.count = attribs.length / (stride/4);
};

const TRACKS_BUFFER = gl.createBuffer();
TRACKS_BUFFER.dirty = true;

TRACKS_BUFFER.update = function TRACKS_BUFFER_update() {
	this.dirty = false;

	let attribs = [];

	function rect(x, y, w, h, c0, c1, c2, c3) {
		if (attribs.length > 0) attribs.push(...attribs.slice(-6));
		attribs.push(x,y,...c0);
		if (attribs.length !== 6) attribs.push(...attribs.slice(-6));
		attribs.push(x,y+h,...c1);
		attribs.push(x+w,y,...c2);
		attribs.push(x+w,y+h,...c3);
	}

	function caps(x,y, w,h, cx,cy, c0,c1,c2,c3) {
		if (attribs.length > 0) attribs.push(...attribs.slice(-6));
		attribs.push(x,y+cy,...c0);
		if (attribs.length !== 6) attribs.push(...attribs.slice(-6));
		attribs.push(x,y+h-cy,...c1);

		attribs.push(x+cx,y,...c0);
		attribs.push(x+cx,y+h,...c1);

		attribs.push(x+w-cx,y,...c2);
		attribs.push(x+w-cx,y+h,...c3);

		attribs.push(x+w,y+cy,...c2);
		attribs.push(x+w,y+h-cy,...c3);
	}

	{ //background:
		let x0 = TRANSPORT.measurePos[0];
		let x1 = TRANSPORT.measurePos[TRANSPORT.measurePos.length-1];

		rect(x0, -1.0, x1-x0, ROLL_HEIGHT,
			[0.3, 0.3, 0.3, 1.0],
			[0.4, 0.4, 0.4, 1.0],
			[0.3, 0.3, 0.3, 1.0],
			[0.4, 0.4, 0.4, 1.0]
		);
	}

	//highlight beats:
	for (let measure = 0; measure < LEVEL.measures.length; ++measure) {
		let x0 = TRANSPORT.measurePos[measure];
		let x1 = TRANSPORT.measurePos[measure+1];
		let w = (x1 - x0) / LEVEL.beatsPerMeasure;

		for (let beat = 0; beat < LEVEL.beatsPerMeasure; ++beat) {
			let a;
			if (beat === 0) {
				a = 0.1;
			} else if (beat % 2 === 0) {
				a = 0.05;
			} else {
				continue;
			}

			rect(x0+w*beat, -1.0, w, ROLL_HEIGHT,
				[1,1,1, a],
				[1,1,1, a],
				[1,1,1, a],
				[1,1,1, a]
			);
		}
	}

	/*
	//measure dividers:
	for (let measure = 0; measure < LEVEL.measures.length; ++measure) {
		let x0 = TRANSPORT.measurePos[measure];
		let x1 = TRANSPORT.measurePos[measure+1];

		rect(x0, -1.0, 0.1 * (x1-x0) / LEVEL.beatsPerMeasure, ROLL_HEIGHT,
			[1,1,1, 1.0],
			[1,1,1, 1.0],
			[1,1,1, 0.0],
			[1,1,1, 0.0]
		);
	}
	*/

	//tint tracks, slightly:
	for (let track = 0; track < 4; ++track) {
		let y = ROLL_HEIGHT / 4 * track - 1.0;
		let h = ROLL_HEIGHT / 4;
		let x0 = TRANSPORT.measurePos[0];
		let x1 = TRANSPORT.measurePos[TRANSPORT.measurePos.length-1];

		let c = TRACK_COLORS[track];
		rect(x0, y, x1-x0, h,
			[...c, 0.3],
			[...c, 0.3],
			[...c, 0.3],
			[...c, 0.3]
		);
	}

	for (let track = 0; track < 4; ++track) {
		let y = ROLL_HEIGHT / 4 * track - 1.0;
		let h = ROLL_HEIGHT / 4;
		let col = TRACK_COLORS[track];
		for (let measure = 0; measure < LEVEL.measures.length; ++measure) {
			let x0 = TRANSPORT.measurePos[measure];
			let x1 = TRANSPORT.measurePos[measure+1];
			let w = (x1 - x0) / LEVEL.beatsPerMeasure;
			for (let beat = 0; beat < LEVEL.beatsPerMeasure; ++beat) {
				if (CONTROLS[beat + measure * LEVEL.beatsPerMeasure] & (1 << track)) {
					caps(x0 + beat*w+0.05*w, y+0.05*h, 0.9*w,0.9*h, 0.1*w,0.1*h,
					//rect(x0 + beat*w, y, w, h,
						[...col, 1.0],
						[...col, 1.0],
						[...col, 1.0],
						[...col, 1.0]
					);
				} /*else {
					rect(x0 + beat*w, y, w, h,
						[0.0, 0.0, 0.0, 0.1],
						[0.0, 0.0, 0.0, 0.1],
						[0.0, 0.0, 0.0, 0.1],
						[0.0, 0.0, 0.0, 0.1]
					);
				}*/
			}
		}
	}

	
	const stride = 2*4+4*4;
	if (attribs.length) {
		//upload and draw arrow attribs:
		gl.bindBuffer(gl.ARRAY_BUFFER, this);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(attribs), gl.STATIC_DRAW);
		console.log("Uploaded ", attribs.length); //DEBUG

		this.bind = function() {
			gl.bindBuffer(gl.ARRAY_BUFFER, this);
			//0 => Position
			gl.enableVertexAttribArray(0);
			gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
			//1 => Color
			gl.enableVertexAttribArray(1);
			gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 2*4);
		};

	}
	this.count = attribs.length / (stride/4);
}


//------------------------------
//transport init:

TRANSPORT.playhead = NaN;
setTime(0.0);
TRANSPORT.loop_start = TRANSPORT.loop_end = NaN;
setLoop(3,4);

//------------------------------


const MISC_BUFFER = gl.createBuffer();

function draw() {
	const size = {
		x:parseInt(CANVAS.width),
		y:parseInt(CANVAS.height)
	};
	gl.viewport(0,0,size.x,size.y);
	CANVAS.aspect = size.x / size.y;

	if (!LOADED) {
		gl.clearColor(0.5,0.5,0.5, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		//TODO: fancy loading bar or something.
		return;
	}

	let worldAttribs = []; //(x,y, tx,ty, r,g,b,a)
	//draw ship and such:
	{
		/*
		function texRect(x,y, rightx,righty, w,h,  tx,ty, tw,th) {
			const upx = -righty * 0.5 * h;
			const upy = rightx * 0.5 * h;
			rightx *= 0.5 * w;
			righty *= 0.5 * w;
			if (worldAttribs.length > 0) worldAttribs.push(...worldAttribs.slice(-4));
			worldAttribs.push(x - rightx - upx, y - righty - upy, tx, ty);
			if (worldAttribs.length !== 4) worldAttribs.push(...worldAttribs.slice(-4));
			worldAttribs.push(x - rightx + upx, y - righty + upy, tx, ty+th);
			worldAttribs.push(x + rightx - upx, y + righty - upy, tx+tw, ty);
			worldAttribs.push(x + rightx + upx, y + righty + upy, tx+tw, ty+th);
		}
		*/

		//draw object such that it fits in szX x szY box
		function drawObject(name, x,y, rightx,righty, szX,szY, tint) {
			if (typeof(tint) === 'undefined') tint = [1,1,1,1];
			if (tint.length === 3) tint = [...tint, 1];

			const obj = OBJECTS[name];
			const scaleX = Math.min( szX / obj.sizeX, szY / obj.sizeY );
			const scaleY = scaleX;

			const pxToWorldX = {x:scaleX*rightx, y:scaleX*righty};
			const pxToWorldY = {x:scaleY*-righty, y:scaleY*rightx};

			if (worldAttribs.length > 0) worldAttribs.push(...worldAttribs.slice(-8));
			worldAttribs.push(
				x + pxToWorldX.x * (-obj.anchorX + obj.minX) + pxToWorldY.x * (-obj.anchorY + obj.minY),
				y + pxToWorldX.y * (-obj.anchorX + obj.minX) + pxToWorldY.y * (-obj.anchorY + obj.minY),
				obj.minX / TEXTURES.objects.width, 1.0 - obj.minY / TEXTURES.objects.height,
				...tint
			);
			if (worldAttribs.length !== 8) worldAttribs.push(...worldAttribs.slice(-8));
			worldAttribs.push(
				x + pxToWorldX.x * (-obj.anchorX + obj.maxX) + pxToWorldY.x * (-obj.anchorY + obj.minY),
				y + pxToWorldX.y * (-obj.anchorX + obj.maxX) + pxToWorldY.y * (-obj.anchorY + obj.minY),
				obj.maxX / TEXTURES.objects.width, 1.0 - obj.minY / TEXTURES.objects.height,
				...tint
			);
			worldAttribs.push(
				x + pxToWorldX.x * (-obj.anchorX + obj.minX) + pxToWorldY.x * (-obj.anchorY + obj.maxY),
				y + pxToWorldX.y * (-obj.anchorX + obj.minX) + pxToWorldY.y * (-obj.anchorY + obj.maxY),
				obj.minX / TEXTURES.objects.width, 1.0 - obj.maxY / TEXTURES.objects.height,
				...tint
			);
			worldAttribs.push(
				x + pxToWorldX.x * (-obj.anchorX + obj.maxX) + pxToWorldY.x * (-obj.anchorY + obj.maxY),
				y + pxToWorldX.y * (-obj.anchorX + obj.maxX) + pxToWorldY.y * (-obj.anchorY + obj.maxY),
				obj.maxX / TEXTURES.objects.width, 1.0 - obj.maxY / TEXTURES.objects.height,
				...tint
			);

		}

		//texRect(CAMERA.x,CAMERA.y, 1,0, 0.5*CAMERA.radius,0.5*CAMERA.radius, 0,0,1,1); //DEBUG
		//texRect(0,0, 1,0, 10,10, 0,0,1,1); //DEBUG

		let state = STATES.interpolate(TRANSPORT.playhead);
		window.DEBUG_state = state;
		{ //draw ship:
			let at = {x:state.ship.x, y:state.ship.y};
			let right = {x:Math.cos(state.ship.r), y:Math.sin(state.ship.r)};
			drawObject("shipBeam", at.x,at.y, right.x,right.y, 2*DISH_RADIUS,Infinity);

			drawObject("shipGlass", at.x,at.y, right.x,right.y, 2*GLOBE_RADIUS,2*GLOBE_RADIUS);

			drawObject("shipJet", at.x+right.x*JET_RADIUS,at.y+right.y*JET_RADIUS, right.x,right.y, Infinity, 0.3, TRACK_COLORS[2]);
			drawObject("shipJet", at.x-right.x*JET_RADIUS,at.y-right.y*JET_RADIUS, right.x,right.y, Infinity, 0.3, TRACK_COLORS[3]);

			drawObject("shipDish", at.x+right.x*DISH_RADIUS,at.y+right.y*DISH_RADIUS, right.x,right.y, Infinity,0.3, TRACK_COLORS[1]);
			drawObject("shipDish", at.x-right.x*DISH_RADIUS,at.y-right.y*DISH_RADIUS, -right.x,-right.y, Infinity,0.3, TRACK_COLORS[1]);
		}
	}

	let uiAttribs = []; //(x,y, r,g,b,a)

	function uiRect(x, y, w, h, c0, c1, c2, c3) {
		if (uiAttribs.length > 0) uiAttribs.push(...uiAttribs.slice(-6));
		uiAttribs.push(x,y,...c0);
		if (uiAttribs.length !== 6) uiAttribs.push(...uiAttribs.slice(-6));
		uiAttribs.push(x,y+h,...c1);
		uiAttribs.push(x+w,y,...c2);
		uiAttribs.push(x+w,y+h,...c3);
	}

	if (STATES.dirty < STATES.ticks) { //statehead:
		let beat = (STATES.dirty-0.5) / LEVEL.ticksPerBeat;
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
	}

	//hover highlight:
	const hovered = MOUSE.getHovered();
	if (hovered.beat !== null && hovered.track !== null) {
		let measure = Math.floor(hovered.beat / LEVEL.beatsPerMeasure);
		let x0 = TRANSPORT.measurePos[measure];
		let x1 = TRANSPORT.measurePos[measure+1];
		let w = (x1-x0) / LEVEL.beatsPerMeasure;
		let y = -1.0 + ROLL_HEIGHT / 4 * hovered.track;
		let h = ROLL_HEIGHT / 4;
		let beat = hovered.beat - measure * LEVEL.beatsPerMeasure;

		uiRect(beat*w+x0, y, w, h,
			[1.0,1.0,0.9,0.3],
			[1.0,1.0,0.9,0.3],
			[1.0,1.0,0.9,0.3],
			[1.0,1.0,0.9,0.3]
		);
	}

	{ //playhead:
		let beat = TRANSPORT.playhead / 60.0 * LEVEL.beatsPerMinute;
		let measure = Math.floor(beat / LEVEL.beatsPerMeasure);
		let amt = (beat - measure * LEVEL.beatsPerMeasure) / LEVEL.beatsPerMeasure;

		let x0 = TRANSPORT.measurePos[measure];
		let x1 = TRANSPORT.measurePos[measure+1];

		let x = amt * (x1-x0) + x0;

		uiRect(x, -1.0, 0.01, ROLL_HEIGHT,
			[0.0, 0.0, 0.0, 0.4],
			[0.0, 0.0, 0.0, 0.4],
			[0.0, 0.0, 0.0, 0.0],
			[0.0, 0.0, 0.0, 0.0]
		);
		uiRect(x-0.01, -1.0, 0.01, ROLL_HEIGHT,
			[1.0, 1.0, 1.0, 0.0],
			[1.0, 1.0, 1.0, 0.0],
			[1.0, 1.0, 1.0, 0.4],
			[1.0, 1.0, 1.0, 0.4]
		);
		let h = HANDLE_HEIGHT;
		let w = HANDLE_HEIGHT / CANVAS.aspect;
		let c = (hovered.playhead ? [1.0, 1.0, 0.9, 1.0] : [0.8, 0.8, 0.8, 1.0]);
		uiRect(x - 0.5 * w, -1.0 + ROLL_HEIGHT, w, h, c,c,c,c);
		//console.log(hovered);
	}

	{ //Loop start:
		let start = TRANSPORT.measurePos[0];
		let x = TRANSPORT.measurePos[TRANSPORT.loop_start];
		uiRect(start, -1.0, x-start, ROLL_HEIGHT,
			[0.0, 0.0, 0.0, 0.5],
			[0.0, 0.0, 0.0, 0.5],
			[0.0, 0.0, 0.0, 0.6],
			[0.0, 0.0, 0.0, 0.6]
		);
		let h = HANDLE_HEIGHT;
		let w = HANDLE_HEIGHT / CANVAS.aspect;
		let c = (hovered.loop_start ? [1.0, 1.0, 0.9, 1.0] : [0.8, 0.8, 0.8, 1.0]);
		uiRect(x - 0.5 * w, -1.0 + ROLL_HEIGHT, w, h, c,c,c,c);
	}

	{ //Loop end:
		let x = TRANSPORT.measurePos[TRANSPORT.loop_end];
		let end = TRANSPORT.measurePos[TRANSPORT.measurePos.length-1];
		uiRect(x, -1.0, end - x, ROLL_HEIGHT,
			[0.0, 0.0, 0.0, 0.5],
			[0.0, 0.0, 0.0, 0.5],
			[0.0, 0.0, 0.0, 0.6],
			[0.0, 0.0, 0.0, 0.6]
		);
		let h = HANDLE_HEIGHT;
		let w = HANDLE_HEIGHT / CANVAS.aspect;
		let c = (hovered.loop_end ? [1.0, 1.0, 0.9, 1.0] : [0.8, 0.8, 0.8, 1.0]);
		uiRect(x - 0.5 * w, -1.0 + ROLL_HEIGHT, w, h, c,c,c,c);
	}

	//--------- actually drawing now -----------

	gl.clearColor(0.0,0.0,0.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.enable(gl.BLEND);
	gl.blendEquation(gl.FUNC_ADD);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	{ //compute world-to-clip matrix for camera:
		const w = 2.0 * size.x / size.y;
		const h = 2.0 - ROLL_HEIGHT;

		let scale = Math.min(w,h) / (2.0 * CAMERA.radius);

		let sx = 2.0 / w * scale;
		let sy = (2.0 - ROLL_HEIGHT) / h * scale;
		CAMERA.worldToClip = new Float32Array([
			sx, 0.0, 0.0, 0.0,
			0.0, sy, 0.0, 0.0,
			0.0, 0.0, 1.0, 0.0,
			sx * -CAMERA.x, sy * -CAMERA.y + 0.5 * ROLL_HEIGHT, 0.0, 1.0
		]);
	}

	if (TERRAIN_BUFFER.count) {
		let prog = SHADERS.color;

		const u = {};

		u.uObjectToClip = CAMERA.worldToClip;

		setUniforms(prog, u);

		TERRAIN_BUFFER.bind();
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, TERRAIN_BUFFER.count);
	}

	if (worldAttribs.length) {
		let prog = SHADERS.textureColor;
		const u = {};
		u.uObjectToClip = CAMERA.worldToClip;

		u.uTex = [0];

		setUniforms(prog, u);

		//upload and draw arrow attribs:
		gl.bindBuffer(gl.ARRAY_BUFFER, MISC_BUFFER);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(worldAttribs), gl.STREAM_DRAW);

		const stride = 2*4+2*4+4*4;
		//0 => Position
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
		//1 => Color
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 2*4+2*4);
		//2 => TexCoord
		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 2*4);

		gl.bindTexture(gl.TEXTURE_2D, TEXTURES["objects"]);

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, worldAttribs.length/(stride/4));

		gl.bindTexture(gl.TEXTURE_2D, null);
	}

	if (TRACKS_BUFFER.count) {
		let prog = SHADERS.color;

		const u = {};

		u.uObjectToClip = new Float32Array([
			1.0, 0.0, 0.0, 0.0,
			0.0, 1.0, 0.0, 0.0,
			0.0, 0.0, 1.0, 0.0,
			0.0, 0.0, 0.0, 1.0
		]);

		setUniforms(prog, u);

		TRACKS_BUFFER.bind();
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, TRACKS_BUFFER.count);
	}


	if (uiAttribs.length) {
		let prog = SHADERS.color;

		const u = {};

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


