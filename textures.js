const TEXTURES = {};
const OBJECTS = {};

async function loadTexture(url) {
	return new Promise((resolve, reject) => {
		const texture = gl.createTexture();
		const image = new Image();
		image.onload = function() {
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
			gl.generateMipmap(gl.TEXTURE_2D);
	
			gl.bindTexture(gl.TEXTURE_2D, null);
			texture.width = image.width;
			texture.height = image.height;
			resolve(texture);
		};
		image.onerror = function() {
			console.log("Error loading image at '" + url + "'.");
			reject("Error loading image at '" + url + "'.");
		};
		image.src = url;
	});

};

TEXTURES.load = async function TEXTURES_load(callback) {
	//based on https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
	TEXTURES.objects = await loadTexture("objects.png");
	//OBJECTS contains the boundary points for an object and padded texture coords for that object,
	// both in texture space:
	function add(name, anchorX, anchorY, sizeX,sizeY, minX,minY, maxX,maxY, ofsX,ofsY) {
		if (typeof(ofsX) === 'undefined') ofsX = 0;
		if (typeof(ofsY) === 'undefined') ofsY = 0;
		OBJECTS[name] = {
			anchorX:anchorX+ofsX, anchorY:anchorY+ofsY,
			sizeX:sizeX, sizeY:sizeY,
			minX:minX+ofsX, minY:minY+ofsY,
			maxX:maxX+ofsX, maxY:maxY+ofsY,
		};
	}
	add("shipGlass",
		64,64, 96,96,
		8,8, 120,120
	);
	add("shipBeam",
		64,64, 96,16,
		0,48, 128,80,
		1*128, 0
	);
	add("shipJet",
		64,64, 48,96,
		20,0, 108,128,
		2*128, 0
	);
	add("shipDish",
		16,64, 48,96,
		0,0, 80,128,
		3*128, 0
	);
	add("key",
		64,64, 48,112,
		32,0, 96,128,
		4*128, 0
	);
	add("locked",
		16,48, 64,112,
		16,0, 112,128,
		5*128, 0
	);
	add("unlocked",
		64,0, 64,112,
		16,0, 112,128,
		6*128, 0
	);
	console.log(OBJECTS);
};
