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
            return function(data) {
                if (data.length==0){
                    return;
                }
                thisObj.spinners[config.divId].spinner = new CarPicsSpinner(config, data);
                thisObj.spinners[config.divId].spinStatus = false;
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
            $.get(config.sourceURL, {}, this.makeBoundGetRequest(config, this), "json");
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
        this.divId = config.divId;
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
        this.spinSensitivity = config.spinSensitivity >= 0 ? config.spinSensitivity : 5;
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
            var element = document.getElementById(config.divId);
            element.style.width = config.overrideSize.width;
            element.style.height = config.overrideSize.height;
        }
        this.spinnerDiv = document.getElementById(this.divId);
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
        this.zoomToggle = function(baseEvent, tapholdCoordinates) {
            if (this.zoomed == true) {
                this.CurrentImage.unzoom();
                this.spinStatus = false;
                this.zoomed = false;
                return true;
            } else {
                this.pauseMouseTime = Date.now() + 500;
                this.zoomed = true;
                this.spinStatus = false;
                this.CurrentImage.zoom(baseEvent, tapholdCoordinates);
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
            var previous = this.CurrentImage;
            this.CurrentImage = nextImage;
            this.CurrentImage.HTMLElement.style.display = "block";
            previous.HTMLElement.style.display = "none";
        }

        // Mouse events:
        if (!this.mouseDisabled) {

        	/*
        	* Mousedown event starts manual rotation (drag spin)
        	*/
            $(document).on("mousedown", "#" + this.divId, (function(thisObj) {
                return function(baseEvent) {
                    baseEvent.preventDefault();
                    var thisTouch = Date.now();

                    if (thisObj.zoomed || baseEvent.button === 2) {
                        return;
                    }
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
            $(document).on("dblclick", "#" + this.divId, (function(thisObj) {
                return function(baseEvent) {
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
        	* Taphold event triggers both mobile and desktop zoom events.
        	*/
            $(document).on("taphold", "#" + this.divId, (function(thisObj) {
                return function(baseEvent) {
                    if (thisObj.turning == true) {
                        return;
                    }
                    baseEvent.preventDefault();
                    var releaseMouse = thisObj.zoomToggle(baseEvent, {
                        "x": thisObj.mouseXPosition,
                        "y": thisObj.mouseYPosition
                    });
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
            $(document).on("mouseup", (function(thisObj) {
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
            $(document).on("mousemove", (function(thisObj) {
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
                        thisObj.CurrentImage.move(thisObj.mouseXPosition, thisObj.mouseYPosition);
                    } else if (thisObj.mouseXPosition - currentXPosition > thisObj.spinSensitivity) {
                        thisObj.turning = true;
                        thisObj.displayNextImage(1);
                    } else if (currentXPosition - thisObj.mouseXPosition > thisObj.spinSensitivity) {
                        thisObj.turning = true;
                        thisObj.displayNextImage(-1);
                    } else {
                        return;
                    }
                    thisObj.mouseYPosition = currentYPosition;
                    thisObj.mouseXPosition = currentXPosition;
                }
            })(this));

        	/*
        	* Touchstart event starts manual rotation (drag spin), also needed to bind 
        	* move events to prevent passive listener warnings and failure of touchmove events.
        	* Also needed to capture position of touchhold event for zooming.
        	*/
            $("#" + this.divId).bind('touchstart', (function(thisObj) {
                return function(event) {
                    event.preventDefault();
                    event.returnValue = false;
                    var thisTouch = Date.now();
                    if (thisObj.zoomed) {
                        return;
                    }
                    thisObj.spinStatus = false;
                    thisObj.turnStatus = true;
                    var touch = event.originalEvent.touches[0] || event.originalEvent.changedTouches[0];
                    thisObj.mouseXPosition = touch.pageX
                    thisObj.mouseYPosition = touch.pageY;
                    /*
                    * Touchmove triggers drag spin in mobile.  Does not trigger zoom move.
                    */
                    $("#" + thisObj.divId).bind('touchmove', (
                        function(thisInternal) {
                            return function(event1) {
                                event1.preventDefault();
                                if (thisInternal.pauseMouseTime > Date.now()) {
                                    return;
                                }
                                if (thisInternal.turnStatus !== true && thisInternal.zoomed !== true) {
                                    return;
                                }
                                var touch = event1.originalEvent.touches[0] || event1.originalEvent.changedTouches[0]
                                var currentXPosition = touch.pageX;
                                var currentYPosition = touch.pageY;
                                if (thisInternal.zoomed == true) {
                                    thisInternal.CurrentImage.move(thisObj.mouseXPosition, thisObj.mouseYPosition);
                                } else if (thisInternal.mouseXPosition - currentXPosition > thisInternal.spinSensitivity) {
                                    thisObj.turning = true;
                                    thisInternal.displayNextImage(1);
                                } else if (currentXPosition - thisInternal.mouseXPosition > thisInternal.spinSensitivity) {
                                    thisObj.turning = true;
                                    thisInternal.displayNextImage(-1);
                                } else {
                                    return;
                                }
                                thisInternal.mouseYPosition = currentYPosition;
                                thisInternal.mouseXPosition = currentXPosition;
                                thisInternal.pauseMouseTime = Date.now() + 25;
                            }
                        }
                    )(thisObj));
                }
            })(this));

        	/*
        	* Touchend event ends manual drag.
        	*/
            $(document).on('touchend', "#" + this.divId, (function(thisObj) {
                return function(event) {
                    if (thisObj.mouseDisabled) {
                        return;
                    }
                    thisObj.spinStatus = thisObj.spinDefault;
                    thisObj.turnStatus = false;
                    thisObj.turning = false;
                    thisObj.spinnerDiv.style.cursor = "-webkit-grab";
                    thisObj.spinnerDiv.style.cursor = "grab";
                    thisObj.spinnerDiv.style.cursor = "-moz-grab";
                    $("#" + thisObj.divId ).unbind('touchmove', function(event1) {});
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
        var indicateReady = (function(thisObj, index) {
            return function() {
                thisObj.isReady = true;
            }
        })(this, index);
        /*
        * Controls CSS to properly allow zoom functionality.
        */
        this.zoom = function(baseEvent, tapholdCoordinates) {
            var offset = this.HTMLElement.getBoundingClientRect();
            this.HTMLElement.style.maxHeight = "200%";
            this.HTMLElement.style.maxWidth = "200%";
            this.HTMLElement.style.height = "200%";
            this.HTMLElement.style.width = "200%";
            var clientX = baseEvent.type == "taphold" ? tapholdCoordinates.x - window.scrollX : baseEvent.clientX;
            var clientY = baseEvent.type == "taphold" ? tapholdCoordinates.y - window.scrollY : baseEvent.clientY;
            var xOffsetCenter = (offset.width / 2 - (clientX - offset.left));
            var yOffsetCenter = (offset.height / 2 - (clientY - offset.top));
            var x = xOffsetCenter - offset.width / 2;
            var y = yOffsetCenter - offset.height / 2;
            this.HTMLElement.style.left = x / document.documentElement.clientWidth * 100 + 'vw';
            this.HTMLElement.style.top = y / document.documentElement.clientWidth * 100 + 'vw';
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
            this.HTMLElement.style.position = 'relative';
            this.HTMLElement.style.maxHeight = "100%";
            this.HTMLElement.style.maxWidth = "100%";
            this.HTMLElement.style.height = "100%";
            this.HTMLElement.style.width = "100%";
            this.HTMLElement.style.left = "0vw";
            this.HTMLElement.style.top = "0vw";
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
        this.NextImage = this;
        this.PreviousImage = this;
        this.Index = index;
        this.isReady = false;
        this.sourceObject = source;
        this.elementId = div + "-" + source.src;
        this.HTMLElement = document.createElement("img");
        this.setDefaultImageStyles();
        this.HTMLElement.setAttribute("src", source.src);
        this.HTMLElement.setAttribute("id", this.elementId);
        this.HTMLElement.addEventListener("load", function() {
            callback();
            indicateReady()
        });
        this.HTMLElement.addEventListener("error", callback);
    }
    return this;
})();

/**
* Closure that iterates over all elements with classname of "carPicsSpinner" and sets up a spinner in that div.
*/
$(document).ready( function() {
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
            sourceURL: "http://api.carpics2p0.com/rest/spinner?dealer="+div.getAttribute("dealer")
            +"&vin=" + div.getAttribute("vin"),
            autospinSleep: div.getAttribute("autospinSleep"),
            spinSensitivity: div.getAttribute("spinSensitivity"),
            disableMouse: div.getAttribute("disableMouse"),
            overrideSize: {
                overrideWidth: div.getAttribute("overrideWidth"),
                overrideHeight: div.getAttribute("overrideHeight")
            }
        });
    }
    var Spinners = new CarPicsSpinnerAPI.CarPicsSpinners({
        spinners: spinners
    });
});
