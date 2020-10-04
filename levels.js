"use strict";
const LEVEL = 
{
	beatsPerMinute:120,
	beatsPerMeasure:4,
	ticksPerBeat:15,
	camera:[
		{ x:0.0, y:5.0, radius:5.0 },
		{ x:1.0, y:5.0, radius:5.0 },
		{ x:2.0, y:5.0, radius:5.0 },
		{ x:3.0, y:5.0, radius:5.0 },
		{ x:4.0, y:5.0, radius:5.0 },
		{ x:5.0, y:5.0, radius:5.0 },
		{ x:6.0, y:5.0, radius:5.0 },
		{ x:7.0, y:5.0, radius:5.0 },
		{ x:8.0, y:5.0, radius:5.0 },
		{ x:9.0, y:5.0, radius:5.0 },
		{ x:10.0, y:5.0, radius:5.0 },
		{ x:11.0, y:5.0, radius:5.0 },
		{ x:12.0, y:5.0, radius:5.0 },
		{ x:13.0, y:5.0, radius:5.0 },
		{ x:14.0, y:5.0, radius:5.0 },
		{ x:15.0, y:5.0, radius:5.0 },
		{ x:16.0, y:5.0, radius:5.0 },
		{ x:17.0, y:5.0, radius:5.0 },
		{ x:18.0, y:5.0, radius:5.0 },
		{ x:19.0, y:5.0, radius:5.0 },
		{ x:20.0, y:5.0, radius:5.0 },
		{ x:21.0, y:5.0, radius:5.0 },
		{ x:22.0, y:5.0, radius:5.0 },
		{ x:23.0, y:5.0, radius:5.0 },
		{ x:24.0, y:5.0, radius:5.0 },
		{ x:25.0, y:5.0, radius:5.0 },
		{ x:26.0, y:5.0, radius:5.0 },
		{ x:27.0, y:5.0, radius:5.0 },
		{ x:28.0, y:5.0, radius:5.0 },
		{ x:29.0, y:5.0, radius:5.0 },
		{ x:30.0, y:5.0, radius:5.0 },
		{ x:30.0, y:5.066666603088379, radius:5.0 },
		{ x:30.0, y:5.133333206176758, radius:5.0 },
		{ x:30.0, y:5.199999809265137, radius:5.0 },
		{ x:30.0, y:5.266666889190674, radius:5.0 },
		{ x:30.0, y:5.333333492279053, radius:5.0 },
		{ x:30.0, y:5.400000095367432, radius:5.0 },
		{ x:30.0, y:5.4666666984558105, radius:5.0 },
		{ x:30.0, y:5.5333333015441895, radius:5.0 },
		{ x:30.0, y:5.599999904632568, radius:5.0 },
		{ x:30.0, y:5.666666507720947, radius:5.0 },
		{ x:30.0, y:5.733333587646484, radius:5.0 },
		{ x:30.0, y:5.800000190734863, radius:5.0 },
		{ x:30.0, y:5.866666793823242, radius:5.0 },
		{ x:30.0, y:5.933333396911621, radius:5.0 },
		{ x:30.0, y:6.0, radius:5.0 },
		{ x:30.0, y:6.449999809265137, radius:5.0 },
		{ x:30.0, y:6.900000095367432, radius:5.0 },
		{ x:30.0, y:7.349999904632568, radius:5.0 },
		{ x:30.0, y:7.800000190734863, radius:5.0 },
		{ x:30.0, y:8.25, radius:5.0 },
		{ x:30.0, y:8.699999809265137, radius:5.0 },
		{ x:30.0, y:9.149999618530273, radius:5.0 },
		{ x:30.0, y:9.600000381469727, radius:5.0 },
		{ x:30.0, y:10.050000190734863, radius:5.0 },
		{ x:30.0, y:10.5, radius:5.0 },
		{ x:30.0, y:10.949999809265137, radius:5.0 },
		{ x:30.0, y:11.399999618530273, radius:5.0 },
		{ x:30.0, y:11.850000381469727, radius:5.0 },
		{ x:30.0, y:12.300000190734863, radius:5.0 },
		{ x:30.0, y:12.75, radius:5.0 },
		{ x:30.0, y:13.199999809265137, radius:5.0 },
		{ x:30.0, y:13.649999618530273, radius:5.0 },
		{ x:30.0, y:14.100000381469727, radius:5.0 },
		{ x:30.0, y:14.550000190734863, radius:5.0 },
		{ x:30.0, y:15.0, radius:5.0 },
		{ x:31.0, y:15.0, radius:5.0 },
		{ x:32.0, y:15.0, radius:5.0 },
		{ x:33.0, y:15.0, radius:5.0 },
		{ x:34.0, y:15.0, radius:5.0 },
		{ x:35.0, y:15.0, radius:5.0 },
		{ x:36.0, y:15.0, radius:5.0 },
		{ x:37.0, y:15.0, radius:5.0 },
		{ x:38.0, y:15.0, radius:5.0 },
		{ x:39.0, y:15.0, radius:5.0 },
		{ x:40.0, y:15.0, radius:5.0 },
		{ x:41.0, y:15.0, radius:5.0 },
		{ x:42.0, y:15.0, radius:5.0 },
		{ x:43.0, y:15.0, radius:5.0 },
		{ x:44.0, y:15.0, radius:5.0 },
		{ x:45.0, y:15.0, radius:5.0 },
		{ x:45.06666564941406, y:15.066666603088379, radius:5.0 },
		{ x:45.13333511352539, y:15.133333206176758, radius:5.0 },
		{ x:45.20000076293945, y:15.199999809265137, radius:5.0 },
		{ x:45.266666412353516, y:15.266666412353516, radius:5.0 },
		{ x:45.33333206176758, y:15.333333015441895, radius:5.0 },
		{ x:45.400001525878906, y:15.399999618530273, radius:5.0 },
		{ x:45.46666717529297, y:15.466666221618652, radius:5.0 },
		{ x:45.53333282470703, y:15.533333778381348, radius:5.0 },
		{ x:45.599998474121094, y:15.600000381469727, radius:5.0 },
		{ x:45.66666793823242, y:15.666666984558105, radius:5.0 },
		{ x:45.733333587646484, y:15.733333587646484, radius:5.0 },
		{ x:45.79999923706055, y:15.800000190734863, radius:5.0 },
		{ x:45.86666488647461, y:15.866666793823242, radius:5.0 },
		{ x:45.93333435058594, y:15.933333396911621, radius:5.0 },
		{ x:46.0, y:16.0, radius:5.0 },
		{ x:46.33333206176758, y:16.75, radius:5.0 },
		{ x:46.66666793823242, y:17.5, radius:5.0 },
		{ x:47.0, y:18.25, radius:5.0 },
		{ x:47.33333206176758, y:19.0, radius:5.0 },
		{ x:47.66666793823242, y:19.75, radius:5.0 },
		{ x:48.0, y:20.5, radius:5.0 },
		{ x:48.33333206176758, y:21.25, radius:5.0 },
		{ x:48.66666793823242, y:22.0, radius:5.0 },
		{ x:49.0, y:22.75, radius:5.0 },
		{ x:49.33333206176758, y:23.5, radius:5.0 },
		{ x:49.66666793823242, y:24.25, radius:5.0 },
		{ x:50.0, y:25.0, radius:5.0 },
		{ x:52.0, y:24.5, radius:5.0 },
		{ x:54.0, y:24.0, radius:5.0 },
		{ x:56.0, y:23.5, radius:5.0 },
		{ x:58.0, y:23.0, radius:5.0 },
		{ x:60.0, y:22.5, radius:5.0 },
		{ x:62.0, y:22.0, radius:5.0 },
		{ x:64.0, y:21.5, radius:5.0 },
		{ x:66.0, y:21.0, radius:5.0 },
		{ x:68.0, y:20.5, radius:5.0 },
		{ x:70.0, y:20.0, radius:5.0 },
		{ x:72.0, y:19.5, radius:5.0 },
		{ x:74.0, y:19.0, radius:5.0 },
		{ x:76.0, y:18.5, radius:5.0 },
	],
	start:{ x:0.0, y:5.0, r:0.0, vx:0, vy:0, vr:0 },
	measures:[ {}, {}, {locked:1}, {}, {locked:1}, {}, {}, {}, {}, {}, {}, {locked:1}, {}, {}, {}, {}, {}, {locked:1}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, ],
	keys:[ {x:0.0, y:3.0}, {x:4.3, y:4.3}, {x:37.9, y:4.7}, {x:21.9, y:17.5}, {x:39.0, y:13.6}, {x:50.0, y:13.2}, {x:49.4, y:23.6}, {x:67.3, y:27.8}, {x:88.8, y:12.0}, {x:106.7, y:13.1}, {x:111.4, y:27.2}, {x:120.3, y:15.5}, {x:131.3, y:29.8}, {x:74.9, y:17.5}, ],
	terrain:[ {color:[0.5,0.5,0.5], points:[-9.0,-1.0,5.0,-1.0,5.0,3.0,-9.0,1.0]},
 {color:[0.5,0.5,0.5], points:[5.0,3.0,5.0,-1.0,10.0,-1.0,10.0,3.0]},
 {color:[0.5,0.5,0.5], points:[10.0,3.0,10.0,-1.0,20.0,-1.0,20.0,1.0]},
 {color:[0.5,0.5,0.5], points:[20.0,1.0,20.0,-1.0,38.0,-1.0,38.0,1.0]},
 {color:[0.5,0.5,0.5], points:[38.0,1.0,38.0,-1.0,41.0,-1.0,40.5,2.96]},
 {color:[0.5,0.5,0.5], points:[41.0,6.0,45.0,5.34,44.0,10.0,41.3,10.0]},
 {color:[0.5,0.5,0.5], points:[41.0,6.0,41.3,10.0,37.5,9.58,38.0,6.84]},
 {color:[0.5,0.5,0.5], points:[38.0,6.84,37.5,9.58,33.2,8.04,34.6,5.61]},
 {color:[0.5,0.5,0.5], points:[41.3,10.0,44.0,10.0,43.3,12.1,41.0,12.4]},
 {color:[0.5,0.5,0.5], points:[41.0,12.4,43.3,12.1,42.7,16.0,41.4,15.8]},
 {color:[0.5,0.5,0.5], points:[42.7,16.0,43.3,12.1,47.8,11.5,46.8,14.2]},
 {color:[0.5,0.5,0.5], points:[43.3,12.1,44.0,10.0,49.9,10.4,47.8,11.5]},
 {color:[0.5,0.5,0.5], points:[49.9,10.4,55.7,6.78,52.1,11.9]},
 {color:[0.5,0.5,0.5], points:[45.0,5.34,55.7,6.78,49.9,10.4,44.0,10.0]},
 {color:[0.5,0.5,0.5], points:[52.1,11.9,55.7,6.78,54.7,20.8,53.2,16.1]},
 {color:[0.5,0.5,0.5], points:[50.7,19.2,53.2,16.1,54.7,20.8,50.8,21.2]},
 {color:[0.5,0.5,0.5], points:[45.7,-0.82,45.0,5.34,41.0,6.0,40.5,2.96,41.0,-1.0]},
 {color:[0.5,0.5,0.5], points:[54.7,20.8,55.7,6.78,65.1,11.3,65.4,22.1]},
 {color:[0.5,0.5,0.5], points:[65.4,22.1,65.1,11.3,73.4,11.3,74.2,16.3]},
 {color:[0.5,0.5,0.5], points:[74.2,16.3,73.4,11.3,77.3,8.3,80.1,16.3]},
 {color:[0.5,0.5,0.5], points:[80.1,16.3,77.3,8.3,83.6,7.72,85.8,13.8]},
 {color:[0.5,0.5,0.5], points:[85.8,13.8,83.6,7.72,86.6,5.41,87.4,10.4]},
 {color:[0.5,0.5,0.5], points:[86.6,5.41,91.4,5.7,91.5,10.7,87.4,10.4]},
 {color:[0.5,0.5,0.5], points:[91.5,10.7,91.4,5.7,96.0,5.85,96.1,10.8]},
 {color:[0.5,0.5,0.5], points:[96.1,10.8,96.0,5.85,1.02e+02,5.99,1.02e+02,11.0]},
 {color:[0.5,0.5,0.5], points:[91.5,10.7,96.1,10.8,95.0,13.8,92.4,13.7]},
 {color:[0.5,0.5,0.5], points:[1.02e+02,11.0,1.02e+02,5.99,1.08e+02,6.06,1.08e+02,11.0]},
 {color:[0.5,0.5,0.5], points:[1.08e+02,11.0,1.08e+02,6.06,1.14e+02,5.99,1.15e+02,11.7]},
 {color:[0.5,0.5,0.5], points:[1.15e+02,11.7,1.14e+02,5.99,1.22e+02,5.99,1.21e+02,12.5]},
 {color:[0.5,0.5,0.5], points:[1.21e+02,12.5,1.22e+02,5.99,1.3e+02,5.77,1.3e+02,10.7]},
 {color:[0.5,0.5,0.5], points:[1.08e+02,11.0,1.15e+02,11.7,1.14e+02,17.3,1.1e+02,17.4]},
 {color:[0.5,0.5,0.5], points:[1.1e+02,17.4,1.14e+02,17.3,1.13e+02,23.3,1.1e+02,21.9]},
 {color:[0.5,0.5,0.5], points:[1.21e+02,12.5,1.3e+02,10.7,1.3e+02,17.4,1.24e+02,18.2]},
 {color:[0.5,0.5,0.5], points:[1.24e+02,18.2,1.3e+02,17.4,1.3e+02,25.9,1.24e+02,25.3]},
 {color:[0.5,0.5,0.5], points:[1.3e+02,25.9,1.3e+02,17.4,1.43e+02,19.8,1.39e+02,27.1]},
 {color:[0.5,0.5,0.5], points:[1.39e+02,27.1,1.43e+02,19.8,1.48e+02,36.1,1.39e+02,32.4]},
 {color:[0.5,0.5,0.5], points:[1.39e+02,32.4,1.48e+02,36.1,1.4e+02,38.0,1.36e+02,34.7]},
 {color:[0.5,0.5,0.5], points:[-9.0,11.0,-9.0,9.0,-4.0,9.0,-4.0,11.0]},
 {color:[0.5,0.5,0.5], points:[-4.0,11.0,-4.0,9.0,6.0,10.0,6.0,11.0]},
 {color:[0.5,0.5,0.5], points:[6.0,11.0,6.0,10.0,10.0,10.0,10.0,11.0]},
 {color:[0.5,0.5,0.5], points:[10.0,11.0,10.0,10.0,18.0,9.0,18.0,11.0]},
 {color:[0.5,0.5,0.5], points:[18.0,11.0,18.0,9.0,20.0,9.0,20.0,11.0]},
 {color:[0.5,0.5,0.5], points:[18.0,11.0,20.0,11.0,20.0,19.0,18.0,19.0]},
 {color:[0.5,0.5,0.5], points:[18.0,19.0,20.0,19.0,20.0,21.0,18.0,21.0]},
 {color:[0.5,0.5,0.5], points:[20.0,21.0,20.0,19.0,42.0,19.0,42.0,21.0]},
 {color:[0.5,0.5,0.5], points:[1.31e+02,34.4,1.35e+02,34.9,1.35e+02,36.8,1.31e+02,36.4]},
 {color:[0.5,0.5,0.5], points:[1.31e+02,34.4,1.31e+02,36.4,1.27e+02,36.8,1.27e+02,34.8]},
 {color:[0.5,0.5,0.5], points:[1.27e+02,34.8,1.27e+02,36.8,1.2e+02,38.2,1.2e+02,34.2]},
 {color:[0.5,0.5,0.5], points:[1.2e+02,34.2,1.2e+02,38.2,1.15e+02,38.4,1.15e+02,34.4]},
 {color:[0.5,0.5,0.5], points:[1.2e+02,34.2,1.15e+02,34.4,1.16e+02,26.9,1.2e+02,28.2]},
 {color:[0.5,0.5,0.5], points:[1.2e+02,28.2,1.16e+02,26.9,1.17e+02,19.9,1.19e+02,19.9]},
 {color:[0.5,0.5,0.5], points:[1.16e+02,26.9,1.15e+02,34.4,1.11e+02,36.3,1.11e+02,29.0]},
 {color:[0.5,0.5,0.5], points:[1.11e+02,29.0,1.11e+02,36.3,1.02e+02,36.0,1.04e+02,27.8]},
 {color:[0.5,0.5,0.5], points:[1.04e+02,27.8,1.02e+02,36.0,96.3,35.8,98.0,28.2]},
 {color:[0.5,0.5,0.5], points:[1.04e+02,27.8,98.0,28.2,99.3,20.7,1.04e+02,21.1]},
 {color:[0.5,0.5,0.5], points:[1.04e+02,21.1,99.3,20.7,1.01e+02,19.0,1.03e+02,18.3]},
 {color:[0.5,0.5,0.5], points:[99.3,20.7,98.0,28.2,93.4,28.4,92.9,22.9]},
 {color:[0.5,0.5,0.5], points:[92.9,22.9,93.4,28.4,86.3,33.2,83.8,26.6]},
 {color:[0.5,0.5,0.5], points:[83.8,26.6,86.3,33.2,68.9,35.1,66.6,29.5]},
 {color:[0.5,0.5,0.5], points:[66.6,29.5,68.9,35.1,49.8,34.3,52.4,28.9]},
 {color:[0.5,0.5,0.5], points:[52.4,28.9,49.8,34.3,34.6,33.1,38.1,29.1]},
 {color:[0.5,0.5,0.5], points:[38.1,29.1,34.6,33.1,34.1,20.7,37.6,20.6]},
 ],
}
;
