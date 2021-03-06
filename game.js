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
const HELP = document.getElementById("help");
const PLAYPAUSE = document.getElementById("playPause");
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

		INFO.innerHTML = "Loading sounds...";
		await MUSIC.load();

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
		hovered.track = Math.min(3, Math.floor((y - -1.0) / ROLL_HEIGHT * 4));
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
		//console.log(hovered);
		if (hovered.playhead) {
			const wasPlaying = TRANSPORT.playing;
			if (wasPlaying) pause();
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
			MOUSE.dragEnd = () => { if (wasPlaying) play(); };
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
			const wasPlaying = TRANSPORT.playing;
			//if (wasPlaying) pause();
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
			MOUSE.dragEnd = () => { if (wasPlaying) play(); };
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

window.addEventListener('keydown', function(evt){
	if (evt.code === "Space") {
		evt.preventDefault();
		if (TRANSPORT.playing) pause();
		else play();
		return false;
	}
});

window.addEventListener('click', function(evt){
	if (HELP.style.display !== "none") {
		evt.preventDefault();
		HELP.style.display = "none";
		return false;
	}
	if (evt.target === PLAYPAUSE) {
		evt.preventDefault();
		if (evt.button === 0) {
			if (TRANSPORT.playing) pause();
			else play();
		}
		return false;
	}
});

const ROLL_HEIGHT = 0.3; //relative to [-1,1] y-axis
const HANDLE_HEIGHT = 0.05;

const CAMERA = {
	x:0.0, y:0.0, radius:2.0
};

const TRANSPORT = {
	playhead:0.0,
	loop_start:0, //in measures
	loop_end:4, //in measures
	playing:false,
	measurePos:new Float32Array(LEVEL.measures.length+1) //position of every measure's start+end in terms of [-1,1] window
};

// --------------------------
// functions here because they also control the music

function pause() {
	TRANSPORT.playing = false;
	MUSIC.stop();
	PLAYPAUSE.classList.remove("playing");
}

function play() {
	TRANSPORT.playing = true;
	PLAYPAUSE.classList.add("playing");
	let muted = [ [], [], [], [] ];
	for (let beat = TRANSPORT.loop_start * LEVEL.beatsPerMeasure; beat < TRANSPORT.loop_end * LEVEL.beatsPerMeasure; ++beat) {
		const c = CONTROLS[beat];
		for (let t = 0; t < 4; ++t) {
			muted[t].push( (c & (1 << t)) ? false : true );
		}
	}
	MUSIC.play(
		LEVEL.beatsPerMinute,
		LEVEL.beatsPerMeasure * TRANSPORT.loop_start,
		LEVEL.beatsPerMeasure * TRANSPORT.loop_end,
		muted,
		TRANSPORT.playhead
	);
}
// --------------------------

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
	this.dead = {tick:this.ticks};
	this.ship = new Float32Array(6 * this.ticks);
	this.enemies = []; //TODO!
	this.keys = new Int32Array(LEVEL.keys.length);
	this.unlockedUntilMeasure = 0;

	// --- initial state ---

	//ship is at starting position:
	this.setShip(0, LEVEL.start);

	//keys all not collected:
	for (let i = 0; i < this.keys.length; ++i) {
		this.keys[i] = this.ticks + 1;
	}
	
	//unlocked until the first measure with a lock:
	while (this.unlockedUntilMeasure < LEVEL.measures.length && !LEVEL.measures[this.unlockedUntilMeasure].locked) {
		++this.unlockedUntilMeasure;
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
States.prototype.getKeys = function States_getKeys(tick) {
	let count = 0;
	for (let i = 0; i < this.keys.length; ++i) {
		if (this.keys[i] <= tick) {
			++count;
		}
	}
	return count;
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
	}
	if (tick >= this.dirty) {
		glitch = true;
	}
	if (tick == this.dirty - 1) {
		//avoid interpolating into dirty frames
		amt = 0.0;
	}
	if (DEBUG) console.log(tick, amt); //DEBUG

	let from = {
		ship:this.getShip(tick),
		keys:[]
	};
	if (CONTROLS[Math.floor(tick / LEVEL.ticksPerBeat)] & (1 << 3)) {
		from.left = true;
	}
	if (CONTROLS[Math.floor(tick / LEVEL.ticksPerBeat)] & (1 << 2)) {
		from.right = true;
	}
	if (CONTROLS[Math.floor(tick / LEVEL.ticksPerBeat)] & (1 << 1)) {
		from.shield = true;
	}
	if (CONTROLS[Math.floor(tick / LEVEL.ticksPerBeat)] & (1 << 0)) {
		let srcTick = Math.floor(tick / LEVEL.ticksPerBeat) * LEVEL.ticksPerBeat;
		let src = this.getShip(srcTick);
		from.jump = {x:src.x, y:src.y, time:srcTick / (LEVEL.ticksPerBeat * LEVEL.beatsPerMinute) * 60.0};
	}
	if (glitch) from.glitch = true;

	//fill in keys by comparison:
	for (let i = 0; i < this.keys.length; ++i) {
		if (this.keys[i] <= tick) {
			from.keys[i] = this.keys[i];
		} else {
			from.keys[i] = null;
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
const SHIELD_RADIUS = 1.0;
const JET_RADIUS = 0.45;
const DISH_RADIUS = 0.6;
const SHIP_MASS = 1.0;
const SHIP_MOMENT = SHIP_MASS * (GLOBE_RADIUS * GLOBE_RADIUS);
const JET_THRUST = SHIP_MASS * GRAVITY * 1.5;

const KEY_RADIUS = 0.25;

const MAX_ROTATION = 2.0 * Math.PI * 5.0;
const MAX_VELOCITY = 10.0;

//construct from an array of interleaved x+y coords, e.g., [0,0, 1,1, ...]
function Convex(xys) {
	this.points = [];
	for (let i = 0; i + 1 < xys.length; i += 2) {
		this.points.push({x:xys[i],y:xys[i+1]});
	}
	let area = 0;
	for (let i = 1; i < this.points.length; ++i) {
		let a = this.points[0];
		let b = this.points[i];
		let c = this.points[(i+1)%this.points.length];
		area += -(b.y-a.y)*(c.x-a.x) + (b.x-a.x)*(c.y-a.y);
	}
	console.assert(area > 0); //DEBUG
	this.planes = [];
	for (let i = 0; i < this.points.length; ++i) {
		let a = this.points[i];
		let b = this.points[(i+1)%this.points.length];
		let perp = {x:-(b.y-a.y), y:b.x-a.x};
		let len = Math.sqrt(perp.x*perp.x + perp.y*perp.y);
		perp.x /= -len;
		perp.y /= -len;
		this.planes.push({
			x:perp.x,
			y:perp.y,
			z:-(perp.x*a.x + perp.y*a.y)
		});
	}
}

/*
//DEBUG
LEVEL.terrain = [
	{ color:[1,0,1], points:[-2,0,  5,0,  5,4,  -2,4] }
]
*/

let CONVEXES = [];

for (let t of LEVEL.terrain) {
	CONVEXES.push(new Convex(t.points));
}


//convex is Convex as above
//circle is {x:, y:, r:}
function convexVsCircle(convex, circle) {

	let closestDis2 = circle.r*circle.r;
	let closestPt = null;

	for (let i = 0; i < convex.points.length; ++i) {
		let a = convex.points[i];
		let b = convex.points[(i+1)%convex.points.length];
		let along = {x:b.x-a.x, y:b.y-a.y};
		let amt = (circle.x-a.x)*along.x + (circle.y-a.y)*along.y;

		let len2 = along.x*along.x+along.y*along.y;
		amt = Math.max(0, amt);
		amt = Math.min(len2, amt);

		amt /= len2;

		let pt = {
			x: amt * (b.x-a.x) + a.x,
			y: amt * (b.y-a.y) + a.y
		};

		let dis2 = (pt.x-circle.x)*(pt.x-circle.x)+(pt.y-circle.y)*(pt.y-circle.y);

		if (dis2 < closestDis2) {
			closestPt = pt;
			closestDis2 = dis2;
		}
	}

	if (closestPt) {
		return { dis2:closestDis2, pt:closestPt };
	} else {
		return null;
	}

	/*
		there is a nicer way to do this where the code only checks corners between two failing edges.
		but I need a closest point anyway.
	
	//check edges:
	for (let eqn of convex.planes) {
		let dis = circle.x * eqn.x + circle.y * eqn.y + eqn.z;
		if (dis > circle.r) return false;
	}

	//check corners:
	for (let p of convex.points) {
		let dis2 = (p.x-circle.x)*(p.x-circle.x) + (p.y-circle.y)*(p.y-circle.y);
		if (dis2 < circle.r*circle.r) return true;
	}
	*/

	return false;
}

States.prototype.calculate = function States_calculate() {
	if (this.dirty >= this.ticks) return; //everything is calculated
	if (this.dirty == 0) {
		console.log("Will never compute 0 !!!");
		this.dirty = 1;
		return;
	}
	const delta = 60.0 / (LEVEL.ticksPerBeat * LEVEL.beatsPerMinute);
	const controls = {};
	{
		let val = CONTROLS[Math.floor((this.dirty-1) / LEVEL.ticksPerBeat)];
		controls.left = val & (1 << 3);
		controls.right = val & (1 << 2);
		controls.shield = val & (1 << 1);
		controls.jump = val & (1 << 0);
	}

	const ship = this.getShip(this.dirty-1);

	if (this.dead.tick >= this.dirty) {
		if (this.dead.tick === this.dirty) {
			this.dead.tick = this.ticks; //push death forward
		}

		{ //damping:
			const fac = Math.pow(0.5, delta / 1.5);
			ship.vx *= fac;
			ship.vy *= fac;
			ship.vr *= Math.pow(0.5, delta / 0.25);
		}

		//gravity:
		ship.vy += delta * -GRAVITY;

		function applyForce(x,y,fx,fy) {
			ship.vx += delta * fx / SHIP_MASS;
			ship.vy += delta * fy / SHIP_MASS;
			//ship.vr += delta * (fx * -y + fy * x) / SHIP_MOMENT;
		}

		function angleServo(r, k) {
			if (ship.r + Math.PI < r) r -= 2.0 * Math.PI;
			if (ship.r - Math.PI > r) r += 2.0 * Math.PI;
			let d = r - ship.r;
			ship.vr += delta * k * d;
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
			if (controls.right && controls.left) {
				angleServo(0.0, 10.0);
			} else if (controls.right) {
				angleServo(0.3 * Math.PI, 10.0);
			} else if (controls.left) {
				angleServo(-0.3 * Math.PI, 10.0);
			} else {
				angleServo(0.0, 0.5);
			}
		}

		{ //handbrake (sort of):
			if (controls.jump && (this.dirty % LEVEL.ticksPerBeat) === 1) {
				let dx, dy;
				if (controls.left && controls.right) {
					dx = 0.0; dy = 1.0;
				} else if (controls.left) {
					dx = 1.0; dy = 0.0;
				} else if (controls.right) {
					dx = -1.0; dy = 0.0;
				} else {
					dx = 0.0; dy = -1.0;
				}
				const JUMP_VELOCITY = 2.5;
				ship.vx = (ship.vx * 0.5) + JUMP_VELOCITY * dx;
				ship.vy = (ship.vy * 0.5) + JUMP_VELOCITY * dy;
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

		if (controls.shield) {
			ship.x += 0.5 * delta * ship.vx;
			ship.y += 0.5 * delta * ship.vy;
			ship.r += 0.5 * delta * ship.vr;
		} else {
			ship.x += delta * ship.vx;
			ship.y += delta * ship.vy;
			ship.r += delta * ship.vr;
		}

		ship.r = ship.r % (2.0 * Math.PI);

		{ //check vs level:
			let circle = {x:ship.x, y:ship.y, r:0.9*GLOBE_RADIUS};
			if (controls.shield) {
				circle.r = 0.95*SHIELD_RADIUS;
			}
			let closeHit = null;
			for (let convex of CONVEXES) {
				let hit = convexVsCircle(convex, circle);
				if (hit) {
					if (controls.shield) {
						if (closeHit === null || closeHit.dis2 > hit.dis2) {
							closeHit = hit;
						}
					} else {
						closeHit = hit;
						break;
					}
				}
			}
			if (closeHit) {
				if (controls.shield && closeHit.dis2 > 0.9*GLOBE_RADIUS * 0.9*GLOBE_RADIUS) {
					let out = {
						x:circle.x-closeHit.pt.x,
						y:circle.y-closeHit.pt.y
					};
					let len = Math.sqrt((out.x*out.x)+(out.y*out.y));
					out.x /= len;
					out.y /= len;
					let d = out.x * ship.vx + out.y * ship.vy;
					if (d < 0.0) {
						ship.vx += (1.5 * -d - d) * out.x;
						ship.vy += (1.5 * -d - d) * out.y;
					}
				} else {
					this.dead.tick = this.dirty;
					this.dead.x = ship.x;
					this.dead.y = ship.y;
					this.dead.vx = ship.vx;
					this.dead.vy = ship.vy;
					ship.vx = 0;
					ship.vy = 0;
					ship.vr = 0;
				}
			}
		}
	} else { //already dead
		//keep ship position
	}
	this.setShip(this.dirty, ship);

	// ---- key collection ---

	let haveKeys = 0;
	for (let i = 0; i < this.keys.length; ++i) {
		if (this.keys[i] == this.dirty) {
			this.keys[i] = this.ticks + 1; //mark as uncollected
		}
		//any key not yet collected is fair game for collection, if not dead:
		if (this.keys[i] >= this.dirty && (this.dead.tick > this.dirty)) {
			const x = LEVEL.keys[i].x;
			const y = LEVEL.keys[i].y;
			let dis2 = (x-ship.x)*(x-ship.x) + (y-ship.y)*(y-ship.y);
			if (dis2 < (GLOBE_RADIUS+KEY_RADIUS)*(GLOBE_RADIUS+KEY_RADIUS)) {
				this.keys[i] = this.dirty;
			}
		}
		if (this.keys[i] <= this.dirty) {
			haveKeys += 1;
		}
	}

	// --- unlocked update --
	if ((this.dirty % (LEVEL.ticksPerBeat * LEVEL.beatsPerMeasure)) === 0) {
		//entering a new measure.
		let measure = this.dirty / (LEVEL.ticksPerBeat * LEVEL.beatsPerMeasure);
		//console.log("Entering " + measure + " with " + haveKeys + " keys.");
		if (measure <= this.unlockedUntilMeasure) {
			let locks = 0;
			let newUIM = 0;
			for (let m = 0; m < LEVEL.measures.length; ++m) {
				if (LEVEL.measures[m].locked) locks += 1;
				if (locks > haveKeys) {
					newUIM = m;
					break;
				}
			}
			if (locks <= haveKeys) {
				newUIM = LEVEL.measures.length;
			}
			if (measure === newUIM || measure === this.unlockedUntilMeasure) {
				this.unlockedUntilMeasure = newUIM;
			}
			//console.log("Unlocked until " + this.unlockedUntilMeasure + " with " + locks + " locks.");
		}
	}

	if (this.dirty < 10) {
		//console.log(this.dirty, ship, delta);
	}


	this.dirty += 1;

};

const STATES = new States();

/*//DEBUG: init controls somehow:
for (let i = 0; i < CONTROLS.length; ++i) {
	if ((i % 20) < 5)     CONTROLS[i] |= 1;
	if (i % 10 > 3)       CONTROLS[i] |= 2;
	if ((i / 10) % 2)     CONTROLS[i] |= 4;
	if ((i + 4) % 13 < 3) CONTROLS[i] |= 8;
}*/

function setTime(time) {
	if (TRANSPORT.playhead == time) return;
	TRANSPORT.playhead = time;

	let loop_start = TRANSPORT.loop_start * LEVEL.beatsPerMeasure * 60.0 / LEVEL.beatsPerMinute;
	let loop_end = TRANSPORT.loop_end * LEVEL.beatsPerMeasure * 60.0 / LEVEL.beatsPerMinute;

	if (!TRANSPORT.playing) {
		TRANSPORT.playhead = Math.max(loop_start, Math.min(loop_end, TRANSPORT.playhead));
	}

	let beat = TRANSPORT.playhead / 60.0 * LEVEL.beatsPerMinute;
	{ //set camera position:
		let i = Math.max(0, Math.min(LEVEL.camera.length-2, Math.floor(beat)));
		const from = LEVEL.camera[i];
		const to = LEVEL.camera[i+1];
		const amt = Math.max(0, Math.min(1, beat - i));
		CAMERA.x = amt * (to.x - from.x) + from.x;
		CAMERA.y = amt * (to.y - from.y) + from.y;
		CAMERA.radius = amt * (to.radius - from.radius) + from.radius;
	}
}

function setLoop(loop_start, loop_end) {
	//TODO: clamp start/end based on locks in level and always force at least one measure to be inside loop range
	if (TRANSPORT.loop_start == loop_start && TRANSPORT.loop_end == loop_end) return;

	const old_end = TRANSPORT.loop_end;

	TRANSPORT.loop_start = loop_start;
	TRANSPORT.loop_end = loop_end;

	let start = TRANSPORT.loop_start * LEVEL.beatsPerMeasure / (LEVEL.beatsPerMinute / 60.0);
	TRANSPORT.playhead = Math.max(TRANSPORT.playhead, start);

	let end = TRANSPORT.loop_end * LEVEL.beatsPerMeasure / (LEVEL.beatsPerMinute / 60.0);
	TRANSPORT.playhead = Math.min(TRANSPORT.playhead, end);

	if (old_end < TRANSPORT.loop_end) {
		//re-queue music if changing loop range:
		if (TRANSPORT.playing) {
			play();
		}
	}

	//set measure positions:
	const LOOP_FACTOR = 1.0; //selected measures should be this much longer than unselected
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

	let calcStart = performance.now();
	STATES.calculate();
	STATES.calculate();
	STATES.calculate();
	STATES.calculate();
	/*
	for (let i = 0; i < 100; ++i) {
		const elapsed = performance.now() - calcStart;
		if (elapsed > 0.010) {
			window.DEBUG_steps = 2 + i;
			break;
		}
		STATES.calculate();
	}*/

	if (TRANSPORT.loop_end > STATES.unlockedUntilMeasure) {
		setLoop(Math.min(TRANSPORT.loop_start, STATES.unlockedUntilMeasure-1), STATES.unlockedUntilMeasure);
	}

	if (TERRAIN_BUFFER.dirty) TERRAIN_BUFFER.update();
	if (TRACKS_BUFFER.dirty) TRACKS_BUFFER.update();

	let playhead = TRANSPORT.playhead;
	let loop_start = TRANSPORT.loop_start * LEVEL.beatsPerMeasure * 60.0 / LEVEL.beatsPerMinute;
	let loop_end = TRANSPORT.loop_end * LEVEL.beatsPerMeasure * 60.0 / LEVEL.beatsPerMinute;
	let musicSkip = false;
	if (TRANSPORT.playing) {
		playhead += elapsed;
		if (playhead < loop_start) {
			playhead = loop_start;
			musicSkip = true;
		}
		if (playhead > loop_end) {
			playhead = (playhead - loop_start) % (loop_end - loop_start) + loop_start;
			if (playhead < loop_start) playhead += (loop_end - loop_start);
			musicSkip = true;
		}
	} else {
		if (playhead < loop_start) playhead = loop_start;
		if (playhead > loop_end) playhead = loop_end;
	}
	setTime(playhead);
	if (musicSkip) {
		play();
	}

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

	console.log(attribs.length / (stride/4) + " terrain attribs.");
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
			let c;
			if (beat === 0) {
				c = [1,1,1,0.1];
			} else if (beat % 2 === 0) {
				c = [0,0,0,0.1];
			} else {
				continue;
			}

			rect(x0+w*beat, -1.0, w, ROLL_HEIGHT, c,c,c,c);
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
setLoop(0,4);

//------------------------------

const PICKUP_DIRS = [];
for (let i = 0; i < 10; ++i) {
	PICKUP_DIRS.push({x:Math.random()*2-1, y:Math.random()*2-1});
}

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
		let deadTime = STATES.dead.tick / LEVEL.ticksPerBeat / LEVEL.beatsPerMinute * 60.0;
		if (deadTime < TRANSPORT.playhead) {
			//draw explosion(?) of ship:
			
			function pickupEffect(ofs,amt, name, x,y, rx,ry, sx,sy) {
				let tint = [1.0, 1.0, 1.0, 1.0-amt];
				let s = 2.0 * (1.0 - (1.0-amt)*(1.0-amt));
				for (const d of PICKUP_DIRS) {
					drawObject(name, x+s*d.x,y+s*d.y, d.y,d.x, (1.0-amt)*sx,(1.0-amt)*sy, tint);
				}
			}

			drawObject("dead", state.ship.x,state.ship.y-GLOBE_RADIUS, 1,0, 2*GLOBE_RADIUS,2*GLOBE_RADIUS);

			let amt = (TRANSPORT.playhead - deadTime) / 1.5;
			if (amt < 1.0) {
				pickupEffect(STATES.dead.tick,amt, "fire", STATES.dead.x,STATES.dead.y, 1,0, 3*GLOBE_RADIUS,3*GLOBE_RADIUS);
			}
		} else {
			//draw ship:
			let at = {x:state.ship.x, y:state.ship.y};
			let right = {x:Math.cos(state.ship.r), y:Math.sin(state.ship.r)};

			if (state.jump) {
				let amt = (TRANSPORT.playhead - state.jump.time) / (0.75 * 60.0 / LEVEL.beatsPerMinute);
				if (amt < 1.0) {
					let jr = {x:Math.cos(20*amt-TRANSPORT.playhead), y:Math.sin(20*amt-TRANSPORT.playhead)};
					let r = GLOBE_RADIUS * (1 + 6*amt*amt);
					let a = 1.0 - amt*amt;
					drawObject("shipCore", state.jump.x,state.jump.y, jr.x,jr.y, 2*r,2*r, [1,1,1,a]);
					drawObject("shipCore", state.jump.x,state.jump.y, -jr.x,jr.y, 1.8*r,1.8*r, [1,1,1,0.5*a]);
				}
			}

			if (state.shield) {
				drawObject("shipShieldBack", at.x,at.y, right.x,right.y, 2*SHIELD_RADIUS,2*SHIELD_RADIUS);
			}

			drawObject("shipBeam", at.x,at.y, right.x,right.y, 2*DISH_RADIUS,Infinity);

			let coreRight = {x:Math.cos(state.ship.r+TRANSPORT.playhead), y:Math.sin(state.ship.r+TRANSPORT.playhead)};

			drawObject("shipCore", at.x,at.y, coreRight.x,coreRight.y, 2*GLOBE_RADIUS,2*GLOBE_RADIUS);
			drawObject("shipGlass", at.x,at.y, 1,0, 2*GLOBE_RADIUS,2*GLOBE_RADIUS);

			if (state.right) {
				//TEST:
				let amt = 0.2 * Math.random();
				drawObject("jetPlume", at.x+right.x*JET_RADIUS-right.y*-0.1,at.y+right.y*JET_RADIUS+right.x*-0.1, right.x,right.y,
					Infinity, 0.3 - 0.2*amt, [...TRACK_COLORS[2],0.4 + 0.2 * amt]);
			}

			if (state.left) {
				//TEST:
				let amt = 0.2 * Math.random();
				drawObject("jetPlume", at.x-right.x*JET_RADIUS-right.y*-0.1,at.y-right.y*JET_RADIUS+right.x*-0.1, right.x,right.y,
					Infinity, 0.3 - 0.2*amt, [...TRACK_COLORS[3],0.4 + 0.2 * amt]);
			}

			drawObject("shipJet", at.x+right.x*JET_RADIUS,at.y+right.y*JET_RADIUS, right.x,right.y, Infinity, 0.3, TRACK_COLORS[2]);
			drawObject("shipJet", at.x-right.x*JET_RADIUS,at.y-right.y*JET_RADIUS, right.x,right.y, Infinity, 0.3, TRACK_COLORS[3]);

			drawObject("shipDish", at.x+right.x*DISH_RADIUS,at.y+right.y*DISH_RADIUS, right.x,right.y, Infinity,0.3, TRACK_COLORS[1]);
			drawObject("shipDish", at.x-right.x*DISH_RADIUS,at.y-right.y*DISH_RADIUS, -right.x,-right.y, Infinity,0.3, TRACK_COLORS[1]);

			if (state.shield) {
				drawObject("shipShield", at.x,at.y, right.x,right.y, 2*SHIELD_RADIUS,2*SHIELD_RADIUS);
			}
		}

		function pickupEffect(ofs,amt, name, x,y, rx,ry, sx,sy) {
			let tint = [1.0, 1.0, 1.0, 1.0-amt];
			for (const d of PICKUP_DIRS) {
				drawObject(name, x+amt*d.x,y+amt*d.y, rx,ry, (1.0-amt)*sx,(1.0-amt)*sy, tint);
			}
		}

		for (let i = 0; i < state.keys.length; ++i) { //draw keys:
			if (state.keys[i] === null) {
				drawObject("key", LEVEL.keys[i].x,LEVEL.keys[i].y, 1,0, Infinity,2*KEY_RADIUS);
			} else {
				const age = TRANSPORT.playhead - (state.keys[i] * 60 / (LEVEL.ticksPerBeat * LEVEL.beatsPerMinute));
				if (age < 0.5) {
					pickupEffect(state.keys[i], age/0.5, "key",LEVEL.keys[i].x,LEVEL.keys[i].y, 1,0, 2*KEY_RADIUS,2*KEY_RADIUS);
				}
			}
			
		}
	}

	let uiAttribs = []; //(x,y, tx,ty, r,g,b,a)

	function uiRect(x, y, w, h, c0, c1, c2, c3) {
		if (uiAttribs.length > 0) uiAttribs.push(...uiAttribs.slice(-8));
		uiAttribs.push(x,y, 0,0, ...c0);
		if (uiAttribs.length !== 8) uiAttribs.push(...uiAttribs.slice(-8));
		uiAttribs.push(x,y+h, 0,0, ...c1);
		uiAttribs.push(x+w,y, 0,0, ...c2);
		uiAttribs.push(x+w,y+h, 0,0, ...c3);
	}

	function uiObject(name, x,y, szX,szY, tint) {
		if (typeof(tint) === 'undefined') tint = [1,1,1,1];
		if (tint.length === 3) tint = [...tint, 1];

		const obj = OBJECTS[name];
		const scaleY = Math.min( szX / (obj.sizeX / CANVAS.aspect), szY / obj.sizeY );
		const scaleX = scaleY / CANVAS.aspect;

		if (uiAttribs.length > 0) uiAttribs.push(...uiAttribs.slice(-8));
		uiAttribs.push(
			x + scaleX * (-obj.anchorX + obj.minX), y + scaleY * (-obj.anchorY + obj.minY),
			obj.minX / TEXTURES.objects.width, 1.0 - obj.minY / TEXTURES.objects.height,
			...tint
		);
		if (uiAttribs.length !== 8) uiAttribs.push(...uiAttribs.slice(-8));
		uiAttribs.push(
			x + scaleX * (-obj.anchorX + obj.maxX), y + scaleY * (-obj.anchorY + obj.minY),
			obj.maxX / TEXTURES.objects.width, 1.0 - obj.minY / TEXTURES.objects.height,
			...tint
		);
		uiAttribs.push(
			x + scaleX * (-obj.anchorX + obj.minX), y + scaleY * (-obj.anchorY + obj.maxY),
			obj.minX / TEXTURES.objects.width, 1.0 - obj.maxY / TEXTURES.objects.height,
			...tint
		);
		uiAttribs.push(
			x + scaleX * (-obj.anchorX + obj.maxX), y + scaleY * (-obj.anchorY + obj.maxY),
			obj.maxX / TEXTURES.objects.width, 1.0 - obj.maxY / TEXTURES.objects.height,
			...tint
		);
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

	//key markers:
	for (let i = 0; i < STATES.keys.length; ++i) {
		let tick = STATES.keys[i];
		if (tick <= STATES.ticks) {
			let measure = tick / (LEVEL.ticksPerBeat * LEVEL.beatsPerMeasure);
			let amt = measure - Math.floor(measure);
			measure = Math.floor(measure);

			let x0 = TRANSPORT.measurePos[measure];
			let x1 = TRANSPORT.measurePos[measure+1];

			let x = amt * (x1-x0) + x0;

			uiObject("key", x,-1.0+ROLL_HEIGHT + HANDLE_HEIGHT, Infinity,1.8*HANDLE_HEIGHT);
		}
	}


	//locks:
	for (let i = LEVEL.measures.length - 1; i >= 0; --i) {
		const m = LEVEL.measures[i];
		if (m.locked) {
			const x0 = TRANSPORT.measurePos[i];
			if (i < STATES.unlockedUntilMeasure) {
				let y = -1.0 + ROLL_HEIGHT;
				if (i == TRANSPORT.loop_start || i == TRANSPORT.loop_end) {
					y += HANDLE_HEIGHT;
				}
				uiObject("unlocked", x0, y, Infinity,2*HANDLE_HEIGHT);
			} else {
				const y = -1.0 + 0.5 * ROLL_HEIGHT;
				const end = TRANSPORT.measurePos[TRANSPORT.measurePos.length-1];
				const c0 = [0,0,0,1];
				const c1 = [0.2,0.2,0.2,0.5];
				uiRect(x0,-1.0, 0.03,ROLL_HEIGHT, c0,c0,c1,c1);
				uiRect(x0+0.03,-1.0, end-(x0+0.03),ROLL_HEIGHT, c1,c1,c1,c1);
				uiObject("locked", x0, y, Infinity,2*HANDLE_HEIGHT);
			}
		}
	}

	if (STATES.dead.tick < STATES.ticks) {
		const beat = STATES.dead.tick / LEVEL.ticksPerBeat;
		const measure = Math.floor(beat / LEVEL.beatsPerMeasure);
		const x0 = TRANSPORT.measurePos[measure];
		const x1 = TRANSPORT.measurePos[measure+1];
		const amt = (beat - measure * LEVEL.beatsPerMeasure) / LEVEL.beatsPerMeasure;
		const x = amt * (x1-x0) + x0;
		let y = -1.0 + ROLL_HEIGHT;
		uiObject("dead", x, y, Infinity,1*HANDLE_HEIGHT);
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
		let prog = SHADERS.textureColor;

		const u = {};

		u.uObjectToClip = new Float32Array([
			1.0, 0.0, 0.0, 0.0,
			0.0, 1.0, 0.0, 0.0,
			0.0, 0.0, 1.0, 0.0,
			0.0, 0.0, 0.0, 1.0
		]);

		u.uTex = [0];

		setUniforms(prog, u);

		//upload and draw arrow attribs:
		gl.bindBuffer(gl.ARRAY_BUFFER, MISC_BUFFER);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uiAttribs), gl.STREAM_DRAW);

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

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, uiAttribs.length/(stride/4));

		gl.bindTexture(gl.TEXTURE_2D, null);
	}
}


