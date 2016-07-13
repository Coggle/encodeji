// encodeji: encode :simple-names: for emoji as unicode codepoints.
// Copyright 2016 Coggle, Licensed under ISC
// Portions from Twemoji: MIT licensed Copyright Twitter Inc. and other contributors.
"use strict";

define('encodeji', function(){

    // data from emoji-data-minimal bower component, reduced to the subset we
    // need. Format: [ {
    //     "name": "THUMBS UP SIGN",
    //     "unified": "1F44D",
    //     "short_name": "+1",
    //     "short_names": [
    //         "+1",
    //         "thumbsup"
    //     ],
    //     "text": null,
    //     "texts": null,
    //     "category": "People",
    //     "sort_order": 91,
    //     "skin_variations": true
    // }, ... ]
    var data = EMOJI_DATA_JSON; // eslint-disable-line

    /**
     * (grabAllTextNodesfrom Twemoji)
     * Given a generic DOM nodeType 1, walk through all children
     * and store every nodeType 3 (#text) found in the tree.
     * @param   Element a DOM Element with probably some text in it
     * @param   Array the list of previously discovered text nodes
     * @return  Array same list with new discovered nodes, if any
     */
    function grabAllTextNodes(node, allText) {
      var shouldntBeParsed = /IFRAME|NOFRAMES|NOSCRIPT|SCRIPT|SELECT|STYLE|TEXTAREA|[a-z]/,
        childNodes = node.childNodes,
        length = childNodes.length,
        subnode,
        nodeType;
      while (length--) {
        subnode = childNodes[length];
        nodeType = subnode.nodeType;
        // parse emoji only in text nodes
        if (nodeType === 3) {
          // collect them to process emoji later
          allText.push(subnode);
        }
        // ignore all nodes that are not type 1 or that
        // should not be parsed as script, style, and others
        else if (nodeType === 1 && !shouldntBeParsed.test(subnode.nodeName)) {
          grabAllTextNodes(subnode, allText);
        }
      }
      return allText;
    }

    function Encodeji(options){
        var self = this;
        this.data = data.slice();
        if(options && options.extendData){
            options.extendData.forEach(function(d){
                var exists = self.data.find(function(v){
                    return (d.name && d.name == v.name) || (d.unified && d.unified == v.unified);
                });
                if(exists){
                    for(var prop in d){
                        if(d.hasOwnProperty(prop)){
                            if(prop == 'short_names'){
                                exists.short_names = exists.short_names.concat(d.short_names);
                            }else{
                                exists[prop] = d[prop];
                            }
                        }
                    }
                }else{
                    self.data.push(d);
                }
            });
        }
        this.buildShortNameIndex();
    }

    // if you modify .data (e.g. to add new short names), call this to re-build
    // the name->id mapping used for replacement
    Encodeji.prototype.buildShortNameIndex = function(){
        var dataByShortName = {};
        var allShortNames = [];
        var checkForDuplicateShortName = function(name, obj){
            /*eslint-disable no-undef */
            if(dataByShortName.hasOwnProperty(name) && console && console.error){
                console.error('duplicate short name "'+ name +'" from', obj, 'first seen in:', dataByShortName[name]);
            }
            /*eslint-enable: no-undef */
        };
        this.data.forEach(function(d){
            checkForDuplicateShortName(d.short_name, d);
            dataByShortName[d.short_name] = d;
            allShortNames.push(d.short_name);
            if(d.short_names && d.short_names.length){
                d.short_names.forEach(function(n){
                    // don't add duplicates between .short_name and
                    // .short_names:
                    if(n !== d.short_name){
                        checkForDuplicateShortName(n, d);
                        dataByShortName[n] = d;
                    }
                });
                allShortNames.concat(d.short_names);
            }
        });
        this.dataByShortName = dataByShortName;
        this.allShortNames = allShortNames;
    };

    Encodeji.prototype.toUCS2 = function(hex_codepoint){
        // !!! TODO: encode hex_codepoint as UCS2 (possibly using surrogate
        // pair)
        //
        // From Unicode spec:
        // "A code point C greater than 0xFFFF corresponds to a surrogate pair <H, L> as per the following formula:"
        // H = Math.floor((C - 0x10000) / 0x400) + 0xD800
        // L = (C - 0x10000) % 0x400 + 0xDC00

        var C = parseInt('0x' + hex_codepoint);
        if(C > 0xffff){
            H = Math.floor((C - 0x10000) / 0x400) + 0xD800;
            L = (C - 0x10000) % 0x400 + 0xDC00;
            return String.fromCharCode(H) + String.fromCharCode(L);
        }else{
            return String.fromCharCode(C);
        }
    };

    Encodeji.prototype.encodeShortName = function(id, relaxed){
        // unless 'relaxed' is specified only the .short_name of each emoji will
        // be replaced, not any of the other values in the .short_names array.
        // The name is always converted to lower case before matching.
        id = id.toLowerCase();
        if(this.dataByShortName.hasOwnProperty(id)){
            if(this.dataByShortName[id].short_name == id || relaxed){
                return this.toUCS2(this.dataByShortName[id].unified);
            }
        }
        return id;
    };

    Encodeji.prototype._replaceColonsStr = function(str){
        // note: skin tone variations are supported through subsequent
        // :emoji-name::skin-tone-name:, which will be converted into the
        // corresponding two code points one after each other. Systems that
        // support variations will show a combined glyph for the two code
        // points, systems that don't will show two separate glyphs (the
        // fallback allowed in the unicode spec).
        var next = 0;
        var replace = /^:([^ :]+):/;
        var out = '';
        var capture;
        var encoded;
        while(str.length){
            next = str.indexOf(':');
            if(next >= 0){
                out += str.substring(0, next);
                str = str.substring(next);
                capture = replace.exec(str);
                if(capture){
                    // if the regex matched, then encodeShortName (returns the
                    // original if the short name is unknown):
                    encoded = this.encodeShortName(capture[1]);
                    if(encoded != capture[1]){
                        out += encoded;
                    }else{
                        out += capture[0];
                    }
                    str = str.substring(capture[0].length)
                }else{
                    // if the regex didn't match, consume one colon then
                    // continue...
                    out += str.substring(0, 1);
                    str = str.substring(1);
                }
            }else{
                out += str;
                break;
            }
        }
        return out;
    };

    Encodeji.prototype._replaceColonsNode = function(node){
        var allText = grabAllTextNodes(node, []);
        var self = this;
        allText.forEach(function(subnode){
            var fragment = document.createDocumentFragment();
            var text = subnode.nodeValue;
            fragment.appendChild(document.createTextNode(self._replaceColonsStr(text)));
            subnode.parentNode.replaceChild(fragment, subnode);
        });
    };

    // replace :short_names: in either a string or dom tree
    Encodeji.prototype.replaceColons = function(str_or_dom_node){
        if(typeof str_or_dom_node === 'string'){
            return this._replaceColonsStr(str_or_dom_node);
        }else{
            return this._replaceColonsNode(str_or_dom_node);
        }
    };

    Encodeji.prototype.primaryShortName = function(id){
        // return the 'official' short name for the short name specified.
        // The name is always converted to lower case before matching.
        // Returns null if the name provided is not known
        id = id.toLowerCase();
        if(this.dataByShortName.hasOwnProperty(id)){
            this.dataByShortName[id].short_name;
        }else{
            return null;
        }
    };

    Encodeji.prototype.possibleShortNames = function(including){
        var match = new RegExp(including, 'i');
        return this.allShortNames.filter(function(v){
            return match.exec(v);
        });
    };

    return Encodeji;
});
