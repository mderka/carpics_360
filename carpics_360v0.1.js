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
                this.connectionsFinished++;
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
            this.LoadCursor.NextImage = new CarPicsImage(this.data[nextIndex], nextIndex, this.divId, this.getNextImage(this));
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
        this.zoomToggle = function(baseEvent) {
            if (this.zoomed == true) {
                this.CurrentImage.unzoom();
                this.spinStatus = false;
                this.zoomed = false;
                return true;
            } else {
                this.pauseMouseTime = Date.now() + 500;
                this.zoomed = true;
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
            this.spinnerDiv.style.backgroundImage = "url('https://s3-us-west-2.amazonaws.com/cdn.carpics2p0.com/" + this.CurrentImage.sourceObject.src + "')";
            this.spinnerDiv.style.backgroundSize = "100% 100%";
            var previous = this.CurrentImage;
            this.CurrentImage = nextImage;
            this.CurrentImage.HTMLElement.style.display = "block";
            previous.HTMLElement.style.display = "none";
        }
        this.insertPlaceholder = function(){
            var element = document.getElementById(this.divId);
            element.style.backgroundImage="url('https://s3-us-west-2.amazonaws.com/resources.carpics2p0.com/Rotation/checkerboard-backgrounds-wallpapers.jpg')";
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
                        return;
                    }
                    if (thisObj.interacted) {
                        CarPicsGoogleAnalytics('send', 'pageview', {
                            'dimension1': 'Click'
                        });
                        thisObj.interacted = true;
                    }
                    CarPicsGoogleAnalytics('send', 'pageview', {
                        'dimension1': 'Click'
                    });
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
                    CarPicsGoogleAnalytics('send', 'pageview', {
                        'dimension2': 'Doubleclick'
                    });
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
            * Mouseup event ends drag status.
            */
            document.getElementById(this.divId).addEventListener("mouseup", (function(thisObj) {
                return function(baseEvent) {
                    baseEvent.preventDefault();
                    if (thisObj.zoomed || thisObj.mouseDisabled) {
                        return;
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
                    if (thisObj.zoomed == true) {
                        thisObj.CurrentImage.move(currentXPosition, currentYPosition);
                    } else {
                        while (thisObj.mouseXPosition - currentXPosition > thisObj.spinSensitivity){
                            thisObj.turning = true;
                            thisObj.displayNextImage(1);
                            thisObj.mouseYPosition = currentYPosition;
                            thisObj.mouseXPosition = thisObj.mouseXPosition - thisObj.spinSensitivity;
                        }
                        while (currentXPosition - thisObj.mouseXPosition > thisObj.spinSensitivity) {
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
                    if (thisObj.interacted) {
                        CarPicsGoogleAnalytics('send', 'pageview', {
                            'dimension1': 'Touchstart'
                        });
                        thisObj.interacted = true;
                    }
                    CarPicsGoogleAnalytics('send', 'pageview', {
                        'dimension2': 'Touchstart'
                    });
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
        this.CurrentImage = new CarPicsImage(data[0], 0, this.divId, function() {});
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
    this.CarPicsImage = function(source, index, div, callback) {
        /*
        * Controls CSS to properly allow zoom functionality.
        */
        this.zoom = function(baseEvent) {
            var offset = this.HTMLElement.getBoundingClientRect();
            this.HTMLElement.style.maxHeight = "200%";
            this.HTMLElement.style.maxWidth = "200%";
            this.HTMLElement.style.height = "200%";
            this.HTMLElement.style.width = "200%";
            var clientX = baseEvent.type == "dblclick" ? baseEvent.pageX - window.scrollX : baseEvent.targetTouches[0].clientX;
            var clientY = baseEvent.type == "dblclick" ? baseEvent.pageY - window.scrollY : baseEvent.targetTouches[0].clientY;
            this.move(clientX,clientY);
        }
        /*
         * Resets element to default after zoom end.
         */
        this.unzoom = function() {
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
        this.move = function(mouseX, mouseY) {
            var offset = this.HTMLElement.parentElement.getBoundingClientRect();
            var mouseXOffset;
            var mouseYOffset;
            if (mouseX > offset.left && mouseX < (offset.left + offset.width) && mouseY > offset.top && mouseY < (offset.top + offset.height)) {
                mouseXOffset = offset.left - mouseX;
                mouseYOffset = offset.top - mouseY;
            } else {
                return;
            }
            this.HTMLElement.style.left = mouseXOffset / document.documentElement.clientWidth * 100 + 'vw';
            this.HTMLElement.style.top = mouseYOffset / document.documentElement.clientWidth * 100 + 'vw';
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
            this.HTMLElement.style.transition = "all .5s linear";
            this.HTMLElement.style.mozTransition = "all .5s linear";
            this.HTMLElement.style.webkitTransition = "all .5s linear";
            this.HTMLElement.style.oTransition = "all .5s linear";
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
        this.setDefaultImageStyles();
        this.imgElement.setAttribute("src", "https://s3-us-west-2.amazonaws.com/cdn.carpics2p0.com/" + source.src);
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
            spinners.push({
                numberOfConnections: div.getAttribute("numberOfConnections"),
                autospin: div.getAttribute("autospin"),
                autospinDirection: div.getAttribute("autospinDirection") == "left" ? -1 : 1,
                spinOnLoad: div.getAttribute("spinOnLoad"),
                divId: div.getAttribute("id"),
                sourceURL: "https://feed.carpics2p0.com/rest/spinner/s3?dealer="+div.getAttribute("dealer")
                +"&vin=" + div.getAttribute("vin"),
                autospinSleep: div.getAttribute("autospinSleep"),
                spinSensitivity: div.getAttribute("spinSensitivity"),
                disableMouse: div.getAttribute("disableMouse"),
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
