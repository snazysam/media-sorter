

import Logger from './logger.js';

import locatePath from 'locate-path';
import convict from 'convict';
import fs from 'fs';
import os from 'os';


const log = new Logger( '::config' );


const configDefs = {
  'dryrun': {
    default: false,
    doc: "Use dry run mode (no writes)",
    format: "Boolean",
    arg: "dry-run"
  },
  'config': {
    doc: "Configuration file",
    format: "String",
    default: '',
    arg: "config"
  },
  'loglevel': {
    doc: "Logging verbosity level",
    format: [ "error", "warn", "info", "debug", "silly" ],
    default: "silly",
    arg: "log"
  },
  'action': { 
    doc: "Processing action",
    format: [ "move", "link", "symlink", "copy", "artwork", "revlink" ],
    default: null,
    arg: "action"
  },
  'cachefile': {
    doc: "TMDB cache file",
    format: "String",
    default: '',
    arg: 'cachefile'
  },
  'mediatype': {
    doc: "Media type used for looking up information and posters",
    format: [ "auto", "tv", "movie" ],
    default: 'auto',
    arg: "mediatype"
  },
  'lookup': {
    doc: "Enable media lookup from TMDB",
    format: "Boolean",
    default: true,
    arg: "lookup"
  },
  'key': {
    doc: "TMDB API Key",
    format: "String",
    default: '',
    arg: "key"
  },
  'nocache': {
    doc: "Disable cache for TMDB queries (not recommended)",
    format: "Boolean",
    default: false,
    arg: "nocache"
  },
  'path': {
    doc: "Location to sort or process",
    format: "String",
    default: null,
    arg: "path"
  },
  'target': {
    doc: "Target base location for sorted titles",
    format: "String",
    default: null,
    arg: "target"
  },
  'unpack': {
    doc: "Attempt to unpack archives",
    format: "Boolean",
    default: true,
    arg: "unpack"
  },
  'cleanup': {
    doc: "Clean up extracted archives if not needed",
    format: "Boolean",
    default: true,
    arg: "cleanup"
  },
  'replace': {
    doc: "Replace destination files, including images",
    format: "Boolean",
    default: false,
    arg: "replace"
  },
  'pad-tags': {
    doc: "Pad episode and season numbers with zeros",
    format: "Boolean",
    default: true,
    arg: "pad"
  },
  'include-adult': {
    doc: "Enable adult content searches",
    format: "Boolean",
    default: false,
    arg: "adult"
  },
  'images': {
    doc: "Image types to fetch",
    format: "Array",
    default: []
  },
  'tv-format': {
    doc: "Format of TV show filenames if renaming",
    format: "String",
    default: '#name# s#season_number#e#episode_number# - #episode_name#'
  },
  'movie-format': {
    doc: "Format of Movie filenames if renaming",
    format: "String",
    default: '#name# (#year#)'
  },
  'tv-sub-format': {
    doc: "TV subtitle naming format",
    format: "String",
    default: ''
  },
  'movie-sub-format': {
    doc: "Movie subtitle naming format",
    format: "String",
    default: ''
  },
  'tv-poster-format': {
    doc: "TV Poster naming format",
    format: "String",
    default: ''
  },
  'tv-season-poster-format': {
    doc: "TV Season poster naming format",
    format: "String",
    default: ''
  },
  'tv-show-fanart-format': {
    doc: "TV Show fanart naming format",
    format: "String",
    default: ''
  },
  'tv-still-format': {
    doc: "TV still / thumbnail naming format",
    format: "String",
    default: ''
  },
  'movie-poster-format': {
    doc: "Movie poster naming format",
    format: "String",
    default: ''
  },
  'movie-fanart-format': {
    doc: "Movie fanart naming format",
    format: "String",
    default: ''
  },
  // These are overrides for times when scraping fails
  'alttitle': {
    doc: "Specific title in case scraping fails",
    format: "String",
    default: '',
    arg: 'title'
  },
  'altyear': {
    doc: "Specific year in case scraping fails",
    format: "String",
    default: '',
    arg: 'year'
  },
  'interactive': {
    doc: "Make usage interactive, prompting before sorting each title",
    format: "Boolean",
    default: false,
    arg: 'interactive'
  },
  'help': {
    doc: "Show program usage",
    format: "Boolean",
    default: false,
    arg: 'help'
  }
};


let _instance = undefined;


class Config {

  constructor( schema ) {

    this.schema = configDefs;

    if ( _instance )
      return _instance;

    this.config = undefined;

    _instance = this;
  }


  /**
   * Load configuration in the order of
   *  - Defaults ( if file exists )
   *  - File from command-line option
   *  - Environment variables
   *  - Command line options
   *  - Supplementary options
   * @param {Object} [options] - Additional configuration options
   */
  load( options={} ) {
    var config;
    var configFiles = [];

    // Load environment vars and command line
    config = convict( this.schema );
    this.config = config;

    // Check if a default file exists
    try {
      var found = this.resolveFile( 'default' );
      configFiles.push( found ); 
    }
    catch( e ) {
      log.debug( "No default configuration found" );
    }

    // Any command-line additional config?
    if ( config.get( 'config' ) != '' )
      configFiles.push( this.resolveFile( config.get( 'config' ) ) );

    // Supplementary file
    if ( options.hasOwnProperty( 'config' ) && options[ 'config' ] != undefined ) {
      configFiles.push( this.resolveFile( options[ 'config' ] ) );
    }

    // Load again with files
    config.loadFile( configFiles );

    // Set any other options
    for ( let prop in options ) {
      if ( options[ prop ] != undefined ) 
        config.set( prop, options[ prop ] );
    }

  }



  /**
   * Resolve a config name to a filename
   * @param {String} name - The name to resolve
   * @returns {String} - The found filename
   * @throws - If the filename is not located
   */
  resolveFile( filename ) {
    var abs = false;
    var fileList = [];
    var found;

    // Delimeters make an absolute file
    if ( filename.indexOf( '/' ) != -1 )
      abs = true;

    // If file provided is absolute
    if ( abs ) {
      try {
        fs.accessSync( filename );
        return filename;
      }
      catch( e ) {
        throw new Error( "Unable to locate configuration file: " + filename );
      }
    }

    if ( ! filename.endsWith( '.json' ) )
      filename += '.json';
    fileList.push( process.cwd() + '/etc/' + filename );
    fileList.push( os.homedir + '/.media-sorter/' + filename );
    fileList.push( os.homedir + '/.config/media-sorter/' + filename );

    ( async () => {
      found = await locatePath( fileList );
    } )();

    if ( found == undefined )
      throw new Error( "Unable to located configuration file", filename ); 

    return found;
  }


  /**
   * Get a configuration value
   */
  get( ...args ) {
    return this.config.get( ...args );
  }

  /**
   * Set a configuration value, used by test cases
   */
  set( ...args ) {
    return this.config.set( ...args );
  }

  /**
   * Validate configuration
   */
  validate( ...args ) {
    return this.config.validate( ...args );
  }


  /**
   * Show program usage information
   */
  usage() {
    var mandatory = [];
    var optional = [];

    var conf = this._def;

    Object.keys( this.schema ).forEach( (param) => {
      var p = this.schema[param];
      var req = false;

      if ( p.default == null )
        req = true;

      var line;
      line = '\t--' + ( p.hasOwnProperty( 'arg' ) ? p.arg : param );

      if ( p.format != "Boolean" ) {
        if ( p.format == "String" )
          line = line + "  [string]";
        else if ( param.match( /-size$/ ) )
          line = line + "  [size]";
        else
          line = line + "  [" + ( p.hasOwnProperty( 'arg' ) ? p.arg : param ) + "]";
      }

      line = line + " ".repeat( parseInt( 60 - line.length ) ) + p.doc;

      if ( typeof( p.format ) == "object" )
        line = line + " [" + p.format.join( ", " ) + "]";

      if ( req )
        mandatory.push( line );
      else
        optional.push( line );
    } );

    console.log( "Usage information:\tmain.js [args]\n" )
    console.log( "Required:" );
    console.log( mandatory.join( "\n" ) );
    console.log( "\nOptional:" );
    console.log( optional.join( "\n" ) );
  }


}


export default Config;
