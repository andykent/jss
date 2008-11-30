/*
 * JSS 0.6
 *
 * Copyright (c) 2007 Andy Kent
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 *
 */

// TODO @import support
// TODO IE conditional comments support
// FIXME Safari 3 bug with media types not always being loaded correctly.
// TODO add basic :hover support

(function($) {

$.jss = {
	
	loadExternalStyles: true, // set to false to only analyse in document styles and avoid ajax requests. 
	exclude: [ // can be used to set selector patterns that should be ignored.
							/^[^:>\[\]\+\~]+$/, // only bother with complex selectors that include ':', '[', ']' or '>'.
							/\:hover$/i // ignore hover events for now as the functionality is incomplete
						], 
	only: [], // only include selectors that match one these patterns
	debugMode: false, // turn on/off debugging alerts
	
	disableCaching: false, // turn this on to disable caching
	
	checkMediaTypes: true, // set this to false if you want to always apply all media types regardless of context.
	
	cache: {}, // used to cache selectors
	
	loadQueue: [], // tracks the load order of external sheets to make sure that styles are applied in the correct order
	completeQueue: [], // tacks which css files have been loaded
	
	behaviors: [], // custom selector callbacks that can be used to apply additional styling via javascript functions
	
	media: {}, // a cache of media types and if they are supported in the current state
	
	testDiv: null, // used to test selector functionality. lazy loaded when needed. see mediumApplies()
	
	relTypes: ['stylesheet', 'jss-stylesheet'], // types that jss will lookout for in html rel tags
	
	liveUpdates: false, // this option requires the livequery plugin, is Alpha and has a serious effect on performance
	
	apply: function(content) {
		var selectors = [];
		var jss = this;
		$('style,link[type=text/css]').each(function() {
			if (jss.checkMediaTypes) { // media type support enabled
				if(!jss.mediumApplies(this.media)) return; // medium doesn't apply in this context so ignore it entirely.
			}
			if(this.href) {
				if(!jss.isInterestingRelType(this.rel)) return; // check this is a stylesheet or a jss specific stylesheet, ignore all others.
				if(jss.loadExternalStyles) {
					jss.loadQueue.push(this.href);
					jss.loadStylesFrom(this.href);
				};
			} else {
				selectors = selectors.concat(jss.parse(this.innerHTML));
			};
		});
		if(content) selectors.concat(this.parse(content)); // parse any passed in styles
		this.applyBehaviors(selectors); // apply behaviors before filters
		selectors = this.filterSelectors(selectors);
		this.applySelectors(selectors);
	},
	
	isInterestingRelType: function(type){
		var interesting = false;
		$.each(this.relTypes, function() { if(type==this) interesting = true; });
		return interesting;
	},
	
	loadStylesFrom: function(href) {
		var jss = this;
		$.ajax({
			url: href,
			success: function(data) {
				jss.debug('LOADED EXTERNAL STYLES',href );
				jss.refreshLoadQueue(href,data);
			}
		});
	}, 
	
	refreshLoadQueue: function(href,txt) {
		if(this.loadQueue.length==0) return; // everything in the queue is loaded
		if(href){ // a new sheet has been recieved
			if(href==this.loadQueue[0]) { // this sheet is next in the queue
				this.loadQueue.shift(); // move the queue on
				this.runStylesFromText(txt); // process this sheet
				this.refreshLoadQueue(); // recurse to see if any sheets are ready for loading.
			}
			else {
				this.completeQueue.push({href:href,txt:txt}); // not next so put aside for later
				this.refreshLoadQueue(); // recurse to see if any sheets are ready for loading.
			};
		} else { // no new sheet, lets see if the next load queue sheet matches anything in the completed queue
			if(this.completeQueue.length>0) {
				for(i in this.completeQueue) {
					var doc=this.completeQueue[i];
					if(doc.href==this.loadQueue[0]) { // we have a match
						this.loadQueue.shift(); // move the queue on
						this.completeQueue.splice(i,1); // clean up the completed queue
						this.runStylesFromText(doc.txt); // process this sheet
						this.refreshLoadQueue();
					};
				};
			};
		};
	},
	
	runStylesFromText: function(data){
			this.debug('PARSING EXTERNAL STYLES');
			var selectors = this.filterSelectors(this.parse(data));
			this.applySelectors(selectors);
			this.debug('COMPLETED PARSING EXTERNAL STYLES');
	},
	
	applySelectors: function(selectors) {
		var jss= this;
		var result = null;
		$.each(selectors, function(){ // load each of the matched selectors
			if(jss.isUnderstoodSelector(this.selector)) return; // skip applying the selector if the browser already understands it.
			if(jss.disableCaching) return jss.applyStyles($(this.selector), this.attributes); // cache is turned off so just apply styles
			if(jss.cache[this.selector]){ // check the cache
				jss.debug('HIT',this.selector)
				jss.applyStyles(jss.cache[this.selector], this.attributes); // direct cache hit
			} else if( result=jss.scanCache(this.selector) ) {
				jss.debug('PARTIAL',result,result[0].find(result[1]))
				jss.applyStyles(result[0].find(result[1]), this.attributes); // partial cache hit
			}	else {
				jss.debug('MISS',this.selector)
				jss.cache[this.selector] = jss.applyStyles($(this.selector), this.attributes); // cache miss
			};
		});
	},
	
	applyStyles: function($els,styles) {
		if(this.livequery) $els.livequery(function() { $(this).css(styles); });
		else $els.css(styles);
		return $els;
	},
	
	applyBehaviors: function(selectors){
		if(this.behaviors.length==0) return;
		var jss = this;
		$.each(selectors, function(){
			var style = this;
			$.each(jss.behaviors, function(){
				try {
					var value = style.attributes[this.property];
					if(value){
						jss.debug("BEHAVIOR TRIGGERED", style.selector, value);
						this.behavior(style.selector, value);
					}
				}
				catch (e) {
					jss.debug('CUSTOM RULE ERROR', this.selector, e);
				};
			});
		});
	},
	
	scanCache: function(selector) {
		for(var s in this.cache) {
			if(selector.search(new RegExp('^'+s+'[ >]'))>-1)
				return [ this.cache[s], selector.replace(new RegExp('^'+s+'[ >]'),'') ];
		};
	},
	
	filterSelectors: function(selectors){
		if(!selectors.length) return [];
		var s = selectors;
		this.debug('Before Filtering:',s.length,s);
		if(this.only && this.only.length) { // filter selectors to remove those that don't match the only include rules
			var inclusions = this.only;
			var t=[]; // temp store for matches
			for(var i=0;i<inclusions.length;i++){
				for(var pos=0;pos<s.length;pos++){
					if( typeof inclusions[i]=='string' ? s[pos].selector==inclusions[i] : s[pos].selector.match(inclusions[i]) ) {
						this.debug('Added:',s[pos]);
						t.push(s[pos]);
					};
				};
			};
			s=t;
		};
		if(this.exclude && this.exclude.length){ // filter selectors to remove those that match the exclusion rules
			var exclusions = this.exclude;
			for(var i=0;i<exclusions.length;i++){
				for(var pos=0;pos<s.length;pos++){
					if( typeof exclusions[i]=='string' ? s[pos].selector==exclusions[i] : s[pos].selector.match(exclusions[i]) ) {
						this.debug('Removed:',s[pos]);
						s.splice(pos,1);
						pos--;
					};
				};
			};
		};
		this.debug('After Filtering:',s.length,s);
		return s;
	},
	
	addBehavior: function(property, behavior){
  	this.behaviors.push({ property:property, behavior:behavior });
		return this;
	},
	
	// ---
	// Some magic for checking if a selector is understood by the browser - Thanks go to Daniel Wachsstock <d.wachss@prodigy.net>
	// --
	
	isUnderstoodSelector: function(str){
	   var ret;
	   str += '{}'; // make a rule out of it
	   // Things like this make us crazy:
	   // Safari only creates the stylesheet if there is some text in the style element,
	   // while Opera crashes if the original statement has any text [as $('<style> </style>') ].
	   // IE crashes if we try to append a text node to a style element.
	   // The following satisfies all of them
	   var style = $('<style type="text/css"/>').appendTo('head')[0];
	   try {
	     style.appendChild(document.createTextNode(''));
	   }catch(e){ /* nothing */ }
	   if (style.styleSheet){
	     // IE freezes up if addRule gets a selector it doesn't understand, but parses cssText fine and turns it to UNKNOWN
	     style.styleSheet.cssText = str;
	     ret =  !/UNKNOWN/i.test(style.styleSheet.cssText);
	   }else if (style.sheet){
	     // standards
	     try {
	       style.sheet.insertRule(str, 0);
	       ret = style.sheet.cssRules.length > 0; // the browser accepted it; now see if it stuck (Opera gets here)
	     }catch(e) {
	       ret = false; // browser couldn't handle it
	     }
	   }
	   $(style).remove();
	   return ret;
	 },	
	
	
	// ---
	// A test to see if a particular media type should be applied
	// ---
	
	mediumApplies: function(str){
	   if (!str) return true; // if no descriptor, everything applies
	   if (str in this.media) return this.media[str]; // cache
	   if (!this.testDiv){
	     this.testDiv = $('<div id="mediaTestDiv" style="position:relative">').append('<div>').appendTo('body'); // lazy create
	   };
	   var style = $('<style type="text/css" media="'+str+'" />').appendTo('head')[0];
	   try {
	     style.appendChild(document.createTextNode(''));
	   }catch(e){ /* nothing */ }
	   if (style.styleSheet){
	     // IE
	     style.styleSheet.addRule('#mediaTestDiv', 'left: 1px');
	   }else if (style.sheet){
	     // standards
	     style.sheet.insertRule('#mediaTestDiv {left: 1px}', 0);
	   }
	   this.media[str] = this.testDiv.css('left') == '1px';
	   $(style).remove();
	   return this.media[str];
	 },
	
	
	// ---
	// ultra lightweight CSS parser, only works with 100% valid css files, no support for hacks etc.
	// ---
	
	sanitize: function(content) {
		if(!content) return '';
		var c = content.replace(/[\n\r]/gi,''); // remove newlines
		c = c.replace(/\/\*\@JSS (.+?)\*\//gi,' $1 '); // strip JSS targetted comments
		c = c.replace(/\/\*.+?\*\//gi,''); // remove comments
		return c;
	},
	
	parse: function(content){
		var c = this.sanitize(content);
		var tree = []; // this is the css tree that is built up
		c = c.match(/.+?\{.+?\}/gi); // seperate out selectors
		if(!c) return [];
		for(var i=0;i<c.length;i++) // loop through the selectors & parse the attributes
			if(c[i]) 
				tree.push( { selector: this.parseSelectorName(c[i]),  attributes: this.parseAttributes(c[i]) } );
		return tree;
	},
	
	parseSelectorName: function(content){
		return $.trim(content.match(/^.+?\{/)[0].replace('{','')); // extract the selector
	},
	
	parseAttributes: function(content){
		var attributes = {};
		c = content.match(/\{.+?\}/)[0].replace(/[\{\}]/g,'').split(';').slice(0,-1);
		for(var i=0;i<c.length; i++){
			if(c[i]){
				c[i] = c[i].split(':');
				attributes[$.trim(c[i][0])] = $.trim(c[i][1]);
			}; 
		};
		return attributes;
	},

	debug: function() {
		if(this.debugMode) 
			console==undefined ? alert(arguments[0]) : console.log(arguments);
	}
	
};

})(jQuery);