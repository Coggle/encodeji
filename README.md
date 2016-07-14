# encodeji
Encode emoji short names as unicode codepoints `:smile:` -> 😀

## Installation

`bower install -S encodeji`

## API

Encodeji is distributed as a requirejs module, in `dist/ecodeji.js` (compiled
from source in `lib/encodeji.js`).


### Creating an instance
```js
// require the module:
var Encodeji = require('encodeji');

// create a new instance, you could pass options here (see Advanced Use below)
var encodeji = new Encodeji();
```

### Replacing :emoji-names: with Codepoints

Both string replacement and replacement of text in the DOM is supported:
```js
// replace in a string:
var encoded = encodeji.replaceColons("my string with :smile: emoji :+1::skin-tone-3:");
console.log("encoded");

// replace in the whole document:
encodeji.replaceColons(document.body);

// or replace only in part of it:
encodeji.replaceColons(document.getElementById("someid"));
```

Unknown names will remain in the document, only primary names will be replaced.


### Getting the Primary Emoji Name From an Alternative
When saving data with :emoji-names: it's a good idea to save only the primary
name by which emoji are known, but you might want to allow people to input
other names which are automatically converted to the primary name.

To get the primary name for an alternative name, use:
```
var primary_name = encodeji.primaryShortName("thumbsup");
console.log(primary_name); // +1
```

### Getting possible auto-completions
Get the emoji names which might match partial user input (useful for
auto-completion):

```
var complations = encodeji.possibleShortNames("person");
console.log(completions);
```


## Advanced Use
It's possible to pass options to the constructor to extend the built-in data
with your own data, to replace or add the name by which emoji are known. For
example:

```js
var encodeji = new Encodeji({
    extendData: [
       { name:"PILE OF POO", short_name:"poop" }
    ]
});
```

The data format used is:
```json
[ {
    "name": "THUMBS UP SIGN",
    "unified": "1F44D",
    "short_name": "+1",
    "short_names": [
        "+1",
        "thumbsup"
    ]
}, ... ]
```

When specifying `extendData` either "name" (the official unicode name) or
"unified" (the codepoint) must be supplied for each item, to match it against
existing items.

