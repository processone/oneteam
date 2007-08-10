build:
	$(MAKE) -C componentsSrc
	-rm -rf buildDir
	mkdir buildDir
	mkdir buildDir/chrome
	cd chrome; zip -0r ../buildDir/chrome/otcompanion.jar .
	cp -r components/ platform/ chrome.manifest install.rdf buildDir/
	cd buildDir; zip -9r ../../web/otcompanion.xpi .
	@rm -rf buildDir
