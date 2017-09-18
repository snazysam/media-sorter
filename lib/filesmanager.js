// Files library
// Handles all things related to files
//  - Searching for titles
//  - Determining related files
//  - Copying, moving and renaming files

import readlineSync from 'readline-sync';
import sanitize from 'sanitize-filename';
import glob from 'globule';
import mkdirp from 'mkdirp';
import path from 'path';
import fs from 'fs';


import Logger from './logger.js';

const log = new Logger( '::files' );



const vidFiles = [ "avi","mpg","mpe","mpeg-1","mpeg-2","m4v","mkv","mov","mp4","mpeg","ogm","wmv","divx","ts" ];
const subFiles = [ "ssa", "srt", "sub", "idx" ];
const imgFiles = [ "jpg", "jpeg", "tbn", "png" ];

const excludeDirs = [ /sample/i ];
const excludeFiles = [ /sample\./i ];



// Define which tags require padding
const padTags = {
  'episode_number': true,
  'season_number': true
};


// Format keys for images by image type
const imgFormatKeys = {
  'show-backdrop':  "tv-show-fanart-format",
  'show-poster':    "tv-poster-format",
  'season-poster':  "tv-season-poster-format",
  'episode-still':  "tv-still-format",
  'movie-backdrop': "movie-fanart-format",
  'movie-poster':   "movie-poster-format" 
};


// Map actions to functions
const operationFuncs = {
  'copy':       fs.copyFileSync,
  'move':       fs.renameSync,
  'symlink':    fs.symlinkSync,
  'link':       fs.linkSync,
  'revlink':    fs.linkSync
};



class FilesManager {

  constructor( config ) {
    this.config = config;
  }


  /**
   * Find all titles to sort in a given path
   * @param {String} fileOrPath - The path to search
   * @returns {Object[]} - List of titles found
   */
  findTitles( fileOrPath ) {

    var titles = [];

    // Trim any trailing separator
    if ( fileOrPath.endsWith( "/" ) )
      fileOrPath = fileOrPath.substring( 0, fileOrPath.length - 1 );

    var pathStat = fs.statSync( fileOrPath );

    // If a directory, recursively check
    if ( pathStat.isDirectory() ) { 

      log.silly( "Selecting titles in directory", fileOrPath );

      // Search diretories for videos
      var paths = fs.readdirSync( fileOrPath );
      titles = paths.reduce( (arr, pth) => {

        // Exclusion checking
        if ( excludeDirs.some( (reg) => {
          return pth.match( reg );
        } ) ) {
          // Excluded file
          return arr;
        }

        // Check recursively
        var more = this.findTitles( fileOrPath + "/" + pth );
        if ( more != undefined )
          arr = arr.concat( more );
        return arr;
      }, [] );
    }
    else if ( pathStat.isFile() ) {

      log.silly( "Inspecting file", fileOrPath );

      // Take the extension
      var ext = path.extname( fileOrPath );
      var name = path.basename( fileOrPath, ext ); 
      ext = ext.replace( ".", "" );

      // Exclusion checking
      if ( excludeFiles.some( (reg) => {
        return name.match( reg );
      } ) ) {
        // Excluded file
        return;
      }

      // Only interested in videos
      if ( vidFiles.includes( ext ) ) {

        log.debug( "Choosing file", fileOrPath );

        titles.push( {
          "dir": path.dirname( fileOrPath ),
          "full": fileOrPath,
          "name": name,
          "type": "video",
          "ext": ext,
          "subs": [],
          "images": [],
          "meta": {}
        } );
      }
    }
    else {
      log.warn( "Unknown path type", fileOrPath );
      throw new Error( "Unknown path type to sort" );
    }

    // Now we have titles. Determine sorting strategies.
    // An easy way to find ancestors is to sort titles by directory
    titles.sort( (a,b) => a.dir.localeCompare( b.dir ) );

    // Figure out location type, impacting the search for subs
    titles.forEach( (title, idx, list ) => {
      var next = list[idx + 1] || undefined;
      var prev = list[idx - 1] || undefined;

      if ( ( next && next.dir.includes( title.dir ) ) || ( prev && prev.dir.includes( title.dir ) ) )
        title["strategy"] = "mixed";
      else if ( titles.length == 1 && pathStat.isFile() )
        title["strategy"] = "mixed";
      else
        title["strategy"] = "alone";
    } );

    return titles;

  }


  /**
   * Locate subtitles for provided titles
   * @param {Object[]} titles - Titles for sorting
   */
  locateSubs( titles ) {

    titles.forEach( (title) => {

      log.debug( "Checking subtitles for title", title.name );

      var patterns = [];
      var opts = { nosort: true, realpath: true };

      // Build a list of search patterns applicable to the title
      subFiles.forEach( (subext) => {
        patterns.push( title.dir + "/" + title.name + "*." + subext );
      } );

      if ( title.strategy == "alone" ) {
        subFiles.forEach( (subext) => {
          patterns.push( title.dir + "/**/" + title.name + "*." + subext );
        } );

        subFiles.forEach( (subext) => {
          patterns.push( title.dir + "/**/*." + subext );
        } );   
      }

      var found = glob.find( patterns );

      if ( found.length ) {
        log.debug( "Subtitles found", found );
        found.forEach( (subfile) => {

          var ext = path.extname( subfile );
          var name = path.basename( subfile, ext );
          ext = ext.replace( ".", "" );

          // Check that it actually exists
          if ( ! fs.existsSync( subfile ) ) {
            log.silly( "Ignoring subtitle file which doesn't exist", sub );
            return;
          }

          title.subs.push( {
            "dir": path.dirname( subfile ),
            "name": name,
            "ext": ext,
            "full": subfile,
            "type": "sub"
          } );
        } );
      }
    } );
  }



  /**
   * Check if an image exists
   * @param {Object} title - The title
   * @param {String} type - The type of image (not format)
   */
  imageExists( title, type ) {
    var format = this.config.get( imgFormatKeys[ type ] );
    var dest = this.config.get( 'target' );
    var testpath = dest + "/" + this.getTarget( title, format ) + ".";

    log.silly( "Checking for existing image in", path.dirname( testpath ) );

    var found = glob.find( [ "jpg", "png", "bmp" ].map( (ext) => { return testpath + ext } ) );
    if ( found.length ) {
      log.silly( "Found existing image", found[0] );
      return true;
    }
    log.silly( "No existing image found" );
    return false;

  }


  /**
   * Get the target filename
   * @param {Object} title - The title
   * @param {String} format - The format mask for the image
   * @returns {String} dest - Destination filename
   */
  getTarget( title, format ) {
    var dest, bits = [];

    log.silly( "Building target filename for title", title, "format", format );

    if ( ! format || ! format.match( /#/ ) ) {
      log.error( "Bad format, cannot construct target" );
      return;
    }

    // Split on any tags
    bits = format.split( /(#[a-z_]+?#)/ );
    bits.forEach( (bit, idx) => {
      // If this piece is a tag...
      if ( bit.startsWith( '#' ) && bit.endsWith( '#' ) ) {
        var tagconf;
        var tag = bit.substring( 1, bit.length - 1 );

        // If something is missing, just throw
        if ( ! title["meta"].hasOwnProperty( tag ) )
          throw new Error( "Missing metadata for tag: " + tag );

        // Some tags require padding...
        if ( padTags.hasOwnProperty( tag ) && padTags[tag] )
          bits[idx] = this.padZero( title["meta"][tag] );
        else
          bits[idx] = this.fixFilename( title["meta"][tag] );
      }
    } );

    // Build path. 
    dest = bits.join( "" );

    return dest;

  }


  /**
   * Perform a file based action
   * @param {String} action - Type of action
   * @param {Object} title - The title
   * @throws if any error while performing action
   */
  fileAction( action, title ) {

    var dest = this.config.get( 'target' );
    var dryrun = this.config.get( 'dryrun' );
    var replace = this.config.get( 'replace' );

    // Figure out target paths for all content. Note, this function throws.
    try {
      this.fileTargets( title );
    }
    catch( e ) {
      log.error( "Error in constructing destination paths", e );
      throw e;
    }

    // Clean up path
    dest = path.resolve( dest );

    // Now we have a title, we know where it's coming from, and where it's going.
    // We know strategy (move/link/copy)... 
    log.info( "Sorting title", title.name, "to", dest + "/" + title.dest, "(" + action.toUpperCase() + ", DRYRUN=" + dryrun + ",REPLACE=" + replace + ")" );

    try { 
      if ( this.config.get( 'interactive' ) ) {
        console.log( "Sorting via " + action + " from " + title.full + " to " + dest + "/" + title.dest );

        // Prompt
        if ( readlineSync.keyInYN() === false ) {
          log.info( "Not sorting title as per user request" );
          return;
        }
      }

      // Title first
      log.debug( "Sorting video " + title.full + " to " + dest + "/" + title.dest );
      dryrun || this.fileOperation( action, title.full, dest + "/" + title.dest, replace );

      // Subs
      title["subs"].forEach( (sub) => {
        log.debug( "Sorting subtitle " + sub.full + " to " + dest + "/" + sub.dest );
        dryrun || this.fileOperation( action, sub.full, dest + "/" + sub.dest, replace );
      } );

      // Images ( always moved as downloaded )
      title["images"].forEach( (image) => {
        log.debug( "Moving image " + image.full + " to " + dest + "/" + image.dest );
        dryrun || this.fileOperation( "move", image.full, dest + "/" + image.dest, replace );
      } );

      log.info( "Sorted title", title.name, "to", dest );
    }
    catch(e) {
      log.error( "Error processing title", e );
      throw e;
    }
  }


  /**
   * Figure out filename targets
   * @param {Object} title - The title
   */
  fileTargets( title ) {

    var mainpath = this.config.get( "target" );
    var type = title.mediatype;
    var format, target, bits;

    log.debug( "Building target filenames for title", title.name );

    // Images first
    if ( title.images ) {  
      title.images.forEach( (image) => {
        format = this.config.get( imgFormatKeys[image.type] );
        image["dest"] = this.getTarget( title, format ) + "." + image.ext;
      } );
    }

    // Subs
    if ( title.subs ) {
      title.subs.forEach( (sub) => {
        format = this.config.get( type + '-sub-format' );
        sub["dest"] = this.getTarget( title, format ) + "." + sub.ext;
      } );
    }

    // Now the title
    if ( title.mediatype == "tv" )
      format = this.config.get( 'tv-format' );
    else if ( title.mediatype == "movie" )
      format = this.config.get( 'movie-format' );
    else
      throw new Error( "Unknown media type", title.mediatype );

    title["dest"] = this.getTarget( title, format ) + "." + title.ext;
  }



  /**
   * Perform a file operation
   * @param {String} action - The action to perform
   * @param {String} source - Full qualified source filename
   * @param {String} dest - The qualified destination filename
   * @param {Boolean} replace - If the destination should be replaced if existing
   */
  fileOperation( action, source, dest, replace ) {
    var opfunc = operationFuncs[ action ];
    var exists = false;

    // TODO: Asyncify this

    // Create directory as needed
    if ( ! fs.existsSync( path.dirname( dest ) ) ) {
      log.silly( "Creating directory", path.dirname( dest ) );
      mkdirp.sync( path.dirname( dest ) );
    }

    // Do the thing
    exists = fs.existsSync( dest );
    if ( exists && ! replace ) {
      log.silly( "Destination", dest, "exists, not replacing" );
    }
    // Fix shit when rtorrent goes fucky
    else if ( action == "revlink" ) {
      log.warn( "Caution: Reverse linking from", dest, "to", source );
      if ( exists )
        fs.unlinkSync( source )
      opfunc( dest, source );
    }
    else if ( exists && replace ) {
      log.silly( "Destination exists, removing", dest );
      // Delete the target first
      fs.unlinkSync( dest );
      log.silly( "Performing", action, "from", source, "to", dest );
      opfunc( source, dest );
    }
    else if ( ! exists ) {
      log.silly( "Performing", action, "from", source, "to", dest );
      opfunc( source, dest );
    }
  }




  /** 
   * Clean up a filename
   * @param {String} piece - The filename segment to clean
   */
  fixFilename( piece ) { 
    // Ensure piece is a string
    piece = piece + "";

    // Fix sanitise
    piece = sanitize( piece, { replacement: " " } );

    // Then remove other bit
    piece = piece.replace( /[\!\(\)\[\]]/g, "" );
    piece = piece.replace( /\s\s/g, " " );

    return piece;
  }


  /**
   * Pad a string with a zero if needed
   * @param {String} val - The value to pad
   * @returns {String} - The padded string
   */
  padZero( val ) {
    if ( val.toString().length < 2 )
      val = "0" + val;
    return val;
  };
}

export default FilesManager;



