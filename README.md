# Media-Sorter

Media-Sorter is an application to manage media files.


## Features!
 - Sorts TV Shows and Movies, and can detect content type
 - Support for multiple media library naming conventions
 - Fetches artwork as desired for TV episodes and Movies
 - Moves, copies, soft or hard links media between locations 
 - External subtitle file support


## Installation

```
npm install media-sorter
```

## Usage

This media-sorter was originally written to a command line application.

For use as a library, it's recommended to attempt sorting one title at a time, as there is no per-title error handling.

```
import MediaSorter from 'media-sorter';

const logPath = '/tmp/sort.log';
const options = {
  'config'  : '/tmp/sort.json',
  'path'    : '/path/to/sort',
  'target'  : '/destination/path'
};

const sorter = new MediaSorter( logPath, options );

try{ 
  await sorter.sortAll();
}
catch( e ) {
  // Handle errors
}
```



## CLI

For full usage information:

```
node -r esm main.js --help
```

Example usage:

```
node -r esm main.js --action move --path /path/to/sort --target /destination/path 
```


It is recommended to create configuration files for your needs as not all options are exposed via command line options. Examples are included.


Support
----

This software is likely full of bugs. Parts of it are completely untested, and other features may be unimplemented. Please feel free to contribute with pull requests.


License
----

ISC, refer to LICENSE.txt

