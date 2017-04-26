/*
 * Extending patorjk's xbbcode for use with node.js & nodebb (nodebb.org)
 * -- adarqui
 */
/*
Copyright (C) 2011 Patrick Gillespie, http://patorjk.com/

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/*
    Extendible BBCode Parser v1.0.0
    By Patrick Gillespie (patorjk@gmail.com)
    Website: http://patorjk.com/

    This module allows you to parse BBCode and to extend to the mark-up language
    to add in your own tags.
*/

"use strict";

var url = require('url'),
	querystring = require('querystring');

var XBBCODE = (function() {

    // -----------------------------------------------------------------------------
    // Set up private variables
    // -----------------------------------------------------------------------------

    var me = {},
        urlPattern = /^(?:https?|file|c):(?:\/{1,3}|\\{1})[-a-zA-Z0-9:@#%&()~_?\+=\/\\\.]*$/,
        colorNamePattern = /^(?:red|green|blue|orange|yellow|black|white|brown|gray|silver|purple|maroon|fushsia|lime|olive|navy|teal|aqua)$/,
        colorCodePattern = /^#?([a-f0-9]{6}|[a-f0-9]{3})$/i,
        tags,
        tagList,
        tagsNoParseList = [],
        bbRegExp,
        pbbRegExp,
        pbbRegExp2,
        openTags,
        closeTags;
        
    /* -----------------------------------------------------------------------------
     * tags
     * This object contains a list of tags that your code will be able to understand.
     * Each tag object has the following properties:
     *
     *   openTag - A function that takes in the tag's parameters (if any) and its
     *             contents, and returns what its HTML open tag should be. 
     *             Example: [color=red]test[/color] would take in "=red" as a
     *             parameter input, and "test" as a content input.
     *             It should be noted that any BBCode inside of "content" will have 
     *             been processed by the time it enter the openTag function.
     *
     *   closeTag - A function that takes in the tag's parameters (if any) and its
     *              contents, and returns what its HTML close tag should be.
     *
     *   displayContent - Defaults to true. If false, the content for the tag will
     *                    not be displayed. This is useful for tags like IMG where
     *                    its contents are actually a parameter input.
     *
     *   restrictChildrenTo - A list of BBCode tags which are allowed to be nested
     *                        within this BBCode tag. If this property is omitted,
     *                        any BBCode tag may be nested within the tag.
     *
     *   restrictParentsTo - A list of BBCode tags which are allowed to be parents of
     *                       this BBCode tag. If this property is omitted, any BBCode 
     *                       tag may be a parent of the tag.
     *
     *   noParse - true or false. If true, none of the content WITHIN this tag will be
     *             parsed by the XBBCode parser.
     *       
	 *	 removeCRLF - when in a tag with this set, strip our \r and \n characters
     *
     *
     * LIMITIONS on adding NEW TAGS:
     *  - Tag names should be alphanumeric (including underscores) and all tags should have an opening tag
     *    and a closing tag. 
     *    The [*] tag is an exception because it was already a standard
     *    bbcode tag. Technecially tags don't *have* to be alphanumeric, but since 
     *    regular expressions are used to parse the text, if you use a non-alphanumeric 
     *    tag names, just make sure the tag name gets escaped properly (if needed).
     * --------------------------------------------------------------------------- */
        
    tags = {
        "b": {
            openTag: function(params,content) {
                return '<span class="xbbcode-b">';
            },
            closeTag: function(params,content) {
                return '</span>';
            }
        },
        /*
            This tag does nothing and is here mostly to be used as a classification for
            the bbcode input when evaluating parent-child tag relationships
        */
        "bbcode": {
            openTag: function(params,content) {
                return '';
            },
            closeTag: function(params,content) {
                return '';
            }
        },
        "code": {
            openTag: function(params,content) {
                return '<pre><code class="xbbcode-code">';
            },
            closeTag: function(params,content) {
                return '</code></pre>';
            },
            noParse: true
        },
        "color": {
            openTag: function(params,content) {
            
                var colorCode = params.substr(1) || "black";
                colorNamePattern.lastIndex = 0;
                colorCodePattern.lastIndex = 0;
                if ( !colorNamePattern.test( colorCode ) ) {
                    if ( !colorCodePattern.test( colorCode ) ) {
                        colorCode = "black";
                    } else {
                        if (colorCode.substr(0,1) !== "#") {
                            colorCode = "#" + colorCode;
                        }
                    }
                }
            
                return '<span style="color:' + colorCode + '">';
            },
            closeTag: function(params,content) {
                return '</span>';
            }
        },
        "i": {
            openTag: function(params,content) {
                return '<span class="xbbcode-i">';
            },
            closeTag: function(params,content) {
                return '</span>';
            }
        },
        "img": {
            openTag: function(params,content) {
            
                var myUrl = content;
                
                urlPattern.lastIndex = 0;
                if ( !urlPattern.test( myUrl ) ) {
                    myUrl = "";
                }
            
                return '<img src="' + myUrl + '" />';
            },
            closeTag: function(params,content) {
                return '';
            },
            displayContent: false
        },
		"ulist": {
			openTag: function(params,content) {
				var list_type = "xbbcode-list xbbcode-list-decimal";
                return '<ul class="'+list_type+'">';
			},
			closeTag: function(params,content) {
				return "</ul>";
			},
			restrictChildrenTo: ["*", "li"],
			removeCRLF: true,
		},
        "list": {
            openTag: function(params,content) {
				var options = {};
				var list_type = "xbbcode-list";
				paramsMisc.parse(params,function(key,val) {
					options[key] = val;
				});
				if(options.type == "decimal") list_type = "xbbcode-list xbbcode-list-decimal";
				return '<ul class="'+list_type+'">';
            },
            closeTag: function(params,content) {
                return '</ul>';
            },
            restrictChildrenTo: ["*", "li"],
			removeCRLF: true,
        },
		"li": {
			openTag: function(params,content) {
				return '<li class="xbbcode-list-li">';
			},
			closeTag: function(params,content) {
				return '</li>';
			},
			restrictParentsTo: ["list"],
			removeCRLF: true,
		},
        "noparse": {
            openTag: function(params,content) {
                return '';
            },
            closeTag: function(params,content) {
                return '';
            },
            noParse: true
        },
        "php": {
            openTag: function(params,content) {
                return '<span class="xbbcode-code">';
            },
            closeTag: function(params,content) {
                return '</span>';
            },
            noParse: true
        },
        "quote": {
			/* [quote author=xyz link=abc date=1380953499] */
            openTag: function(params,content) {

				var ret = [];
				var options = {};
				var date;
				paramsMisc.parse(params,function(key,val) {
					options[key] = val;
				});
				if(options.author) {
					ret.push(	'<div class="xbbcode-blockquote-header">' +
					 				'<div class="xbbcode-blockquote-top">' );
					if(options.date) {
						date = new Date(options.date*1000);
						options.date = date.toDateString() + ', ' + date.toTimeString();
					}
					if(options.link) {
						/* Linkable quote */
						ret.push(
							'<a href="//'+options.link+'">Quote from: '+options.author+' on '+options.date+'</a>');
					} else {
						/* Just tell us who we're quoting */
						ret.push('<span>'+options.author+'</span>');
					}
					ret.push('</div></div>');
				}
				ret.push('<blockquote class="xbbcode-blockquote">');
				return ret.join('');
            },
            closeTag: function(params,content) {
                return '</blockquote>';
            }
        },
        "s": {
            openTag: function(params,content) {
                return '<span class="xbbcode-s">';
            },
            closeTag: function(params,content) {
                return '</span>';
            }
        },
        "size": {
            openTag: function(params,content) {
            
                var mySize = parseInt(params.substr(1),10) || 0;
                if (mySize < 4 || mySize > 40) {
                    mySize = 14;
                }
            
                return '<span class="xbbcode-size-' + mySize + '">';
            },
            closeTag: function(params,content) {
                return '</span>';
            }
        },
        "table": {
            openTag: function(params,content) {
                return '<table class="xbbcode-table">';
            },
            closeTag: function(params,content) {
                return '</table>';
            },
            restrictChildrenTo: ["tbody","thead", "tfoot", "tr"]
        },
        "tbody": {
            openTag: function(params,content) {
                return '<tbody>';
            },
            closeTag: function(params,content) {
                return '</tbody>';
            },
            restrictChildrenTo: ["tr"],
            restrictParentsTo: ["table"]
        },
        "tfoot": {
            openTag: function(params,content) {
                return '<tfoot>';
            },
            closeTag: function(params,content) {
                return '</tfoot>';
            },
            restrictChildrenTo: ["tr"],
            restrictParentsTo: ["table"]
        },
        "thead": {
            openTag: function(params,content) {
                return '<thead class="xbbcode-thead">';
            },
            closeTag: function(params,content) {
                return '</thead>';
            },
            restrictChildrenTo: ["tr"],
            restrictParentsTo: ["table"]
        },
        "td": {
            openTag: function(params,content) {
                return '<td class="xbbcode-td">';
            },
            closeTag: function(params,content) {
                return '</td>';
            },
            restrictParentsTo: ["tr"]
        },
        "th": {
            openTag: function(params,content) {
                return '<td class="xbbcode-th">';
            },
            closeTag: function(params,content) {
                return '</td>';
            },
            restrictParentsTo: ["tr"]
        },
        "tr": {
            openTag: function(params,content) {
                return '<tr class="xbbcode-tr">';
            },
            closeTag: function(params,content) {
                return '</tr>';
            },
            restrictChildrenTo: ["td","th"],
            restrictParentsTo: ["table","tbody","tfoot","thead"]
        },
        "u": {
            openTag: function(params,content) {
                return '<span class="xbbcode-u">';
            },
            closeTag: function(params,content) {
                return '</span>';
            }
        },
        "url": {
            openTag: function(params,content) {
            
                var myUrl;
            
                if (!params) {
                    myUrl = content.replace(/<.*?>/g,"");
                } else {
                    myUrl = params.substr(1);
                }
                
                urlPattern.lastIndex = 0;
                if ( !urlPattern.test( myUrl ) ) {
                    myUrl = "#";
                }
            
                return '<a href="' + myUrl + '" target="_blank">';
            },
            closeTag: function(params,content) {
                return '</a>';
            }
        },
		"link" : "url",
		"youtube": {
			openTag: function(params,content) {
				var myUrl;

				var options = {
					height : 315,
					width : 560,
					url : "#",
				};

				if(!params) {
					myUrl = content.replace(/<.*?>/g,"");
				} else {
					myUrl = params.substr(1).split(' ')[0];
				}

				paramsMisc.parse(params,function(key,val) {
					if(key == 'url') return;
					options[key] = val;
				});

				urlPattern.lastIndex = 0;
				if( !urlPattern.test( myUrl ) ) {
					myUrl = "#";
				}

				options.url = urlMisc.youtube2embed(myUrl);

				var h = parseInt(options.height,10);
				if(h > 700 || isNaN(h)==true) options.height = 315;
				var w = parseInt(options.width,10);
				if(w > 1000 || isNaN(h)==true) options.width = 560;

				return '<iframe width="'+options.width+'" height="'+options.height+'" src="'+options.url+'?html5=1'+'" frameborder="0" allowfullscreen>';
			},
			closeTag: function(params,content) {
				return '</iframe>';
			},
			displayContent: false
		},
		"pre": {
			openTag: function(params,context) {
				return "<pre>";
			},
			closeTag: function(params,context) {
				return "</pre>";
			},
		},
		"left": {
			openTag: function(params,context) {
				return '<div class="xbbcode-left">';
			},
			closeTag: function(params,context) {
				return '</div>';
			},
		},
		"center": {
			openTag: function(params,context) {
				return '<div class="xbbcode-center" align="center">';
			},
			closeTag: function(params,context) {
				return '</div>';
			},
		},
		"right": {
			openTag: function(params,context) {
				return '<div class="xbbcode-right">';
			},
			closeTag: function(params,context) {
				return '</div>';
			},
		},
        /*
            The [*] tag is special since the user does not define a closing [/*] tag when writing their bbcode.
            Instead this module parses the code and adds the closing [/*] tag in for them. None of the tags you
            add will act like this and this tag is an exception to the others.
        */
        "*": {
            openTag: function(params,content) {
                return "<li>";
            },
            closeTag: function(params,content) {
                return "</li>";
            },
            restrictParentsTo: ["list"]
        }
    };
    
    // create tag list and lookup fields
    tagList = [];
    (function() {
        var prop,
            ii,
            len;
        for (prop in tags) {

			if(typeof tags[prop] === 'string') {
				/* If this tag's data is a 'string', then we consider it a link to another tag.. This is somewhat of an alias */
				var real_tag = tags[prop];
				tags[prop] = tags[real_tag];
			}

            if (tags.hasOwnProperty(prop)) {
                if (prop === "*") {
                    tagList.push("\\" + prop);
                } else {
                    tagList.push(prop);
                    if ( tags[prop].noParse ) {
                        tagsNoParseList.push(prop);
                    }
                }
                
                tags[prop].validChildLookup = {};
                tags[prop].validParentLookup = {};
                tags[prop].restrictParentsTo = tags[prop].restrictParentsTo || [];
                tags[prop].restrictChildrenTo = tags[prop].restrictChildrenTo || [];
                
                len = tags[prop].restrictChildrenTo.length;
                for (ii = 0; ii < len; ii++) {
                    tags[prop].validChildLookup[ tags[prop].restrictChildrenTo[ii] ] = true;
                }
                len = tags[prop].restrictParentsTo.length;
                for (ii = 0; ii < len; ii++) {
                    tags[prop].validParentLookup[ tags[prop].restrictParentsTo[ii] ] = true;
                }
            }
        }
    })();
    
    bbRegExp = new RegExp("<bbcl=([0-9]+) (" + tagList.join("|") + ")([ =][^>]*?)?>((?:.|[\\r\\n])*?)<bbcl=\\1 /\\2>", "gi"); 
    pbbRegExp = new RegExp("\\[(" + tagList.join("|") + ")([ =][^\\]]*?)?\\]([^\\[]*?)\\[/\\1\\]", "gi"); 
    pbbRegExp2 = new RegExp("\\[(" + tagsNoParseList.join("|") + ")([ =][^\\]]*?)?\\]([\\s\\S]*?)\\[/\\1\\]", "gi");    

    // create the regex for escaping ['s that aren't apart of tags
    (function() {
        var closeTagList = [];
        for (var ii = 0; ii < tagList.length; ii++) {
            if ( tagList[ii] !== "\\*" ) { // the * tag doesn't have an offical closing tag
                closeTagList.push ( "/" + tagList[ii] );
            }
        }

        openTags = new RegExp("(\\[)((?:" + tagList.join("|") + ")(?:[ =][^\\]]*?)?)(\\])", "gi"); 
        closeTags = new RegExp("(\\[)(" + closeTagList.join("|") + ")(\\])", "gi"); 
    })();
    
    // -----------------------------------------------------------------------------
    // private functions
    // -----------------------------------------------------------------------------

	var urlMisc = {
		parseUrl : function( _url ) {
			var parsed_url = url.parse(_url);
			parsed_url.querystring = querystring.parse(parsed_url.query);
			return parsed_url;
		},
		youtube2embed : function(url) {
			var parsed_url = urlMisc.parseUrl(url);
			if(parsed_url.pathname == null) return "#";
			if(parsed_url.pathname.indexOf("/embed") == 0) return url;
			return parsed_url.protocol + '//' + parsed_url.host + (parsed_url.port == null ? '' : ':'+parsed_url.port) + '/embed/' + parsed_url.querystring.v;
		},
	};

	var paramsMisc = {
		parse : function(params, cb) {
			if(!params) return;

			var re_str = /(.*?)=(.*)/
			var tokens;
			tokens = params.split(' ');

			if(tokens.length > 1) {  
				var re = RegExp(re_str)
				for(var v in tokens) {
					var token = tokens[v];
					try {
						var res = re.exec(token);
						if(res.length > 2)
//							options[res[1]] = res[2];
							cb(res[1],res[2]);
					} catch(err) {
						continue;
					}
				}
			}
		}
	};
    
    function checkParentChildRestrictions(parentTag, bbcode, bbcodeLevel, tagName, tagParams, tagContents, errQueue) {
        
        errQueue = errQueue || [];
        bbcodeLevel++;
        
        // get a list of all of the child tags to this tag
        var reTagNames = new RegExp("(<bbcl=" + bbcodeLevel + " )(" + tagList.join("|") + ")([ =>])","gi"),
            reTagNamesParts = new RegExp("(<bbcl=" + bbcodeLevel + " )(" + tagList.join("|") + ")([ =>])","i"),
            matchingTags = tagContents.match(reTagNames) || [],
            cInfo,
            errStr,
            ii,
            childTag,
            pInfo = tags[parentTag] || {};
        
        reTagNames.lastIndex = 0;
        
        if (!matchingTags) {
            tagContents = "";
        }
        
        for (ii = 0; ii < matchingTags.length; ii++) {
            reTagNamesParts.lastIndex = 0;
            childTag = (matchingTags[ii].match(reTagNamesParts))[2].toLowerCase();
            
            if ( pInfo.restrictChildrenTo.length > 0 ) {
                if ( !pInfo.validChildLookup[childTag] ) {
                    errStr = "The tag \"" + childTag + "\" is not allowed as a child of the tag \"" + parentTag + "\".";
                    errQueue.push(errStr);
                }
            }
            cInfo = tags[childTag] || {};
            if ( cInfo.restrictParentsTo.length > 0 ) {
                if ( !cInfo.validParentLookup[parentTag] ) {
                    errStr = "The tag \"" + parentTag + "\" is not allowed as a parent of the tag \"" + childTag + "\".";
                    errQueue.push(errStr);
                }
            }
            
        }
        
        tagContents = tagContents.replace(bbRegExp, function(matchStr, bbcodeLevel, tagName, tagParams, tagContents ) {
            errQueue = checkParentChildRestrictions(tagName, matchStr, bbcodeLevel, tagName, tagParams, tagContents, errQueue);
            return matchStr;
        });
        return errQueue;
    }
    
    /*
        This function updates or adds a piece of metadata to each tag called "bbcl" which 
        indicates how deeply nested a particular tag was in the bbcode. This property is removed
        from the HTML code tags at the end of the processing.
    */
    function updateTagDepths(tagContents) {
        tagContents = tagContents.replace(/\<([^\>][^\>]*?)\>/gi, function(matchStr, subMatchStr) {
            var bbCodeLevel = subMatchStr.match(/^bbcl=([0-9]+) /);
            if (bbCodeLevel === null) {
                return "<bbcl=0 " + subMatchStr + ">";
            } else {
                return "<" + subMatchStr.replace(/^(bbcl=)([0-9]+)/, function(matchStr, m1, m2) {
                    return m1 + (parseInt(m2, 10) + 1);
                }) + ">";
            }
        });
        return tagContents;
    }
    
    /*
        This function removes the metadata added by the updateTagDepths function
    */
    function unprocess(tagContent) {
        return tagContent.replace(/<bbcl=[0-9]+ \/\*>/gi,"").replace(/<bbcl=[0-9]+ /gi,"&#91;").replace(/>/gi,"&#93;");
    }
    
    var replaceFunct = function(matchStr, bbcodeLevel, tagName, tagParams, tagContents) {
    
        tagName = tagName.toLowerCase();

        var processedContent = tags[tagName].noParse ? unprocess(tagContents) : tagContents.replace(bbRegExp, replaceFunct),
            openTag = tags[tagName].openTag(tagParams,processedContent),
            closeTag = tags[tagName].closeTag(tagParams,processedContent);
            
        if ( tags[tagName].displayContent === false) {
            processedContent = "";
        }
		if ( tags[tagName].removeCRLF == true) {
			processedContent = processedContent.replace(/(\r|\n)/g,'');
		}
        
        return openTag + processedContent + closeTag;
    };

    function parse(config) {
        var output = config.text;
        output = output.replace(bbRegExp, replaceFunct);
        return output;
    }
    
    /*
        The star tag [*] is special in that it does not use a closing tag. Since this parser requires that tags to have a closing
        tag, we must pre-process the input and add in closing tags [/*] for the star tag.
        We have a little levaridge in that we know the text we're processing wont contain the <> characters (they have been
        changed into their HTML entity form to prevent XSS and code injection), so we can use those characters as markers to
        help us define boundaries and figure out where to place the [/*] tags.
    */
    function fixStarTag(text) {
        text = text.replace(/\[(?!\*[ =\]]|list([ =][^\]]*)?\]|\/list[\]])/ig, "<");
        text = text.replace(/\[(?=list([ =][^\]]*)?\]|\/list[\]])/ig, ">");

        while (text !== (text = text.replace(/>list([ =][^\]]*)?\]([^>]*?)(>\/list])/gi, function(matchStr,contents,endTag) {
            
            var innerListTxt = matchStr;
            while (innerListTxt !== (innerListTxt = innerListTxt.replace(/\[\*\]([^\[]*?)(\[\*\]|>\/list])/i, function(matchStr,contents,endTag) {
                if (endTag === ">/list]") {
                    endTag = "</*]</list]";
                } else {
                    endTag = "</*][*]";
                }
                var tmp = "<*]" + contents + endTag;
                return tmp;
            })));
            
            innerListTxt = innerListTxt.replace(/>/g, "<");            
            return innerListTxt;
        })));
        
        // add ['s for our tags back in
        text = text.replace(/</g, "[");
        return text;
    };
    
    function addBbcodeLevels(text) {
        while ( text !== (text = text.replace(pbbRegExp, function(matchStr, tagName, tagParams, tagContents) {
            matchStr = matchStr.replace(/\[/g, "<");
            matchStr = matchStr.replace(/\]/g, ">");
            return updateTagDepths(matchStr);
        })) );
        return text;
    }
    
    // -----------------------------------------------------------------------------
    // public functions
    // -----------------------------------------------------------------------------
    
    me.process = function(config) {
    
        var ret = {html: "", error: false},
            errQueue = [];

        config.text = config.text.replace(/</g, "&lt;"); // escape HTML tag brackets
        config.text = config.text.replace(/>/g, "&gt;"); // escape HTML tag brackets
        
        config.text = config.text.replace(openTags, function(matchStr, openB, contents, closeB) {
            return "<" + contents + ">";
        });
        config.text = config.text.replace(closeTags, function(matchStr, openB, contents, closeB) {
            return "<" + contents + ">";
        });
        
        config.text = config.text.replace(/\[/g, "&#91;"); // escape ['s that aren't apart of tags
        config.text = config.text.replace(/\]/g, "&#93;"); // escape ['s that aren't apart of tags
        config.text = config.text.replace(/</g, "["); // escape ['s that aren't apart of tags
        config.text = config.text.replace(/>/g, "]"); // escape ['s that aren't apart of tags

        // process tags that don't have their content parsed
        while ( config.text !== (config.text = config.text.replace(pbbRegExp2, function(matchStr, tagName, tagParams, tagContents) {
            tagContents = tagContents.replace(/\[/g, "&#91;");
            tagContents = tagContents.replace(/\]/g, "&#93;");
            tagParams = tagParams || "";
            tagContents = tagContents || "";
            return "[" + tagName + tagParams + "]" + tagContents + "[/" + tagName + "]";
        })) );

/*
		I don't care about [*] right now.
        config.text = fixStarTag(config.text); // add in closing tags for the [*] tag
*/
        config.text = addBbcodeLevels(config.text); // add in level metadata

        errQueue = checkParentChildRestrictions("bbcode", config.text, -1, "", "", config.text);
        
        ret.html = parse(config);

        if ( ret.html.indexOf("[") !== -1 || ret.html.indexOf("]") !== -1) {
            errQueue.push("Some tags appear to be misaligned.");
        }
    
        if (config.removeMisalignedTags) {
            ret.html = ret.html.replace(/\[.*?\]/g,"");
        }
    
        ret.html = ret.html.replace("&#91;", "["); // put ['s back in
        ret.html = ret.html.replace("&#93;", "]"); // put ['s back in
        
        ret.error = (errQueue.length === 0) ? false : true;
        ret.errorQueue = errQueue;
        
		if(config.replaceNewlinesWithBR != false) {
			ret.html = ret.html.replace(/\r\n/g, "\n");
			ret.html = ret.html.replace(/(\r|\n)/g, "<br/>"); // turn newlines into br
		}

		if(config.cb) 
			return config.cb(ret);
		else
        	return ret;
    }
    
    return me;
})();

module.exports = XBBCODE;
