// encodeji: encode :simple-names: for emoji as unicode codepoints.
// Copyright 2016 Coggle, Licensed under ISC
// Portions from Twemoji: MIT licensed Copyright Twitter Inc. and other contributors.
"use strict";

define('encodeji', function(){

    // data from emoji-data-minimal bower component, reduced to the subset we
    // need. Format (after unpacking): [ {
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
    var data = unpackOnFirstUse(EMOJI_DATA_JSON); // eslint-disable-line

    function unpackOnFirstUse(arr){
        var unpacked = false;
        return function(){
            if(unpacked) return arr;
            unpacked = true;
            for(var i = 0; i < arr.length; i++){
                if(arr[i].length !== 9) console.log("pack error:", i, arr[i]);
                var fields = ['name', 'unified', 'short_name', 'short_names', 'category', 'sort_order', 'skin_variations', 'text', 'texts'];
                var r = {};
                for(var j = 0; j < fields.length; j++){
                    r[fields[j]] = arr[i][j];
                }
                arr[i] = r;
            }
            return arr;
        }
    }

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

    function toUCS2(hex_codepoint){
        // From Unicode spec:
        // "A code point C greater than 0xFFFF corresponds to a surrogate pair <H, L> as per the following formula:"
        // H = Math.floor((C - 0x10000) / 0x400) + 0xD800
        // L = (C - 0x10000) % 0x400 + 0xDC00
        var C = parseInt('0x' + hex_codepoint);
        if(C > 0xffff){
            var H = Math.floor((C - 0x10000) / 0x400) + 0xD800;
            var L = (C - 0x10000) % 0x400 + 0xDC00;
            return String.fromCharCode(H) + String.fromCharCode(L);
        }else{
            return String.fromCharCode(C);
        }
    }

    // encode codepoints described as "0123-4567-89AB-CDEF" etc into UCS2:
    function codepointsToUCS2(codepoints){
        return codepoints.split('-').map(toUCS2).join('');
    }

    function Encodeji(options){
        var self = this;
        this.data = data().slice();
        if(options && options.extendData){
            options.extendData.forEach(function(d){
                var exists = false;
                var v;
                for(var i = 0; i < self.data.length; i++){
                    v = self.data[i];
                    if((d.name && d.name == v.name) || (d.unified && d.unified == v.unified)){
                        exists = v;
                        break;
                    }
                }
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
        this._warn_duplicates = options && options.warnDuplicates;
        this.buildShortNameIndex();
    }

    // if you modify .data (e.g. to add new short names), call this to re-build
    // the name->id mapping used for replacement
    Encodeji.prototype.buildShortNameIndex = function(){
        var dataByShortName = {};
        var allShortNames = [];
        var checkForDuplicateShortName = function(warn_duplicates){
            return function(name, obj){
                if(dataByShortName.hasOwnProperty(name)){
                    if(warn_duplicates && console && console.warn){
                        console.warn('duplicate short name "'+ name +'" from', obj, 'first seen in:', dataByShortName[name]);
                    }
                    return true;
                }
            };
        }(this._warn_duplicates);
        this.data.forEach(function(d){
            // ignore duplicate names. :man-woman-boy: can be composed as
            // either the original 'family' codepoint 1F46A, or as the
            // combination 1F468-200D-1F469-200D-1F466.
            if(checkForDuplicateShortName(d.short_name, d)){
                return;
            }
            dataByShortName[d.short_name] = d;
            allShortNames.push(d.short_name);
            if(d.short_names && d.short_names.length){
                d.short_names.forEach(function(n){
                    // don't add duplicates between .short_name and
                    // .short_names:
                    if(n !== d.short_name){
                        checkForDuplicateShortName(n, d);
                        dataByShortName[n] = d;
                        allShortNames.push(n);
                    }
                });
            }
        });
        this.dataByShortName = dataByShortName;
        this.allShortNames = allShortNames;
    };

    Encodeji.prototype.codepoints = function(id, relaxed){
        // unless 'relaxed' is specified only the .short_name of each emoji will
        // be replaced, not any of the other values in the .short_names array.
        // The name is always converted to lower case before matching.
        id = id.toLowerCase();
        if(this.dataByShortName.hasOwnProperty(id) && (relaxed || this.dataByShortName[id].short_name === id)){
            return this.dataByShortName[id].unified;
        }else{
            return null;
        }
    };

    // NB: id must include ::skin-tone-x modifier, if any for example
    // female-scientist::skin-tone-6, rather than separately parsing the base
    // emoji and skin tone. This is because for emoji with both female/male
    // versions and skin tone modifiers, the skin tone modifier needs to be
    // encoded before the female/male sign and variation selector.
    //
    // e.g., :woman-juggling::skin-tone-1: becomes:
    //
    // juggle skintone  zwj  female-sign variant-selector-display-as-emoji
    // 1F939   1F3FB   200D      2640       FE0F
    //
    // (:woman-juggling: is just 1F939-200D-2640-FE0F)
    //
    Encodeji.prototype.encodeShortName = function(id, relaxed){
        var variation = /([^:]*)::(skin-tone-[2-6])/.exec(id);
        var codepoints;
        if(variation){
            var skintone_codepoint   = this.codepoints(variation[2], relaxed);
            var principle_codepoints = this.codepoints(variation[1], relaxed);
            if(skintone_codepoint){
                if(principle_codepoints){
                    var zwjed_parts = /(.*)-(200D-.*)/i.exec(principle_codepoints);
                    if(zwjed_parts){
                        return codepointsToUCS2(zwjed_parts[1] + '-' + skintone_codepoint + '-' + zwjed_parts[2]);
                    }else{
                        return codepointsToUCS2(principle_codepoints + '-' + skintone_codepoint);
                    }
                }
            }else if(principle_codepoints){
                return codepointsToUCS2(principle_codepoints)+ ':' + variation[2];
            }
        }else{
            codepoints = this.codepoints(id, relaxed);
            if(codepoints){
                return codepointsToUCS2(codepoints);
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
        var replace = /^:([^ :]+(::skin-tone-[2-6])?):/;
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
            var text = subnode.nodeValue;
            var replaced = self._replaceColonsStr(text);
            if(replaced !== text){
                var fragment = document.createDocumentFragment();
                fragment.appendChild(document.createTextNode(replaced));
                subnode.parentNode.replaceChild(fragment, subnode);
            }
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
            return this.dataByShortName[id].short_name;
        }else{
            var variation = /([^:]*)::(skin-tone-[2-6])/.exec(id);
            if(variation){
                var p = this.primaryShortName(variation[1]);
                if(p && this.dataByShortName.hasOwnProperty(p) && this.dataByShortName[p].skin_variations){
                    var v = this.primaryShortName(variation[2]);
                    if(p && v){
                        return p + '::' + v;
                    }
                }
            }
        }
        return null;
    };

    Encodeji.prototype.possibleShortNames = function(including){
        // escape any regex-special chars before using 'including' in regex:
        var match = new RegExp(including.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
        return this.allShortNames.filter(function(v){
            return match.exec(v);
        });
    };

    return Encodeji;
});
