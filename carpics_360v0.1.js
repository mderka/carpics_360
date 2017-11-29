if(!window.DisableCarpicsAnalytics){
    (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
    (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
    m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
    })(window,document,'script','https://www.google-analytics.com/analytics.js','CarPicsGoogleAnalytics');
    CarPicsGoogleAnalytics('create', 'UA-101099694-1','auto');
    CarPicsGoogleAnalytics('send', 'pageview', {
      'dimension3':  'Page view'
    })
} else {
    CarPicsGoogleAnalytics = function(){};
}

/*
* Defines the CarPics Spinner API and exposes it to global scope.  Only reference in global scope is: CarPicsSpinnerAPI
*/
var CarPicsSpinnerAPI = (function() {
    /** 
    * Internal constructors for building spinners, including making spinners with an asynchronous get call. 
    */
    this.CarPicsSpinners = function(config) {
        this.spinners = {};
        /**
        * Helper function for after a get request has been made.  Maintains context for the async function call.
        */
        this.makeBoundGetRequest = function(config, thisObj) {
            return function() {
                if(this.readyState==4 && this.status==200){
                    thisObj.spinners[config.divId].spinner = new CarPicsSpinner(config, JSON.parse(this.responseText));
                    thisObj.spinners[config.divId].spinStatus = false;
                }
            }
        }
        /**
        * Adds a spinner syncronously.  Uses a url array (array of json objects with field src)
        */
        this.addSpinner = function(config, urlArray) {
            this.spinners[config.divId] = {
                spinner: new CarPicsSpinner(config, urlArray),
                spinStatus: false
            };
        }
        /**
        * Asyncronously makes a spinner from configured URL.
        */
        this.makeSpinner = function(config) {
            this.spinners[config.divId] = {
                spinStatus: false,
                spinner: {}
            }
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange=this.makeBoundGetRequest(config, this);
            xhttp.open("GET",config.sourceURL);
            xhttp.send();
        }
        /*
        * For each configuration in the constructor, make a new spinner object in this scope, asyncronously.
        */
        for (var i = 0; i < config.spinners.length; i++) {
            this.makeSpinner(config.spinners[i]);
        }
    }

    /*
    * Spinner class.  One spinner div will correspond to one CarPicsSpinner. 
    */
    this.CarPicsSpinner = function(config, data) {
        this.StartTime = Date.now();
        this.connectionsFinished = 0;
        this.divId = config.divId;
        this.spinnerDiv = document.getElementById(this.divId);
        if(data === null || typeof data == "undefined" || data.length==0){
            this.insertPlaceholder();
            return;
        }
        this.data = data;
        this.numberOfConnections = config.numberOfConnections > 0 ? config.numberOfConnections : 4;
        this.AllLoded = false;
        this.AllLoadedFunctions = [];
        this.turnStatus = false;
        this.turning = false;
        this.multiZoom=true;
        this.lastTouch = 0;
        this.autospinSleep = config.autospinSleep > 0 ? config.autospinSleep : 100;
        this.mouseDisabled = config.disableMouse || false;
        this.zoomed = false;
        this.spinSensitivity = parseInt(config.spinSensitivity) > 0 ? parseInt(config.spinSensitivity) : 5;
        this.direction = config.autospinDirection || 1;
        if (config.spinOnLoad == "false") {
            this.spinDefault = config.autospin == "true" || false;
        } else {
            this.spinDefault = false;
        }
        if (config.displayHotspots == "false") {
            this.displayHotspots = false;
        } else {
            this.displayHotspots = true;
        }
        if (config.enableInertialMove == "false") {
            this.enableInertialMove = false;
        } else {
            this.enableInertialMove = true;
        }
        this.spinStatus = this.spinDefault;
        this.mouseXPosition;
        this.mouseYPosition;  
        if (typeof config.overrideSize !== "undefined" &&
            typeof config.overrideSize.width &&
            typeof config.overrideSize.height) {
            this.spinnerDiv.style.width = config.overrideSize.width;
            this.spinnerDiv.style.height = config.overrideSize.height;
        }
        if(typeof config.overlaySource != "undefined" && config.overlaySource !== null) {
            this.loadSpinner();
        }
        // Set icon for hotspot_button
        if (this.displayHotspots == true) {
            document.getElementById("hotspot_button").innerHTML="&#8984";  //"&#8984" is the unicode for "place of interest"
        } else {
            document.getElementById("hotspot_button").innerHTML="&#8709";  //"&#8709" is the unicode for "empty set"
        }
        /*
        * Chooses the next image to load by halfing the distance from the current cursor to the next cursor.
        * If no images need to load, move the loadcursor forward one until cursor has moved n times or has found
        * an image that needs to load.
        * When an image is found that needs to load, load that image with addImageAtCursor.
        * If no image is found, exit successfully - loaded completely.
        */
        this.loadCyclic = function() {
            var thisIndex = this.LoadCursor.Index;
            var nextIndex = 0;
            var complete = true;
            if (this.LoadCursor.Index == this.LoadCursor.NextImage.Index) {
                if (this.AllImages.length == 1) {
                    return;
                }
                nextIndex = Math.floor(this.AllImages.length / 2) - 1;
                this.addImageAtCursor(nextIndex);
                complete = false;
            } else {
                for (var i = 0; i < this.AllImages.length; i++) {
                    if (this.LoadCursor.NextImage.Index - this.LoadCursor.Index == 1 || this.LoadCursor.Index == this.AllImages.length - 1) {
                        this.LoadCursor = this.LoadCursor.NextImage;
                    } else {
                        if (this.LoadCursor.NextImage.Index == 0) {
                            nextIndex = this.LoadCursor.Index + Math.floor((this.AllImages.length - this.LoadCursor.Index) / 2);
                        } else {
                            nextIndex = this.LoadCursor.Index + Math.floor((this.LoadCursor.NextImage.Index - this.LoadCursor.Index) / 2);
                        }
                        this.addImageAtCursor(nextIndex);
                        complete = false;
                        break;
                    }
                }
            }
            return complete;
        }
        /*
        * Secondary mode, not implemented in div based configurations yet, selects next image to load by
        * propagating linearly from starting location on both the left and right.  
        * If no image is found that needs to load, exit successfully.  Else, load that image using addImageAtCursor
        */
        this.loadLinear = function() {
            var nextIndex = 0;
            if (this.LoadCursor.Index - this.LoadCursor.NextImage.Index === 1) {
                if (this.LoadCursor.NextImage)
                    return true;
            }
            if (this.LinearReference.goLeft()) { // Else go right
                nextIndex = this.LoadCursor.NextImage.Index == 0 ? this.AllImages.length - 1 : this.LoadCursor.NextImage.Index - 1;
                this.addImageAtCursor(nextIndex);
                this.LoadCursor = this.LoadCursor.PreviousImage.PreviousImage;
                // Ends at far Right due to stepping on the previousImage
            } else {
                nextIndex = this.LoadCursor.Index + 1;
                this.addImageAtCursor(nextIndex);
                this.LoadCursor = this.LoadCursor.PreviousImage;
                // end on far right as LoadCursor Moves the cursor.
            }
            if (this.LoadCursor.NextImage.Index - this.LoadCursor.Index == 1) {
                return true;
            }
            return false;
        }
        /*
        * Helper function to call the loader, to load the next image.
        */
        this.loadNextImage = function() {
            if (typeof this.LinearReference == "undefined") {
                var complete = this.loadCyclic();
            } else {
                var complete = this.loadLinear();
            }
            if (complete) {
                this.connectionsFinished ++ ;
                this.onAllLoaded();
            }
        }
        /*
        * Calls all images that were added to the AllLoadedFunctions list (essentially onReady list).
        */
        this.onAllLoaded = function() {
            for (var i = 0; i < this.AllLoadedFunctions.length; i++) {
                if (typeof this.AllLoadedFunctions[i] == "function") {
                    this.AllLoadedFunctions[i]();
                }
            }
            this.AllLoadedFunctions = {
                length: 0,
                push: function(func) {
                    if (typeof func == "function") {
                        func();
                    }
                }
            }
        }
        /*
        * Adds an image to the cyclic linked list, and triggers that image to load by creating the image HTML element.
        * Adds callback to that image being loaded - when it loads it will load the next image.
        */
        this.addImageAtCursor = function(nextIndex) {
            nextNext = this.LoadCursor.NextImage;
            this.LoadCursor.NextImage = new CarPicsImage(this.data[nextIndex], nextIndex, this.divId, this.displayHotspots, this.getNextImage(this));
            this.spinnerDiv.appendChild(this.LoadCursor.NextImage.HTMLElement);
            if (this.LoadCursor.PreviousImage === this.LoadCursor) {
                this.LoadCursor.PreviousImage = this.LoadCursor.NextImage;
            }
            nextNext.PreviousImage = this.LoadCursor.NextImage;
            this.AllImages[nextIndex] = this.LoadCursor.NextImage;
            this.LoadCursor.NextImage.PreviousImage = this.LoadCursor;
            this.LoadCursor.NextImage.NextImage = nextNext;
            this.LoadCursor = nextNext;
            return;
        }
        /*
        * Helper function to maintain scope.
        */
        this.getNextImage = function(thisObj) {
            return function() {
                thisObj.loadNextImage();
            }
        }
        /*
        * Toggle event has occurred.  Toggle whether zoom is on or off.
        */
        this.zoomToggle = function(baseEvent, zoomout) {
            if (this.zoomed == true && zoomout) {
                this.CurrentImage.unzoom();
                this.spinStatus = false;
                this.zoomed = false;
                // Set zoom in button style to be white background & black text when unzoomed (original style)
                document.getElementById("zoom_in_button").style.background="#fff";
                document.getElementById("zoom_in_button").style.color="#000";
                return true;
            } else if (!this.zoomed || this.multiZoom){
                this.pauseMouseTime = Date.now() + 500;
                this.zoomed = true;
                // Set zoom in button style to be grey background & white text when zoomed (active style)
                document.getElementById("zoom_in_button").style.background="#888";
                document.getElementById("zoom_in_button").style.color="#fff";
                this.spinStatus = false;
                this.CurrentImage.zoom(baseEvent);
                return false;
            }
        }
        /*
        * Function to control which image is being displayed.  If called (under correct circumstances)
        * It will advance the view cursor (CurrentImage) by one in the chosen direction.  If spinstatus
        * is set false and givenDirection is undefied, it means that the call is an autospin call, but autospin
        * is currently disabled (zoomed or manually turning).  Exit.
        * If direciton is not 1,-1, misconfigured.  Exit.
        * If no other images are ready to display, Exit.
        * Else, display the next image.
        */
        this.displayNextImage = function(givenDirection) {
            var direction;
            var autospin;
            if (typeof givenDirection == "undefined") {
                direction = this.direction;
                autospin = true;
            } else {
                direction = givenDirection;
                autospin = false;
            }
            var nextImage;
            if (!this.spinStatus && autospin) {
                return;
            }
            if (direction == 1) {
                nextImage = this.CurrentImage.NextImage
            } else if (direction == -1) {
                nextImage = this.CurrentImage.PreviousImage;
            } else {
                return;
            }
            for (var i = 0; i < this.AllImages.length; i++) {
                if (!nextImage.isReady) {
                    if (direction == 1) {
                        nextImage = nextImage.NextImage
                    } else if (direction == -1) {
                        nextImage = nextImage.PreviousImage;
                    }
                    continue;
                } else {
                    break;
                }
            }
            if (!nextImage.isReady) {
                return;
            }
            this.spinnerDiv.style.backgroundImage = "url('http://cdn.carpics2p0.com/" + this.CurrentImage.sourceObject.src + "')";
            this.spinnerDiv.style.backgroundSize = "100% 100%";
            var previous = this.CurrentImage;
            this.CurrentImage = nextImage;
            this.CurrentImage.HTMLElement.style.display = "block";
            previous.HTMLElement.style.display = "none";
        }
        this.insertPlaceholder = function(){
            var element = document.getElementById(this.divId);
            element.style.backgroundImage="url('http://resources.carpics2p0.com/Rotation/checkerboard-backgrounds-wallpapers.jpg')"
            element.style.repeat="repeat"
        }
        this.loadSpinner = function(){
            this.spinnerOverlay = document.createElement("div");
            this.spinnerOverlay.style.height="100%";
            this.spinnerOverlay.style.width="100%";
            this.spinnerOverlay.style.zIndex=100;
            this.spinnerOverlay.style.position="absolute";
            var img = new Image();
            img.src = config.overlaySource ;
            img.style.width="80%";
            img.style.height="auto";
            img.style.position="absolute";
            img.style.margin="auto";
            img.style.top=0;
            img.style.right=0;
            img.style.bottom=0;
            img.style.left=0;
            this.spinnerOverlay.onmouseover = (function(div){
                return function(event){
                    div.style.visibility="hidden";
                }
            })(img);
            this.spinnerOverlay.onmouseout = (function(div){
                return function(event){
                    div.style.visibility="";
                }
            })(img);
            this.spinnerOverlay.appendChild(img);
            this.spinnerDiv.appendChild(this.spinnerOverlay);
        }

        // Mouse events:
        if (!this.mouseDisabled) {
            /*
            * Mousedown event starts manual rotation (drag spin)
            */
            document.getElementById(this.divId).addEventListener("mousedown", (function(thisObj) {
                return function(baseEvent) {
                    baseEvent.preventDefault();
                    var thisTouch = Date.now();
                    if (thisObj.zoomed || baseEvent.button === 2) {
                        thisObj.mouseHold = true;
                        thisObj.lastXPosition = baseEvent.pageX;
                        thisObj.lastYPosition = baseEvent.pageY;
                        return;
                    }
                    if(thisObj.interacted){
                        CarPicsGoogleAnalytics('send', 'pageview', {'dimension1':'Click'});
                        thisObj.interacted=true;
                    }
                    CarPicsGoogleAnalytics('send', 'pageview', {'dimension1':'Click'});
                    thisObj.spinStatus = false;
                    thisObj.turnStatus = true;
                    thisObj.mouseXPosition = baseEvent.pageX;
                    thisObj.mouseYPosition = baseEvent.pageY;
                    thisObj.spinnerDiv.style.cursor = "-webkit-move";
                    thisObj.spinnerDiv.style.cursor = "move";
                    thisObj.spinnerDiv.style.cursor = "-moz-move";
                }
            })(this));

            /*
            * Doubleclick triggers desktop zoom event.
            */
            document.getElementById(this.divId).addEventListener("dblclick", (function(thisObj) {
                return function(baseEvent) {
                    CarPicsGoogleAnalytics('send', 'pageview', {'dimension2':'Doubleclick'});
                    baseEvent.preventDefault();
                    var releaseMouse = thisObj.zoomToggle(baseEvent);
                    if (thisObj.zoomed === true) {
                        thisObj.spinStatus = false;
                        thisObj.turnStatus = false;
                    } else {
                        thisObj.spinStatus = thisObj.spinDefault;
                        thisObj.turnStatus = false;
                    }
                }
            })(this));

            /*
            * Clicking on zoomin button triggers desktop zoom in event.
            */
            document.getElementById("zoom_in_button").addEventListener("click", (function(thisObj) {
                return function(baseEvent) {
                    baseEvent.stopPropagation();
                    CarPicsGoogleAnalytics('send', 'pageview', {'dimension1':'Click'});
                    baseEvent.preventDefault();
                    var releaseMouse = thisObj.zoomToggle(baseEvent);
                    if (thisObj.zoomed === true) {
                        thisObj.spinStatus = false;
                        thisObj.turnStatus = false;
                    } else {
                        thisObj.spinStatus = thisObj.spinDefault;
                        thisObj.turnStatus = false;
                    }
                }
            })(this));

            document.getElementById("zoom_in_button").addEventListener("mouseleave", (function(thisObj) {
                return function(baseEvent) {
                    if (thisObj.zoomed == true) {
                        // if zoomed, keep the active style for zoom-in-button after hover
                        document.getElementById("zoom_in_button").style.background="#888";
                        document.getElementById("zoom_in_button").style.color="#fff";
                    } else {
                        // if unzoomed, change the style for zoom-in-button to original after hover
                        document.getElementById("zoom_in_button").style.background="#fff";
                        document.getElementById("zoom_in_button").style.color="#000";
                    }
                }
            })(this));

            /*
            * Clicking on zoomout button triggers desktop zoom out event.
            */
            document.getElementById("zoom_out_button").addEventListener("click", (function(thisObj) {
                return function(baseEvent) {
                    baseEvent.stopPropagation();
                    CarPicsGoogleAnalytics('send', 'pageview', {'dimension1':'Click'});
                    baseEvent.preventDefault();
                    if (thisObj.zoomed === true) {
                        var releaseMouse = thisObj.zoomToggle(baseEvent, true);
                        thisObj.spinStatus = false;
                        thisObj.turnStatus = false;
                    } else {
                        thisObj.spinStatus = thisObj.spinDefault;
                        thisObj.turnStatus = false;
                    }
                }
            })(this));

            /*
            * Clicking on hotspot button triggers display/hide hotspots
            */
            document.getElementById("hotspot_button").addEventListener("click", (function(thisObj) {
                return function(baseEvent) {
                    baseEvent.stopPropagation();
                    CarPicsGoogleAnalytics('send', 'pageview', {'dimension1':'Click'});
                    baseEvent.preventDefault();
                    if (thisObj.displayHotspots == true) {
                        // hide hotspots
                        var hotspots = document.getElementsByClassName("hotspot");
                        for (var i = 0; i < hotspots.length; i++) {
                            hotspots[i].style.display = "none";
                        }
                        thisObj.displayHotspots = false;
                        document.getElementById("hotspot_button").innerHTML="&#8709";// &#8709 is the unicode for 'empty set'
                    } else {
                        // display hotspots
                        var hotspots = document.getElementsByClassName("hotspot");
                        for (var i = 0; i < hotspots.length; i++) {
                            hotspots[i].style.display = "block";
                        }
                        thisObj.displayHotspots = true;
                        document.getElementById("hotspot_button").innerHTML="&#8984";// &#8984 is the unicode for 'place of interset sign'
                    }
                }
            })(this));

            /*
            * Prevent double click on buttons
            */
            document.getElementById("buttonWrap").addEventListener("dblclick", (function(thisObj) {
                return function(baseEvent) {
                    baseEvent.stopPropagation();
                    CarPicsGoogleAnalytics('send', 'pageview', {'dimension2':'Doubleclick'});
                    baseEvent.preventDefault();
                    return;
                }
            })(this));

            /*
            * Hotspot opacity changes depending on the distance between current mouse position and hotspot.
            */
            document.getElementById(this.divId).addEventListener("mousemove", (function(thisObj) {
                return function(baseEvent) {
                    var list = thisObj.CurrentImage.getPointsOfInterest();
                    var spinnerDivPosition = thisObj.CurrentImage.HTMLElement.parentElement.getBoundingClientRect();
                    var imgPosition = thisObj.CurrentImage.HTMLElement.getBoundingClientRect();
                    for (var i=0; i<list.length; i++) {
                        var poi_x = imgPosition.left+list[i].info.x*imgPosition.width/100;
                        var poi_y = imgPosition.top+list[i].info.y*imgPosition.height/100;
                        var mouse_x = baseEvent.clientX;
                        var mouse_y = baseEvent.clientY;
                        var distance = (mouse_x-poi_x)*(mouse_x-poi_x)+(mouse_y-poi_y)*(mouse_y-poi_y);
                        distance = Math.sqrt(distance);
                        var max_distance = spinnerDivPosition.width*spinnerDivPosition.width+spinnerDivPosition.height*spinnerDivPosition.height;
                        max_distance = Math.sqrt(max_distance);
                        var distance_ratio = 1 - distance/max_distance;
                        distance_ratio = distance_ratio*distance_ratio*distance_ratio;
                        list[i].HTMLElement.style.opacity = distance_ratio;
                    }
                }
            })(this));

            /*
            * Mouseup event ends drag status.
            */
            document.getElementById(this.divId).addEventListener("mouseup", (function(thisObj) {
                return function(baseEvent) {
                    baseEvent.preventDefault();
                    if (thisObj.zoomed || thisObj.mouseDisabled) {
                        thisObj.mouseHold = false;
                        thisObj.CurrentImage.clientX = undefined;
                        thisObj.CurrentImage.clientY = undefined;
                        return;
                    }
                    // Display hotspots at mouseup event (after spinning), depending on current status.
                    if (thisObj.displayHotspots&&thisObj.turning) {
                        for (var j=0; j<thisObj.AllImages.length; j++) {
                            var list = thisObj.AllImages[j].getPointsOfInterest();
                            for (var i=0; i<list.length; i++) {
                                thisObj.AllImages[j].HTMLElement.appendChild(list[i].HTMLElement);
                            }
                        }
                    }
                    thisObj.spinStatus = thisObj.spinDefault;
                    thisObj.turnStatus = false;
                    thisObj.turning = false;
                    thisObj.spinnerDiv.style.cursor = "-webkit-grab";
                    thisObj.spinnerDiv.style.cursor = "grab";
                    thisObj.spinnerDiv.style.cursor = "-moz-grab";
                }
            })(this));

            /*
            * Mousemove moves zoom viewport or allows drag spin, depending on current status.
            */
            document.getElementById(this.divId).addEventListener("mousemove", (function(thisObj) {
                return function(baseEvent) {
                    if (thisObj.pauseMouseTime > Date.now()) {
                        return;
                    }
                    if (thisObj.turnStatus !== true && thisObj.zoomed !== true) {
                        return;
                    }
                    var currentXPosition = baseEvent.pageX;
                    var currentYPosition = baseEvent.pageY;
                    if (thisObj.zoomed == true && thisObj.mouseHold) {
                        if(thisObj.multiZoom){
                            //return;
                        }
                        if (thisObj.enableInertialMove == false) {
                            thisObj.CurrentImage.dragMove(baseEvent, 
                                thisObj.CurrentImage.HTMLElement.getBoundingClientRect(), true, thisObj.enableInertialMove, thisObj.lastXPosition, thisObj.lastYPosition);
                            thisObj.lastXPosition = baseEvent.clientX;
                            thisObj.lastYPosition = baseEvent.clientY;
                        } else {
                            thisObj.CurrentImage.dragMove(baseEvent, 
                            thisObj.CurrentImage.HTMLElement.getBoundingClientRect(), true, thisObj.enableInertialMove);
                        }
                    } else if (thisObj.zoomed == false) {
                        while (thisObj.mouseXPosition - currentXPosition > thisObj.spinSensitivity){
                            // Hide hotspots during spinning
                            if ( thisObj.displayHotspots== true ) {
                                var hotspots = document.getElementsByClassName("hotspot");
                                while (hotspots.length > 0) {
                                    hotspots[0].parentElement.removeChild(hotspots[0]);
                                }
                            }
                            // If spinning was triggered inside a hotspot, remove modalHover
                            if (document.getElementById("modalHover")) {
                                var modalHover = document.getElementById("modalHover");
                                modalHover.parentElement.removeChild(modalHover);
                            }
                            thisObj.turning = true;
                            thisObj.displayNextImage(1);
                            thisObj.mouseYPosition = currentYPosition;
                            thisObj.mouseXPosition = thisObj.mouseXPosition - thisObj.spinSensitivity;
                        }
                        while (currentXPosition - thisObj.mouseXPosition > thisObj.spinSensitivity) {
                            // Hide hotspots during spinning
                            if ( thisObj.displayHotspots== true ) {
                                var hotspots = document.getElementsByClassName("hotspot");
                                while (hotspots.length > 0) {
                                    hotspots[0].parentElement.removeChild(hotspots[0]);
                                }
                            }
                            // If spinning was triggered inside a hotspot, remove modalHover
                            if (document.getElementById("modalHover")) {
                                var modalHover = document.getElementById("modalHover");
                                modalHover.parentElement.removeChild(modalHover);
                            }
                            thisObj.turning = true;
                            thisObj.displayNextImage(-1);
                            thisObj.mouseYPosition = currentYPosition;
                            thisObj.mouseXPosition = thisObj.mouseXPosition + thisObj.spinSensitivity;
                        } 
                    }
                }
            })(this));

            /*
            * Touchstart event starts manual rotation (drag spin), also needed to bind 
            * move events to prevent passive listener warnings and failure of touchmove events.
            * Also needed to capture position of touchhold event for zooming.  Also sets up
            * the pseudo-event of taphold.
            */
            var originalEvent;
            document.getElementById(this.divId).addEventListener("touchstart", (function(thisObj) {
                return function(event) {
                    pressTimer=setTimeout((function(thisObj) {
                        return function() {
                            if (thisObj.turning == true) {
                                return;
                            }
                            if(thisObj.interacted){
                                CarPicsGoogleAnalytics('send', 'pageview', {'dimension1':'Taphold'});
                                thisObj.interacted=true;
                            }
                            CarPicsGoogleAnalytics('send', 'pageview', {'dimension2':'Taphold'});
                            event.preventDefault();
                            var releaseMouse = thisObj.zoomToggle(event);
                            if (thisObj.zoomed === true) {
                                thisObj.spinStatus = false;
                                thisObj.turnStatus = false;
                            } else {
                                thisObj.spinStatus = thisObj.spinDefault;
                                thisObj.turnStatus = false;
                            }

                        }
                    })(thisObj), 300)
                    event.preventDefault();
                    event.returnValue = false;
                    var thisTouch = Date.now();
                    if (thisObj.zoomed) {
                        return;
                    }
                    if(thisObj.interacted){
                        CarPicsGoogleAnalytics('send', 'pageview', {'dimension1':'Touchstart'});
                        thisObj.interacted=true;
                    }
                    CarPicsGoogleAnalytics('send', 'pageview', {'dimension2':'Touchstart'});
                    thisObj.spinStatus = false;
                    thisObj.turnStatus = true;
                    var touch = event.targetTouches[0] || event.changedTouches[0];
                    thisObj.mouseXPosition = touch.pageX
                    thisObj.mouseYPosition = touch.pageY;
                    /*
                    * Touchmove triggers drag spin in mobile.  Does not trigger zoom move.
                    */
                    document.getElementById(thisObj.divId).addEventListener('touchmove', (
                        function(thisInternal) {
                            return function(event1) {
                                event1.preventDefault();
                                if (thisInternal.pauseMouseTime > Date.now()) {
                                    return;
                                }
                                if (thisInternal.turnStatus !== true && thisInternal.zoomed !== true) {
                                    return;
                                }
                                var touch = event1.targetTouches[0] || event1.targetTouches[0]
                                var currentXPosition = touch.pageX;
                                var currentYPosition = touch.pageY;
                                if (thisInternal.zoomed == true) {
                                    thisInternal.CurrentImage.move(thisObj.mouseXPosition, thisObj.mouseYPosition);
                                } else {
                                    while (thisInternal.mouseXPosition - currentXPosition > thisInternal.spinSensitivity) {
                                        thisObj.turning = true;
                                        thisInternal.displayNextImage(1);
                                        thisInternal.mouseYPosition = currentYPosition;
                                        thisInternal.mouseXPosition = thisObj.mouseXPosition - thisObj.spinSensitivity;
                                    } 
                                    while (currentXPosition - thisInternal.mouseXPosition > thisInternal.spinSensitivity) {
                                        thisInternal.mouseYPosition = currentYPosition;
                                        thisInternal.mouseXPosition = thisObj.mouseXPosition + thisObj.spinSensitivity;
                                        thisObj.turning = true;
                                        thisInternal.displayNextImage(-1);
                                    }
                                }
                                thisInternal.pauseMouseTime = Date.now() + 25;
                            }
                        }
                    )(thisObj));
                }
            })(this));

            /*
            * Touchend event ends manual drag - also clears the detector for the taphold pseudo-event
            */
            var pressTimer;
            document.getElementById(this.divId).addEventListener("touchend", (function(thisObj) {
                return function(event) {
                    if (thisObj.mouseDisabled) {
                        return;
                    }
                    clearTimeout(pressTimer)
                    thisObj.spinStatus = thisObj.spinDefault;
                    thisObj.turnStatus = false;
                    thisObj.turning = false;
                    thisObj.spinnerDiv.style.cursor = "-webkit-grab";
                    thisObj.spinnerDiv.style.cursor = "grab";
                    thisObj.spinnerDiv.style.cursor = "-moz-grab";
                    document.getElementById(this.divId).addEventListener("touchmove", function(event1) {});
                }
            })(this));
        }
        /*
        * Default spinner styles to prevent images overflowing, and to show grab hand.
        */
        this.setDefaultSpinnerStyles = function() {
            this.spinnerDiv.style.cursor = "grab";
            this.spinnerDiv.style.cursor = "-webkit-grab";
            this.spinnerDiv.style.cursor = "-moz-grab";
            this.spinnerDiv.style.overflow = "hidden";
        }
        this.CurrentImage = new CarPicsImage(data[0], 0, this.divId, this.displayHotspots, function() {});
        this.CurrentImage.HTMLElement.style.display = "block";
        if (config.linear === "true") {
            this.LinearReference = {
                nextLeft: false,
                goLeft: function() {
                    this.nextLeft = !this.nextLeft;
                    return this.nextLeft;
                }
            }
        }
        this.AllImages = new Array(data.length);
        this.AllImages[0] = this.CurrentImage;
        this.LoadCursor = this.CurrentImage;
        if (!this.mouseDisabled) {
            this.setDefaultSpinnerStyles();
        }
        this.spinnerDiv.appendChild(this.CurrentImage.HTMLElement);
        if (this.spinStatus) {
            setInterval((function(thisObj) {
                return function() {
                    if (!thisObj.spinStatus) return;
                    thisObj.displayNextImage()
                }
            })(this), this.autospinSleep);
        }
        if (config.spinOnLoad == "true") {
            this.AllLoadedFunctions.push((function(thisObj) {
                return function() {
                    thisObj.spinStatus = 1;
                    thisObj.spinDefault = 1;
                    setInterval((function(thisObj) {
                        return function() {
                            if (!thisObj.spinStatus) return;
                            thisObj.displayNextImage()
                        }
                    })(thisObj), thisObj.autospinSleep);
                }
            })(this))
        }
        for (var i = 0; i < this.numberOfConnections; i++) {
            this.getNextImage(this, undefined)();
        }
    }
    /*
    * CarPicsImage is a wrapper on functionality for the image container element.  
    * Contains image readiness information as well.
    */
    this.CarPicsImage = function(source, index, div, displayHotspots, callback) {
        this.zoomIntensity = 1;
        this.velocityX = 0;
        this.velocityY = 0;
        this.currentX;
        this.currentY;
        /*
        * Controls CSS to properly allow zoom functionality.
        */
        this.zoom = function(baseEvent) {
            var offset = this.HTMLElement.getBoundingClientRect();
            this.zoomIntensity=this.zoomIntensity*2;
            this.HTMLElement.style.maxHeight = this.zoomIntensity+"00%";
            this.HTMLElement.style.maxWidth = this.zoomIntensity+"00%";
            this.HTMLElement.style.height = this.zoomIntensity+"00%";
            this.HTMLElement.style.width = this.zoomIntensity+"00%";
            var clientX = baseEvent.type == "dblclick" ? baseEvent.pageX - window.scrollX : baseEvent.targetTouches[0].clientX;
            var clientY = baseEvent.type == "dblclick" ? baseEvent.pageY - window.scrollY : baseEvent.targetTouches[0].clientY;
            this.move(baseEvent, offset);
        }
        /*
        * Resets element to default after zoom end.
        */
        this.unzoom = function() {
            this.zoomIntensity =1;  // Reset zoomIntensity
            this.HTMLElement.style.maxHeight = "100%";
            this.HTMLElement.style.maxWidth = "100%";
            this.HTMLElement.style.height = "100%";
            this.HTMLElement.style.width = "100%";
            this.HTMLElement.style.left = 0 + 'px';
            this.HTMLElement.style.top = 0 + 'px';
        }
        /*
        * Allows moving view within zoomed element.
        */
        this.move = function(baseEvent, offset, zoomed) {
            var multiplier = zoomed?1:2;
            var parentOffset = this.HTMLElement.parentElement.getBoundingClientRect();
            var clientX = (baseEvent.type !== "touchmove" ? baseEvent.clientX : baseEvent.targetTouches[0].clientX) - parentOffset.left;
            var clientY = (baseEvent.type !== "touchmove" ? baseEvent.clientY : baseEvent.targetTouches[0].clientY) - parentOffset.top;
            var correctX =  (-clientX + offset.left - parentOffset.left)*multiplier + parentOffset.width/2;
            var correctY =  (-clientY + offset.top - parentOffset.top)*multiplier + parentOffset.height/2;
            if(correctX>0){
                correctX=0;
            } else if (-correctX > (multiplier*offset.width-parentOffset.width)) {
                correctX = -(multiplier*offset.width-parentOffset.width);
            }
            if(correctY>0){
                correctY=0;
            } else if (-correctY > (multiplier*offset.height-parentOffset.height)) {
                correctY = -(multiplier*offset.height-parentOffset.height);
            }
            this.HTMLElement.style.left = correctX + 'px';
            this.HTMLElement.style.top = correctY + 'px';
        }
        /**
        * Allows drag to scroll image within zoomed element
        */
        this.dragMove = function(baseEvent, offset, zoomed, enableInertialMove, originalX, originalY) {
            var parentOffset = this.HTMLElement.parentElement.getBoundingClientRect();
            var clientX = (baseEvent.type !== "touchmove" ? baseEvent.clientX : baseEvent.targetTouches[0].clientX) - parentOffset.left;
            var clientY = (baseEvent.type !== "touchmove" ? baseEvent.clientY : baseEvent.targetTouches[0].clientY) - parentOffset.top;
            if (enableInertialMove == true){
                // Enable inertial move
                this.setVelocity(clientX, clientY);
            } else {
                // Enable exact move
                var shiftX = clientX - originalX;
                var shiftY = clientY - originalY;
                var correctX = offset.left + shiftX;
                var correctY =  offset.top + shiftY;
                if(correctX>0){
                    correctX=0;
                } else if (-correctX > (offset.width-parentOffset.width)) {
                    correctX = -(offset.width-parentOffset.width);
                }
                if(correctY>0){
                    correctY=0;
                } else if (-correctY > (offset.height-parentOffset.height)) {
                    correctY = -(offset.height-parentOffset.height);
                }
                this.HTMLElement.style.left = correctX + 'px';
                this.HTMLElement.style.top = correctY + 'px';
            }
        }
        this.setVelocity = function(Px, Py) {
            var c = 0.6;    //how much each mouse movement matters 
            if (typeof this.clientX == "undefined") {
                this.clientX = Px;
            }
            if (typeof this.clientY == "undefined") {
                this.clientY = Py;
            }
            this.velocityX = (Px-this.clientX) * c + this.velocityX;
            this.velocityY = (Py-this.clientY) * c + this.velocityY;
            this.clientX = Px;
            this.clientY = Py;
            this.moveTimeOut = this.moveTimeOut || setTimeout((function(thisObj) {
                return function() {
                    thisObj.inertialMove();
                }  
            })(this),10);
        }
        this.inertialMove = function () {
            var decay = 0.8;    // how fast for decay, cannot be greater than 1
            var threshold = 1;    // the threshold to stop the movement
            var offset = this.HTMLElement.getBoundingClientRect();
            var parentOffset = this.HTMLElement.parentElement.getBoundingClientRect();
            var correctX = offset.left + this.velocityX - parentOffset.left;
            var correctY =  offset.top + this.velocityY - parentOffset.top;
            if(correctX>0){
                correctX=0;
            } else if (-correctX > (offset.width-parentOffset.width)) {
                correctX = -(offset.width-parentOffset.width);
            }
            if(correctY>0){
                correctY=0;
            } else if (-correctY > (offset.height-parentOffset.height)) {
                correctY = -(offset.height-parentOffset.height);
            }
            this.HTMLElement.style.left = correctX + 'px';
            this.HTMLElement.style.top = correctY + 'px';
            this.velocityX = this.velocityX * decay;
            this.velocityY = this.velocityY * decay;
            if (this.velocityX > threshold || this.velocityY > threshold) {
                this.moveTimeOut = setTimeout((function(thisObj) {
                    return function(){
                        thisObj.inertialMove();
                    }
                })(this),10);
            } else {
                this.moveTimeOut = 0;
            }
        }
        this.listOfPointsOfInterest = [];
        this.displayPointsOfInterest = function(source, displayHotspots){
            if(typeof source.poi == "undefined"){
                return;
            }
            var poi = source.poi;
            for(var i=0;i<poi.length;i++){
                var div = document.createElement("div");
                // div.title=poi[i].name;
                div.style.width="24px";  // hotspot width
                div.style.height="24px";  // hotspot height
                div.style.borderRadius="24px";  // make hotspot round
                div.style.backgroundColor="#fff";  // hotspot background
                div.style.zIndex="21";
                div.style.position="absolute";  // set hotspot position according to poi location
                div.style.left=poi[i].x+"%";
                div.style.top=poi[i].y+"%";
                div.className="hotspot";
                // Set hotspot icon and color based on the type of hotspot
                var spanElement = document.createElement("span");
                spanElement.style.fontSize="28px";
                spanElement.style.position="absolute";
                if (poi[i].type == "Damage") {
                    div.style.color="#EF255F";   //feature: "#09A8FA"; damage: "#EF255F"
                    spanElement.innerHTML="&#10050";    //feature: "&#10026"; damage: "&#10050"
                    spanElement.style.bottom="-4.5px";
                    spanElement.style.left="1px"; 
                } else {
                    div.style.color="#09A8FA";   //feature: "#09A8FA"; damage: "#EF255F"
                    spanElement.innerHTML="&#10026";    //feature: "&#10026"; damage: "&#10050"
                    spanElement.style.bottom="-5.5px";
                    spanElement.style.left="1px"; 
                }
                div.appendChild(spanElement);
                // Create and display a small detail modal when hover on hotspot
                div.onmouseover = (function(element, poi){
                    return function(e){
                        e.stopPropagation();
                        var position = element.parentNode.getBoundingClientRect();
                        var modalWidth=position.width/4;  // define the max-width of modal according to CarPicsSpinnerDiv width
                        var modalHeight=position.height/2.2;  //// define the max-height of modal according to CarPicsSpinnerDiv height
                        var modal = document.createElement("div");
                        modal.style.fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif";
                        modal.style.lineHeight="1.414";
                        modal.setAttribute("id", "modalHover");
                        modal.style.position="absolute";
                        modal.style.margin="auto";
                        // Adjust the position of modal based on the position of hotspot in CarPicsSpinnerDiv
                        if (e.clientX-position.left<position.width-modalWidth-25){
                            modal.style.left=(e.clientX-position.left)+"px";
                            modal.style.marginLeft="10px";
                        } else {
                            modal.style.right=(position.width+position.left-e.clientX)+"px";
                            modal.style.marginRight="10px";
                        }
                        if (e.clientY-position.top<position.height-modalHeight-25){
                            modal.style.top=(e.clientY-position.top)+"px";
                            modal.style.marginTop="10px";
                        } else {
                            modal.style.bottom=(position.height+position.top-e.clientY)+"px";
                            modal.style.marginBottom="10px";
                        }
                        modal.style.width=modalWidth+"px";
                        modal.style.maxHeight=modalHeight+"px";
                        modal.style.background="#fff";  // set modal background color
                        modal.style.borderRadius="5px";
                        modal.style.zIndex="32";  // display modal above image & hotspot & control buttons
                        modal.style.opacity="0.95";  // set modal opacity
                        modal.style.overflow="hidden";
                        modal.style.boxShadow="2px 2px 4px 0px rgba(82, 82, 82, 0.75)";
                        element.parentElement.insertBefore(modal,element);

                        // Define modal header section
                        var modalHead = document.createElement("div");
                        modalHead.style.height="30px";
                        // Set modal header color based on hotspot type
                        if (poi.type == "Damage") {
                            modalHead.style.background="#CA1246";   //feature: "#0d82bf"; damage: "#CA1246"
                        } else {
                            modalHead.style.background="#0d82bf";   //feature: "#0d82bf"; damage: "#CA1246"
                        }
                        modalHead.style.color="#EAEAEA";  // set header text color to be almost-white
                        modalHead.style.borderRadius="5px 5px 0px 0px";
                        modalHead.style.fontSize="1em";
                        modalHead.style.lineHeight="30px";  // make header text vertically middle
                        modal.appendChild(modalHead);
                        var modalHeadText = document.createElement("span");
                        modalHeadText.style.marginLeft="10px";
                        modalHeadText.innerHTML=poi.name;  // Display the name of hotspot on modal header
                        modalHead.appendChild(modalHeadText);

                        // Define modal body section
                        var modalBody = document.createElement("div");
                        modalBody.style.padding="10px";
                        modal.appendChild(modalBody);
                        // Display detail image (if provided)
                        if (poi.sourceUrl!=="" && typeof poi.sourceUrl!=="undefined") {
                            var img = new Image();
                            img.src=poi.sourceUrl;  // display the detail image of this hotspot
                            img.style.width="100%";
                            img.style.height="100%";
                            img.style.marginBottom="10px";
                            modalBody.appendChild(img);
                        }
                        // Display and style notes (if provided)
                        if (poi.notes!=="" && typeof poi.notes!=="undefined"){
                            var poiNotes = document.createElement("div");
                            poiNotes.setAttribute("id", "poiNotes");
                            poiNotes.style.fontSize="0.9em";
                            poiNotes.innerHTML=poi.notes;  // display the notes of this hotspot
                            poiNotes.style.whiteSpace="pre-line";  // keep the line-breaks
                            poiNotes.style.overflow="hidden";
                            poiNotes.style.maxHeight="3em";
                            poiNotes.style.display="-webkit-box";
                            poiNotes.style['-webkit-line-clamp']=2;  // only display the first two lines 
                            poiNotes.style['-webkit-box-orient']="vertical";  // if some texts were hidden, indicate with '...'
                            modalBody.appendChild(poiNotes);
                        }

                        // if modal size is too small, adjust content size & padding
                        if (modalHeight<200 && modalHeight>140){
                            modalHead.style.height="24px";
                            modalHead.style.lineHeight="24px";
                            modalHead.style.fontSize="0.85em";
                            modalHeadText.style.marginLeft="6px";
                            modalBody.style.padding="6px";
                            if (typeof img !== "undefined") {
                                img.style.marginBottom="5px";
                            }
                            if (typeof poiNotes !== "undefined"){
                                poiNotes.style.fontSize="0.7em";
                            }
                        } else if (modalHeight<=140) {
                            // If the modal size is way too small, only display the name of hotspot
                            modalHead.style.height="24px";
                            modal.style.width="auto";
                            modalHead.style.lineHeight="24px";
                            modalHead.style.fontSize="0.7em";
                            modalHead.style.fontWeight="300";
                            modalHead.style.letterSpacing="0.4px";
                            modalHeadText.style.marginLeft="6px";
                            modalHeadText.style.marginRight="6px";
                            modalHead.style.borderRadius="5px";
                            modal.removeChild(modalBody);
                        }
                    }
                })(this.HTMLElement, poi[i]);
                // remove small detail modal after hover (on mouse leave)
                div.onmouseout = (function(){
                    return function(){
                        document.getElementById("modalHover").remove();
                    }
                })(this.HTMLElement, poi[i]);
                // // Display full detail modal when click on hotspot
                // // Modal version 1: partly cover image (either on page level or inside image wrap div)
                div.onclick = (function(element,poi){
                    return function(event){
                        event.stopPropagation();
                        // Create a overlay to display modal
                        var overlay = document.createElement("div");
                        overlay.style.fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif";
                        overlay.setAttribute("id", "popModalContainer");
                        overlay.style.position="absolute";
                        overlay.style.width="100%";
                        overlay.style.height="100%";
                        overlay.style.zIndex="32";  // display modal on top of image/hotspot
                        overlay.style.background="#00000088";  // make the overlay transparent with a little bit grey
                        element.style["-webkit-filter"]="blur(10px)";  // Blur backgound when display modal
                        element.parentElement.insertBefore(overlay,element);
                        document.getElementById("buttonWrap").style.opacity = 0;  // Hide control buttons when displaying modal
                        // close modal when user click outside modal
                        overlay.onclick = (function(e){
                            if(e.target.id=="popModalContainer"){
                                document.getElementById("popModalContainer").remove();
                                element.style["-webkit-filter"]="none";
                                document.getElementById("buttonWrap").style.opacity = 0.8;  // Display control buttons
                            }
                        });
                        // Create full detail modal
                        var modal = document.createElement("div");
                        modal.style.lineHeight="1.414";
                        modal.setAttribute("id", "popModal");
                        modal.style.width="60%";
                        modal.style.maxHeight="85%";
                        modal.style.margin="5% auto 5% auto";
                        modal.style.background="#fff";
                        modal.style.borderRadius="8px";
                        modal.style.cursor="default";
                        modal.style.overflow="scroll";  // Enable scroll
                        overlay.appendChild(modal);

                        // Define modal header section
                        var modalHead = document.createElement("div");
                        modalHead.style.height="36px";
                        modalHead.style.width="60%";
                        // Set modal header color based on hotspot type
                        if (poi.type == "Damage") {
                            modalHead.style.background="#CA1246";   //feature: "#0d82bf"; damage: "#CA1246"
                        } else {
                            modalHead.style.background="#0d82bf";   //feature: "#0d82bf"; damage: "#CA1246"
                        }
                        modalHead.style.color="#EAEAEA";  // set header text color to be almost-white
                        modalHead.style.borderRadius="5px 5px 0px 0px";
                        modalHead.style.fontSize="1.2em";
                        modalHead.style.lineHeight="36px";  // make modal header text vertically middle
                        modalHead.style.position="absolute";
                        modal.appendChild(modalHead);
                        var modalHeadText = document.createElement("span");
                        modalHeadText.style.marginLeft="15px";
                        modalHeadText.innerHTML=poi.name;  // Display the name of hotspot on modal header
                        modalHead.appendChild(modalHeadText);
                        var modalHeadIcons = document.createElement("span");
                        modalHeadIcons.style.float="right";  // Display modal-control-button on right
                        modalHeadIcons.style.marginRight="15px";
                        modal.style.cursor="pointer";
                        modalHead.appendChild(modalHeadIcons);
                        // Create a cancel button on modal header to close modal
                        var modalCancelIcon = document.createElement("span");
                        modalCancelIcon.innerHTML="&#10005";  // Set icon to be 'x'
                        // close modal when pressing on cancel button
                        modalCancelIcon.onclick=(function(overlay){
                            document.getElementById("popModalContainer").remove();
                            element.style["-webkit-filter"]="none";
                            document.getElementById("buttonWrap").style.opacity = 0.8;  // Display control buttons
                        });
                        modalHeadIcons.appendChild(modalCancelIcon);

                        // Define modal body section
                        var modalBody = document.createElement("div");
                        modalBody.style.padding="15px";
                        modalBody.style.marginTop="36px";
                        modal.appendChild(modalBody);
                        // Display detail image (if provided)
                        if (poi.sourceUrl!=="" && typeof poi.sourceUrl!=="undefined") {
                            var img = new Image();
                            img.src=poi.sourceUrl;  // display the detail image of this hotspot
                            img.style.width="100%";
                            img.style.height="100%";
                            img.style.marginBottom="10px";
                            modalBody.appendChild(img); 
                        }
                        // Display detail notes (if provided)
                        if (poi.notes!=="" && typeof poi.notes!=="undefined") {
                            var poiNotes = document.createElement("div");
                            poiNotes.innerHTML=poi.notes;  // display the notes of this hotspot
                            poiNotes.style.whiteSpace="pre-line";  // Keep line-breaks
                            modalBody.appendChild(poiNotes);
                        }

                        var offset = element.getBoundingClientRect();
                        var XOffset;
                        var YOffset;
                        if (poi.x > offset.left && poi.y < (offset.left + offset.width) && poi.y > offset.top && poi.y < (offset.top + offset.height)) {
                            XOffset = offset.left - poi.x;
                            YOffset = offset.top - poi.y;
                        } else {
                            return;
                        }
                        this.HTMLElement.style.left = XOffset / document.documentElement.clientWidth * 100 + 'vw';
                        this.HTMLElement.style.top = YOffset / document.documentElement.clientWidth * 100 + 'vw';
                    }
                })(this.HTMLElement, poi[i]);
                // // Modal version 2: cover the whole image
                // div.onclick = (function(element,poi){
                //     return function(event){
                //         event.stopPropagation();
                //         var overlay = document.createElement("div");
                //         overlay.style.fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif";
                //         overlay.setAttribute("id", "popModalContainer");
                //         overlay.style.position="absolute";
                //         overlay.style.width="100%";
                //         overlay.style.height="100%";
                //         overlay.style.zIndex="32";
                //         overlay.style.background="#00000088";
                //         element.parentElement.insertBefore(overlay,element);
                //         // close modal when user click outside modal
                //         overlay.onclick = (function(e){
                //             if(e.target.id=="popModalContainer"){
                //                 document.getElementById("popModalContainer").remove();
                //             }
                //         });

                //         var modal = document.createElement("div");
                //         modal.style.lineHeight="1.414";
                //         modal.setAttribute("id", "popModal");
                //         modal.style.width="100%";
                //         modal.style.height="100%";
                //         modal.style.background="rgba(255, 255, 255, 0.88)";
                //         modal.style.cursor="default !important";
                //         modal.style.overflow="hidden";
                //         overlay.appendChild(modal);

                //         var modalHead = document.createElement("div");
                //         modalHead.style.height="40px";
                //         modalHead.innerHTML=poi.name;
                //         modalHead.style.color="#000";
                //         modalHead.style.fontSize="1.2em";
                //         modalHead.style.padding="6px 15px";
                //         modalHead.style.textAlign="center";
                //         modal.appendChild(modalHead);

                //         var modalImage = document.createElement("div");
                //         modalImage.style.width="62%";
                //         modalImage.style.float="left";
                //         modalImage.style.padding="1% 1%";
                //         modal.appendChild(modalImage);

                //         var modalInfo = document.createElement("div");
                //         modalInfo.style.width="34%";
                //         modalInfo.style.overflow="hidden";
                //         modalInfo.style.height="80%";
                //         modalInfo.style.padding="1% 1% 1% 0";
                //         modal.appendChild(modalInfo);

                //         var modalHeadIcons = document.createElement("span");
                //         modalHeadIcons.style.float="right";
                //         modal.style.cursor="pointer";
                //         modalHead.appendChild(modalHeadIcons);

                //             var modalCancelIcon = document.createElement("span");
                //             modalCancelIcon.innerHTML="&#10005";
                //             modalCancelIcon.onclick=(function(overlay){
                //                 document.getElementById("popModalContainer").remove();
                //             });
                //             modalHeadIcons.appendChild(modalCancelIcon);

                //         var ghr = document.createElement("hr");
                //         ghr.style.border="0";
                //         ghr.style.height="1px";
                //         ghr.style.margin="5px 0";
                //         ghr.style.backgroundImage="linear-gradient(to right, rgba(0, 0, 0, 0), rgba(0, 0, 0, 1), rgba(0, 0, 0, 0))";
                //         modalHead.appendChild(ghr);

                //         var modalBody = document.createElement("div");
                //         modalBody.style.padding="15px 0px";
                //         modalBody.style.overflow="scroll";
                //         modalBody.style.maxHeight="80%";
                //         modalInfo.appendChild(modalBody);

                //         var img = new Image();
                //         img.src=poi.sourceUrl;
                //         img.style.width="90%";
                //         img.style.height="auto";
                //         img.style.marginTop="16px";
                //         img.style.marginLeft="16px";
                //         img.style.border="1px solid #ddd";
                //         img.style.padding="4px";
                //         img.style.borderRadius="4px";
                //         modalImage.appendChild(img);

                //         var poiNotes = document.createElement("div");
                //         poiNotes.innerHTML=poi.notes;
                //         poiNotes.style.color="#000";
                //         poiNotes.style.letterSpacing="0.3px";
                //         poiNotes.style.fontWeight="200";
                //         poiNotes.style.whiteSpace="pre-line";
                //         modalBody.appendChild(poiNotes);

                //         var offset = element.getBoundingClientRect();
                //         var XOffset;
                //         var YOffset;
                //         if (poi.x > offset.left && poi.y < (offset.left + offset.width) && poi.y > offset.top && poi.y < (offset.top + offset.height)) {
                //             XOffset = offset.left - poi.x;
                //             YOffset = offset.top - poi.y;
                //         } else {
                //             return;
                //         }
                //         this.HTMLElement.style.left = XOffset / document.documentElement.clientWidth * 100 + 'vw';
                //         this.HTMLElement.style.top = YOffset / document.documentElement.clientWidth * 100 + 'vw';
                //     }
                // })(this.HTMLElement, poi[i]);
                this.HTMLElement.appendChild(div);
                // Hide hotspots if needed
                if (displayHotspots == false) {
                    div.style.display = "none";
                }
                var poiElement = {};
                poiElement.HTMLElement = div;
                poiElement.info = poi[i];
                this.listOfPointsOfInterest.push(poiElement);
            }
        }
        this.getPointsOfInterest = function() {
            return this.listOfPointsOfInterest;
        }
        /*
        * Default Image styles and sets up transitions which make movements nicer.
        */
        this.setDefaultImageStyles = function() {
            this.HTMLElement.style.position = "relative";
            this.HTMLElement.style.maxHeight = "100%";
            this.HTMLElement.style.maxWidth = "100%";
            this.HTMLElement.style.height = "100%";
            this.HTMLElement.style.width = "100%";
            this.HTMLElement.style.left = "0vw";
            this.HTMLElement.style.top = "0vw";
            this.imgElement.style.maxHeight = "100%";
            this.imgElement.style.maxWidth = "100%";
            this.imgElement.style.height = "100%";
            this.imgElement.style.width = "100%";
            this.HTMLElement.style.overflow = "hidden";
            // this.HTMLElement.style.transition = "all .5s linear";
            // this.HTMLElement.style.mozTransition = "all .5s linear";
            // this.HTMLElement.style.webkitTransition = "all .5s linear";
            // this.HTMLElement.style.oTransition = "all .5s linear";
            this.HTMLElement.style.khtmlUserSelect = "none";
            this.HTMLElement.style.display = "none";
            this.HTMLElement.style.oUserSelect = "none";
            this.HTMLElement.style.mozUserSelect = "none";
            this.HTMLElement.style.webkitUserSelect = "none";
            this.HTMLElement.style.userSelect = "none";
            // Prevents drag from making ghost images.
            this.HTMLElement.ondragstart = function() {
                return false
            };
        }
        var indicateReady = (function(thisObj, index) {
            return function(ready) {
                if(ready){
                    thisObj.isReady = true;
                } 
            }
        })(this, index);
        this.imageLoadStart = Date.now();
        this.NextImage = this;
        this.PreviousImage = this;
        this.Index = index;
        this.isReady = false;
        this.sourceObject = source;
        this.elementId = div + "-" + source.src;
        this.imgElement = document.createElement("img");
        this.HTMLElement = document.createElement("div");
        this.HTMLElement.appendChild(this.imgElement);
        this.displayPointsOfInterest(source, displayHotspots);
        this.setDefaultImageStyles();
        this.imgElement.setAttribute("src", "http://cdn.carpics2p0.com/" + source.src);
        this.HTMLElement.setAttribute("id", this.elementId);
        this.imgElement.addEventListener("load", function() {
                callback();
                indicateReady(true)
        });
        this.imgElement.addEventListener("error", function(){
            callback()
            indicateReady(false);
        });
    }
    return this;
})();

/**
* Closure that iterates over all elements with classname of "carPicsSpinner" and sets up a spinner in that div.
*/
(function(){
    var callback =function() {
        var spinners = [];
        var CarpicsDivs = document.getElementsByClassName("carPicsSpinner");
        for (var i = 0; i < CarpicsDivs.length; i++) {
            var div = CarpicsDivs[i];
            var buttonWrap = document.createElement("div");
            buttonWrap.setAttribute("id", "buttonWrap");
            buttonWrap.style.position="absolute";
            buttonWrap.style.top= "40%";
            buttonWrap.style.right="6px";
            buttonWrap.style.zIndex="22";
            buttonWrap.style.opacity="0.8";
            div.appendChild(buttonWrap);
            // Create zoom-in-button for CarPicsSpinnerDiv
            var zoomInButton = document.createElement("button");
            zoomInButton.style.height="28px";
            zoomInButton.style.width="28px";
            zoomInButton.style.border="none";
            zoomInButton.style.borderRadius="4px";
            zoomInButton.style.background="#fff";   // button original style - white background
            zoomInButton.style.color="#000";    // button original style - black text color
            zoomInButton.style.margin="4px 0";
            zoomInButton.style.cursor="pointer";
            zoomInButton.setAttribute("id", "zoom_in_button");
            zoomInButton.onmouseover=(function(){
                zoomInButton.style.background="#888";   // button active style - grey background
                zoomInButton.style.color="#fff";    // button active style - white text color
            });
            zoomInButton.innerHTML="+";
            zoomInButton.style.fontSize="18px";
            zoomInButton.style.fontWeight="600";
            buttonWrap.appendChild(zoomInButton);
            buttonWrap.appendChild(document.createElement("br"));
            // Create zoom-out-button for CarPicsSpinnerDiv
            var zoomOutButton = document.createElement("button");
            zoomOutButton.style.height="28px";
            zoomOutButton.style.width="28px";
            zoomOutButton.style.border="none";
            zoomOutButton.style.borderRadius="4px";
            zoomOutButton.style.background="#fff";   // button original style - white background
            zoomOutButton.style.color="#000";    // button original style - black text color
            zoomOutButton.style.margin="4px 0";
            zoomOutButton.style.cursor="pointer";
            zoomOutButton.setAttribute("id", "zoom_out_button");
            zoomOutButton.onmouseover=(function(){
                zoomOutButton.style.background="#888";   // button active style - grey background
                zoomOutButton.style.color="#fff";    // button active style - white text color
            });
            zoomOutButton.onmouseleave=(function(){
                zoomOutButton.style.background="#fff";   // button original style - white background
                zoomOutButton.style.color="#000";    // button original style - black text color
            });
            zoomOutButton.innerHTML="-";
            zoomOutButton.style.fontSize="18px";
            zoomOutButton.style.fontWeight="600";
            buttonWrap.appendChild(zoomOutButton);
            buttonWrap.appendChild(document.createElement("br"));
            // Create hotspot-button for CarPicsSpinnerDiv
            var hotspotButton = document.createElement("button");
            hotspotButton.style.height="28px";
            hotspotButton.style.width="28px";
            hotspotButton.style.border="none";
            hotspotButton.style.borderRadius="4px";
            hotspotButton.style.background="#fff";   // button original style - white background
            hotspotButton.style.color="#000";    // button original style - black text color
            hotspotButton.style.margin="4px 0";
            hotspotButton.style.cursor="pointer";
            hotspotButton.setAttribute("id", "hotspot_button");
            hotspotButton.onmouseover=(function(){
                hotspotButton.style.background="#888";   // button active style - grey background
                hotspotButton.style.color="#fff";    // button active style - white text color
            });
            hotspotButton.onmouseleave=(function(){
                hotspotButton.style.background="#fff";   // button original style - white background
                hotspotButton.style.color="#000";    // button original style - black text color
            });
            hotspotButton.style.fontSize="14px";
            hotspotButton.style.fontWeight="600";
            buttonWrap.appendChild(hotspotButton);
            spinners.push({
                numberOfConnections: div.getAttribute("numberOfConnections"),
                autospin: div.getAttribute("autospin"),
                autospinDirection: div.getAttribute("autospinDirection") == "left" ? -1 : 1,
                spinOnLoad: div.getAttribute("spinOnLoad"),
                divId: div.getAttribute("id"),
                sourceURL: "http://feed.carpics2p0.com/rest/spinner/s3?dealer="+div.getAttribute("dealer")
                +"&vin=" + div.getAttribute("vin"),
                autospinSleep: div.getAttribute("autospinSleep"),
                spinSensitivity: div.getAttribute("spinSensitivity"),
                disableMouse: div.getAttribute("disableMouse"),
                displayHotspots: div.getAttribute("displayHotspots"),
                enableInertialMove: div.getAttribute("enableInertialMove"),
                overrideSize: {
                    overrideWidth: div.getAttribute("overrideWidth"),
                    overrideHeight: div.getAttribute("overrideHeight")
                },
                overlaySource:div.getAttribute("overlaySource")
            });
        }
        var Spinners = new CarPicsSpinnerAPI.CarPicsSpinners({
            spinners: spinners
        });
    }
    if ( document.readyState === "complete" || 
        (document.readyState !== "loading" && !document.documentElement.doScroll)) {
      callback();
    } else {
      document.addEventListener("DOMContentLoaded", callback);
    }
})();
