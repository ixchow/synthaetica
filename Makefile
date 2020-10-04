
BLENDER=../blender-2.90.0-linux64/blender
INKSCAPE=inkscape

all : objects.png levels.js

levels.js : level1.js
	echo '"use strict";' > levels.js
	echo 'const LEVEL = ' >> levels.js
	cat level1.js >> levels.js
	echo ';' >> levels.js

level1.js : level.blend export-level.py
	$(BLENDER) --background --python export-level.py -- '$<' '$@'

objects.png : objects.svg
	$(INKSCAPE) --export-area-page --export-background-opacity='0.0' --export-width=1024 --export-filename='$@' '$<'
