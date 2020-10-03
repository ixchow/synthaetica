"use strict";

const LEVEL = {
	terrain:[
		{
			color:[0.5,0.5,0.5],
			points:[0.0, 0.0, 5.0, 0.0, 5.0, 1.0, 0.0, 1.0]
		}
	],
	sparks:[
		{ x:3.0, y:2.5, collectedAt:NaN },
		{ x:6.0, y:7.5, collectedAt:NaN },
	],
	rifts:[ //can use purple to grab a rift
		{ x:5.0, y:8.0 },
	],
	enemies:[
	],
	music:"xyz.ogg",
	beatsPerMinute:120.0,
	beatsPerMeasure:4,
	ticksPerBeat:50,
	measures:[
		{}, {}, {}, {locks:1}, {}, {}, {}, {}, {}, {},
		{}, {}, {}, {locks:1}, {}, {}, {}, {locks:2}, {}, {},
		{}, {}, {}, {}, {}, {}, {}, {}, {}, {}
	],
	start:{x:0.0, y:5.0},
	camera:[
		{ beat:0, x:0.0, y:5.0, radius:5.0 },
		{ beat:4*30, x:50.0, y:5.0, radius:5.0 },
	],
};
