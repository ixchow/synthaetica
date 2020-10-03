"use strict";

const LEVEL = {
	terrain:[
		{
			color:[0.5,0.5,0.5],
			points:[-10.0,0.0, 10.0,0.0, 10.0,2.0]
		},
		{
			color:[0.5,0.5,0.5],
			points:[10.0,2.0, 10.0,0.0, 20.0,0.0, 20.0,2.0]
		},
		{
			color:[0.5,0.5,0.5],
			points:[20.0,2.0, 20.0,0.0, 25.0,0.0, 25.0,1.0]
		},
	],
	sparks:[
		{ x:3.0, y:2.5 },
		{ x:6.0, y:7.5 },
	],
	rifts:[ //can use purple to grab a rift
		{ x:5.0, y:8.0 },
	],
	enemies:[
	],
	music:"xyz.ogg",
	beatsPerMinute:120.0,
	beatsPerMeasure:4,
	ticksPerBeat:15,
	measures:[
		{}, {}, {}, {locks:1}, {}, {}, {}, {}, {}, {},
		{}, {}, {}, {locks:1}, {}, {}, {}, {locks:2}, {}, {},
		{}, {}, {}, {}, {}, {}, {}, {}, {}, {}
	],
	start:{x:0.0, y:5.0, r:0.0, vx:0.0, vy:0.0, vr:0.0},
	camera:[
		{ beat:0, x:0.0, y:5.0, radius:5.0 },
		{ beat:4*30, x:50.0, y:5.0, radius:5.0 },
	],
};
