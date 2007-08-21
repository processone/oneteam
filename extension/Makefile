build:
	$(MAKE) -C componentsSrc
	-rm -rf buildDir
	-rm -rf chromeDir
	mkdir buildDir
	mkdir buildDir/chrome
	mkdir chromeDir
	-cp -r chrome/* chromeDir/
	-mkdir chromeDir/content
	-mkdir chromeDir/skin
	-mkdir chromeDir/skin/classic
	cp ../chrome/oneteam/content/notifications.xul chromeDir/content/
	cp -r ../chrome/oneteam/skin/default/notifications/ chromeDir/skin/classic/
	find chromeDir -type f | xargs perl -pi -e 's!chrome://oneteam/!chrome://otcompanion/!g'
	cd chromeDir; zip -0r ../buildDir/chrome/otcompanion.jar .
	rm -rf chromeDir
	cp -r components/ platform/ chrome.manifest install.rdf buildDir/
	cd buildDir; zip -9r ../../web/otcompanion.xpi .
	@rm -rf buildDir
