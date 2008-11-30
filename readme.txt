JSS																							by Andy Kent
------------------------------------------------------------
JSS is a plugin to the jQuery JavaScript library.
It is designed to make all jQuery selectors available within
your standard CSS files.
This effectively means that you get full CSS3 selector
support in all jQuery supported browsers.


BASIC USAGE
------------------------------------------------------------
$(document).ready(function() {
	 $.jss.apply();
});


SETTINGS
------------------------------------------------------------

$.jss.loadExternalStyles - Boolean - true
Use this to turn off the loading of styles in external files,
by default these are loaded which causes additional ajax
requests back to the server.

$.jss.disableCaching - Boolean - false
Turning this on will disable selector caching, selector
caching can be good and bad, it can drastically improve
performance if you have lots of styles with identical or
patially identical selectors but it can be wasteful of
memory where you have lots of completely different selectors.

$.jss.checkMediaTypes - Boolean - true
When this is activated JSS will obey media attributes on
link and style tags and only apply the styles if the
media context is active. THIS IS EXPERIMENTAL.

$.jss.exclude - Array - [2]
An array of srings (exact match) or regular expressions.
these are compared against each selector and matches are
not applied. A useful example might be classes with a
hover state... $.jss.exclude.push(/\:hover$/);
Exclude has some sensible defaults set to ignore simple
selectors which are already fully supported. 

$.jss.only - Array - [0]
An array of strings (exact match) or regular expressions.
only selectors that match one of these rules will be
processed by JSS. This can greatly improve performance
if you only have one or two selectors that need applying.

$.jss.addBehavior('property', behaviourFunction('selector', 'value'))
This function can be used to add callbacks to a css
property, whenever the css property is found the callback is fired
along with the selector string and property value. e.g.
  $.jss.addBehavior('border-radius', function(selector, value){ 
    if($.browser.msie) $(elems).curvyCorners(value); 
  });

CONTRIBUTERS
------------------------------------------------------------
Andy Kent <andrew.d.kent@gmail.com>
Daniel Wachsstock <d.wachss@prodigy.net>
Rafael Santos <shanex.fael@gmail.com>
Angelo Berios <angelo.berios@adnova.ca>

