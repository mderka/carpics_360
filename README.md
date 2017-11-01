# carpics_360
Viewer for Car Pics 2.0 walkaround 360 product.

## INTRODUCTION
The carpics spinner is a 360 viewer which allows cycling through a reel of photos, and selectively zooming in for emphasis. The cycling can either be automatic, or manually controlled using mouse actions. It can also be configured to have automatic spin with manual controls as well (manual controls take precedence in this case). Mobile events are fully implemented as well.

### Desktop Controls:

- Mouse click and drag to rotate.
- Mouse doubleclick (mouse1 only) to zoom/unzoom.
- Hold mouseclick without movement to zoom.

### Mobile Controls:

- Touch and drag to rotate.
- Touch and hold to zoom/unzoom.

## Further configurations are :

- The number of web connections that are usable for this utility (more connections speed up loading via concurrence, at the expense of higher peak bandwidth requirements) - also prevents saturation of connections, which decreases page performance. 
- Whether it should spin before all images are loaded, if autospinning.
- If mouse interaction is not desired at all – can disable mouse input.
- Configurable mouse sensitivity, time between autospin frames.

## Other features: 
- Fault tolerant – Broken images should not display, nor should they break the spinner.
 
## How to use: 
Include JQuery, as this library is JQuery dependent (for now - we may revisit this in later versions). Insert JQuery as follows:
Desktop JQuery:
```
	<link rel="stylesheet" href="https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/themes/smoothness/jquery-ui.css">
	<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min.js"></script>
```
Mobile JQuery:
```
    <link rel="stylesheet" href="https://ajax.googleapis.com/ajax/libs/jquerymobile/1.4.5/jquery.mobile.min.css">
    <script src="https://ajax.googleapis.com/ajax/libs/jquerymobile/1.4.5/jquery.mobile.min.js"></script>
```
**\*\*Note!\*\*** : JQuery Mobile's CSS sheet makes changes to the way JQuery events are handled. If the JQuery css is new to your site, test. The CSS can be omitted safely if issues are caused by including it. This is especially important if you use responsive design - as most issues caused are most apparent in desktop.

After including JQuery, the basic way to use this library is to provide a div with a few mandatory properties. Here is an example of the minimal spinner div:
```
<div id="<UniqueDivId>" vin="<vehicle vin>" dealer="<dealer id>" class="CarPicsSpinner" >
</div>
```

The attribute that identifies this div as a 360 viewer is having the calss CarPicsSpinner. The viewer will, on document ready, capture every div with the class of CarPicsSpinner, and attempt to construct a viewer from them (You can safely have as many of these as desired, as long as they have unique div IDs).

In the same HTML document as this is defined, then add a script tag referencing to the spinner source:
```
<script src="<Host Path>/CarPicsSpinner0.1.js" async=true></script>
```
### Mandatory Attributes:
- id : value=<string> - Div needs ID to be uniquely identified by the library. Must be unique (Per HTML standards), but is not limited besides that.
- class : value="CarPicsSpinner" - The library gets elements by class, and sets up a spinner in any div with classvalue = "CarPicsSpinner".
- vin : value="<vin string>" - The vehicle vin, used to lookup the spinner resource. This information will be available in the system that generates that vehicle page.
- dealer : value="<dealer id string>" - The dealer ID, used with vin to lookup the spinner resource. You will be assigned your dealer ID by Car Pics 2.0 when signing up for the 360 product.
- width, height : (Styling properties) - The width and height for this tool should match the aspect ratio decided when setting up with Car Pics 2.0.  As long as aspect ratio is maintained, any size is supported.
### All div attribute configs: 
- id - valid value:<string, unique> - Unique identifier of the spinner div.
- class - valid value:"CarPicsSpinner" - Indication that a given div is in fact a CarPicsSpinner.
- vin : value="<vin string>" - The vehicle vin, used to lookup the spinner resource. This information will be available in the system that generates that vehicle page.
- dealer : value="<dealer id string>" - The dealer ID, used with vin to lookup the spinner resource. You will be assigned your dealer ID by Car Pics 2.0 when signing up for the 360 product.
- numberOfConnections - valid values:<decimal numeric string> | default "4" – Number of HTTP connections to use for making image requests.
- autospin – valid values:"true" | default "false" - Allows spinner to spin automatically, with direction and speed futher configurable.
- autospinDirection – valid values: "left" | default "right" - Used if it is desired to autospin in the opposite to default direction.
- autospinSleep – valid values:<decimal numeric string> | default "100" - used in autospin to indicate how long to wait between frames (ms).
- disableMouse – Valid values:"true" | default "false" – used to disable manual rotation, zoom. 
- spinOnLoad – Valid values:"true" | default "false" - Used to disable autospin until all images are loaded. If true, sets autospin true as well. Does not prevent mouse-spin.


### Usage Advice: 
 - Make the div, with whatever sizing/positioning controls desired (spinner does not enforce size or aspect ratio in order to offer most flexibility and utility). 
 - Give the div the mandatory, and whatever desired optional configurations necessary to achieve your use case. 
 - Add the carpicsspinner script as an async script tag in the document with the above div element in it. 
- That's all.
- Javascript Spinner constructor exposed as well, if you want to dynamically add spinners after pageload, or use construct spinners from JS without specifying class. Accessed as: CarPicsSpinners.MakeSpinner(configuration). Takes JSON configuration argument of this format:
```
{
	numberOfConnections:<number or numeric > 0 | default 4 >,
	autospin:<string, "true" | default "false">,
	autospinDirection:<number, 1 or -1 >,
	spinOnLoad:<string, "true" | default "false" >,
	divId:<string>,
	sourceURL:<string, resolvable url to JSON resource> ,	
	autospinSleep:<number or numeric > 0 | default 100 > ,	
	spinSensitivity:<number or numeric >= 0 | default 5 > ,	
	disableMouse:<string, "true" | default "false">
}
```

## Feature Requests:
Feature requests / bug reports are welcome. Please add new issues with either Feature requests or bug reports. The general philosophy is that you should be able to use this without issue, hence the wild inline.html setup. 
