
INKSCAPE=inkscape

objects.png : objects.svg
	$(INKSCAPE) --export-area-page --export-background-opacity='0.0' --export-width=1024 --export-filename='$@' '$<'
