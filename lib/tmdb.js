


import Logger from './logger.js';
import CacheDB from './cachedb.js';

import { pRateLimit } from 'p-ratelimit';
import sanitize from 'sanitize-filename';
import stringSimilarity from 'string-similarity';
import { MovieDb } from 'moviedb-promise';


const log = new Logger( '::tmdb' );

const EnvKey = process.env.MOVIEDB_API_KEY;

const limiter = pRateLimit( {
  interval: 1000,
  rate: 2,
  concurrency: 2
} );


// Clean a name, suitable for matching or filenames
const cleanName = ( bit ) => {
  if ( bit ) {
    bit = bit.toLowerCase();
    bit = sanitize( bit, { replacement: ' ' } );
    bit = bit.replace( /[\!\(\)\[\]]/g, "" );
    bit = bit.replace( /\s\s/g, " " );
  }
  return bit;
};


// Build a URL for an image.
const imgUrl = ( bit, db ) => {
  if ( bit == null || bit == undefined )
    return;
  var base = db.get( 'configuration' ).value()["images"]["base_url"] + "original/";
  return bit && base + bit.replace( /^\//, "" );
};



// Map methods to a way to process them
const methodTypes = {
  'searchTv':         "search",
  'searchMovie':      "search",
  'episodeInfo':      "info",
  'seasonInfo':       "info"
};


// Define tmdb query data requirements
const queryArgsConf = {
  'searchTv': { // Gives TV show info, inc posters & backdrops
    'query':                { 'source': 'title',        'field': function(p) { return p.hasOwnProperty( "altname" ) ? p["altname"] : p["name"] }, 'required': true },
    'first_air_date_year':  { 'source': 'title',        'field': 'year',          'required': false },
    'include_adult':        { 'source': 'config',       'field': 'include-adult', 'required': false }
  },
  'searchMovie': { // Gives Movie info, inc posters & backdrops
    'query':                { 'source': 'title',        'field': function(p) { return p.hasOwnProperty( "altname" ) ? p["altname"] : p["name"] }, 'required': true }
    // Year is not included due to titles with a year-like part in the name, eg 2001: A Space Odyssey
    // To save doing two queries, instead year will be matched after the query.
  },
  'episodeInfo': { // Gives episode info, inc name & still
    'id':                   { 'source': 'searchTv',     'field': 'id',            'required': true },
    'season_number':        { 'source': 'title',        'field': 'season',        'required': true },
    'episode_number':       { 'source': 'title',        'field': 'episode',       'required': true }
  },
  'seasonInfo': {
    'id':                   { 'source': 'searchTv',     'field': 'id',            'required': true },
    'season_number':        { 'source': 'title',        'field': 'season',        'required': true }
  }
};


// Define cache lookup data requirements
var cacheLookupData = {
  'searchTv':  [ { // Two lookups, considering sometimes a year like piece is in the title
      'name_clean':         { 'source': 'title',     'field': 'name',          'required': true },
      'year':               { 'source': 'title',     'field': function(t){ var y = t["altyear"] || t["year"]; if (y) { return y + "" } },          'required': false } // Hit cache with year as string
    },
    { // Try with year as part of the name
      'name_clean':         { 'source': 'title',     'field': function(t){ var y = t["altyear"] || t["year"]; if (y) { return t["name"] + " " + y } else { return t["name"] } },     'required': true }
    },
    { // Try with the provided alternative name
      'name_clean':         { 'source': 'title',     'field': 'altname',     'required': true },
      'year':               { 'source': 'title',     'field': function(t){ var y = t["altyear"] || t["year"]; if (y) { return y + "" } },          'required': true } // Hit cache with year as string
    }
  ],
  'searchMovie': [ {
      'name_clean':         { 'source': 'title',     'field': 'name',          'required': true },
      'year':               { 'source': 'title',     'field': function(t){ var y = t["altyear"] || t["year"]; if (y) { return y + "" } },     'required': false } // Hit cache with year as string
    },
    { // Try with year as part of the name
      'name_clean':         { 'source': 'title',     'field': function(t){ var y = t["altyear"] || t["year"]; if (y) { return t["name"] + " " + y } else { return t["name"] } },     'required': true }
    },
    { // Try with the provided alternative name
      'name_clean':         { 'source': 'title',     'field': 'altname',     'required': true },
      'year':               { 'source': 'title',     'field': function(t){ var y = t["altyear"] || t["year"]; if (y) { return y + "" } },     'required': true } // Hit cache with year as string
    } ],
  'episodeInfo': [ {
    'tv_id':                { 'source': 'searchTv',  'field': 'id',            'required': true },
    'season_number':        { 'source': 'title',     'field': 'season',        'required': true },
    'episode_number':       { 'source': 'title',     'field': 'episode',       'required': true }
  } ],
  'seasonInfo': [ {
    'tv_id':                { 'source': 'searchTv',  'field': 'id',            'required': true },
    'season_number':        { 'source': 'title',     'field': 'season',        'required': true }
  } ]
};


// Define how to process TMDB response data
const responseConf = {
  "searchTv": {
    "id":                   { 'source': "tmdb",     'field': 'id' },
    "name":                 { 'source': "tmdb",     'field': 'name' },
    "name_clean":           { 'source': "tmdb",     'field': 'name',              'transform': cleanName },
    "year":                 { 'source': "tmdb",     'field': 'first_air_date',    'transform': function(a){ return a && a.match( /^(\d{4})/ )[1] } },
    "poster_url":           { 'source': "tmdb",     'field': 'poster_path',       'transform': imgUrl },
    "fanart_url":           { 'source': "tmdb",     'field': 'backdrop_path',     'transform': imgUrl }
  },
  "searchMovie": {
    "id":                   { 'source': "tmdb",     'field': 'id' },
    "name":                 { 'source': "tmdb",     'field': 'title' },
    "name_clean":           { 'source': "tmdb",     'field': 'title',             'transform': cleanName },
    "year":                 { 'source': "tmdb",     'field': 'release_date',      'transform': function(a){ return a && a.match( /^(\d{4})/ )[1] } },
    "poster_url":           { 'source': "tmdb",     'field': 'poster_path',       'transform': imgUrl },
    "fanart_url":           { 'source': "tmdb",     'field': 'backdrop_path',     'transform': imgUrl }
  },
  "episodeInfo": {
    "episode_name":         { 'source': "tmdb",     'field': 'name' },
    "thumb_url":            { 'source': "tmdb",     'field': 'still_path',        'transform': imgUrl },
    "episode_number":       { 'source': "tmdb",     'field': 'episode_number' },
    "season_number":        { 'source': "tmdb",     'field': 'season_number' },
    "tv_id":                { 'source': "searchTv", 'field': 'id' } // Needed for cache lookups
  },
  'seasonInfo': {
    "season_poster_url":    { 'source': "tmdb",     'field': "poster_path",       'transform': imgUrl },
    "season_number":        { 'source': "tmdb",     'field': 'season_number' },
    "tv_id":                { 'source': "searchTv", 'field': 'id' } // Needed for cache lookups
  },
  'configuration': {
    "images":               { 'source': "tmdb",     'field': "images" }
  }
};



// Default metadata for titles
const defaultMetaConf = {
  "tv": {
    "name":                   { 'source': "title",    'field': "name",      'required': true,     'transform': function(a){
        // This handles utf-8 character set
        return a.replace(/^[\u00C0-\u1FFF\u2C00-\uD7FF\w]|\s[\u00C0-\u1FFF\u2C00-\uD7FF\w]/g, function(l) { return l.toUpperCase() } ) } },
    "name_clean":                { 'source': "title",    'field': "name",      'required': true },
    "year":                   { 'source': "title",    'field': "year",      'required': false },
    "episode_number":         { 'source': "title",    'field': "episode",   'required': true },
    "season_number":          { 'source': "title",    'field': "season",    'required': true }
  },
  "movie": {
    "name":                   { 'source': "title",    'field': "name",      'required': true,     'transform': function(a){
        // This handles utf-8 character set
        return a.replace(/^[\u00C0-\u1FFF\u2C00-\uD7FF\w]|\s[\u00C0-\u1FFF\u2C00-\uD7FF\w]/g, function(l) { return l.toUpperCase() } ) } },
    "name_clean":                { 'source': "title",    'field': "name",      'required': true },
    "year":                   { 'source': "title",    'field': "year",      'required': false }
  }
};


class TMDB {

  constructor( config ) {
    this.config = config;

    var lookupEnabled = config.get( 'lookup' );
    var apiKey = EnvKey || config.get( 'key' );

    if ( lookupEnabled && ( apiKey == '' || apiKey == undefined ) )
      throw new Error( "TMDB API Key missing, required for lookups" );

    if ( lookupEnabled ) {
      this.mdb = new MovieDb( apiKey );
      this.cache = new CacheDB( config );
    }
  }


  /** 
   * Check and or fetch configuration for TMDB
   * @async
   * @throws
   */
  async checkConfig() {
    log.debug( "Checking TMDB configuration" );
    var conf = {};
    var response, tmdbconfig;

    // Don't check unless using
    if ( ! this.config.get( 'lookup' ) ) {
      log.debug( "Lookups disabled, not checking TMDB configuration" );
      return;
    }

    // Setup database
    this.cache.setup();

    // Check cache
    tmdbconfig = this.cache.get( "configuration" ).value();

    // FIXME: Configurise configuration max age
    if ( ! tmdbconfig || tmdbconfig.fetchTime < ( Date.now() - 7 * 86400 * 1000 ) ) {
      log.debug( "TMDB configuration missing or stale, loading" );
      response = await limiter( () => this.mdb.configuration() );

      // Pull out the info we need
      log.silly( "Processing TMDB configuration" );
      Object.keys( responseConf["configuration"] ).forEach( (field) => { 
        if ( response.hasOwnProperty( field ) )
          conf[field] = response[field];
      } );

      this.cache.set( 'configuration', conf ).write();
    }
    else
      log.debug( "TMDB configuration ok" );
  }


  /**
   * Flush old cache data
   */
  flushCache() {

    if ( ! this.config.get( 'lookup' ) )
      return;

    log.debug( "Flushing expired TMDB cache" );
    Object.keys( methodTypes ).forEach( (method) => {
      this.cache.flush( method );
    } );
  }


  /**
   * Prepare titles for scraping
   * @param {Object[]} titles - Titles to prepare
   */
  prepareTitles( titles ) {

    var lookup = this.config.get( 'lookup' );

    titles.forEach( (title) => {

      // Init some of our title variables
      title["tmdb"] = {
        "queries": [],
        "results": {}
      };

      // We only scrape video files
      if ( title.type != "video" ) {
        log.error( "Scrape of non video titles unsupported, ignoring.", title );
        return;
      }

      // Make sure the title has a media type and lookup pieces
      if ( ! title.hasOwnProperty( 'mediatype' ) || ! title.hasOwnProperty( 'pieces' ) ) {
        log.error( "Title is missing media type or scraped pieces, ignoring.", title );
        return;
      }

      // If not performing lookups, don't figure out query methods
      if ( ! lookup )
        return;

      log.debug( "Building lookup query list for title", title.full );

      // Figure out a list of TMDB methods to get data we need
      title["tmdb"]["queries"] = this.chooseMethods( title );
      return;

    } );
  }



  /**
   * Choose TMDB methods to get data we need
   * @param {Object} title - The title to choose for
   * FIXME: incomplete?
   */
  chooseMethods( title ) {

    // What info do we need?
    var mediaType = title.mediatype;
    var wantImages = this.config.get( 'images' );
    var queries = [];

    // All TV lookups (image or search) need a show search first
    if ( mediaType == "tv" ) {
      queries.push( "searchTv" );
      queries.push( "episodeInfo" );
      if ( wantImages.indexOf( 'season-poster' ) != -1 )
        queries.push( "seasonInfo" );
    }

    // All Movie lookups need a movie search first
    if ( mediaType == "movie" )
      queries.push( "searchMovie" ); 

    return queries;
  }


  /**
   * Execute all queries for a given title
   * @param {Object} title - The title to process
   */
  async executeQueries( title ) {

    for ( let queryName of title.tmdb.queries ) {

      var response;

      // Build query args
      var queryArgs = this.queryArgs( queryName, title );
      if ( ! queryArgs )
        throw new Error( "Failed to construct query arguments for title" );

      // Try cache for this first
      var cacheItem = this.lookupCache( queryName, title );
      if ( cacheItem ) {
        title["tmdb"]["results"][ queryName ] = cacheItem; 
        title["meta"] = Object.assign( title["meta"], cacheItem );
        continue;
      }

      // Cache miss, attempt lookup
      try {
        log.silly( "Sending TMDB request for query", queryName, "with args", queryArgs );
        response = await limiter( () => this.mdb[ queryName ]( queryArgs ) );
      }
      catch( e ) {
        log.error( "Failed in TMDB request", e.message );
        throw new Error( "Failed in TMDB request: " + e.message );
      }

      this.processResponse( queryName, title, response );

    }

    // If no queries to run, or no results, just populate defaults
    if ( ! title.tmdb.queries.length || Object.keys( title.meta ) == 0 ) {
      var meta = this.defaultMeta( title );
      if ( ! meta )
        throw new Error( "Failed to extract default metadata for title" );
      title["meta"] = meta;
      return;
    }

  }


  /**
   * Build query arguments
   * @param {String} query - The name of the query
   * @param {Object} title - The title for the query
   */
  queryArgs( query, title ) {

    log.silly( "Building query arguments for query", query );

    // Method info
    var queryConf = queryArgsConf[ query ];
    var queryArgs = {};
    var failed = false;

    // Collect query arguments and return if successful
    var ok = Object.keys( queryConf ).every( ( arg ) => {
      var fieldconf = queryConf[ arg ];
      var source = fieldconf.source;
      var field = fieldconf.field;

      // Special case for config source data
      if ( source == "config" ) {
        queryArgs[ arg ] = this.config.get( field );
        return true;
      }
      else if ( source == "title" ) {
        if ( typeof( field ) == "function" ) {
          queryArgs[ arg ] = field( title["pieces"], this.cache );
          return true;
        }
        else if( title.pieces.hasOwnProperty( field ) ) {
          queryArgs[arg] = title.pieces[ field ];
          return true;
        }
      }
      else { 
        // Source must be a previous response
        // Go through each result and look for a matching source, then data
        Object.keys( title["tmdb"]["results"] ).some( ( resMeth ) => { 
          if ( resMeth == source ) {
            if (  typeof( field ) == "function" ) {
              queryArgs[arg] = field( title["tmdb"]["results"][resMeth], this.cache );
              return true;
            }
            else if ( title["tmdb"]["results"][resMeth] && title["tmdb"]["results"][resMeth].hasOwnProperty( field ) ) {
              queryArgs[arg] = title["tmdb"]["results"][resMeth][field];
              return true;
            }
          }
        } );
      }

      // If anything is missing 
      if ( fieldconf.required && ! queryArgs.hasOwnProperty( field ) ) {
        log.error( "Missing required lookup attribute", field );
        return false;
      }

      return true;
    } );

    if ( ok )
      return queryArgs;
    else {
      log.debug( "Failed to build query args for query", query );
      return;
    }
  }


  /** 
   * Lookup cache for a previous query
   * @param {String} query - The name of the query
   * @param {Object} title - The title for the query
   */
  lookupCache( query, title ) {

    var item = undefined;
    var lookups = cacheLookupData[query];

    // If caching is disabled
    if ( this.config.get( 'nocache' ) )
      return;

    // Loop over each lookup configuration
    lookups.some( (lookupArgs) => {

      var args = {};
      var skip = false;

      // Build arguments to hit cache with
      Object.keys( lookupArgs ).forEach( (arg) => {

        var argconf = lookupArgs[arg];
        var source = argconf.source;
        var sourcefield = argconf.field;

        if ( source == "title" ) {
          if ( typeof( sourcefield ) == "function" )
            args[arg] = sourcefield( title["pieces"], this.cache );
          else if ( title["pieces"].hasOwnProperty( sourcefield ) )
            args[arg] = title["pieces"][sourcefield];
        }
        else if ( title["tmdb"]["results"].hasOwnProperty( source ) ) {
          // Assume source is from another response
          if ( typeof( sourcefield ) == "function" )
            args[arg] = sourcefield( title["tmdb"]["results"][source], this.cache );
          else if ( title["tmdb"]["results"][source].hasOwnProperty( sourcefield ))
            args[arg] = title["tmdb"]["results"][source][sourcefield];
        }

        // If anything is missing then the lookup isn't valid, skip it
        if ( argconf.required && ! args.hasOwnProperty( arg ) ) {
          log.silly( "Cache lookup arguments missing, missing required arg", arg, "Skipping this lookup" );
          skip = true;
        }
      } );

      // Skipping this lookup?
      if ( skip == true )
        return false;

      // Don't perform empty search
      if ( Object.keys( args ).length == 0 ) {
        log.silly( "Cache lookup data empty, trying next match rule" );
        return false;
      }

      // Lookup cache
      item = this.cache.get( query ).find( args ).value();
      if ( item ) {
        log.silly( "Cache hit for", query, "lookup with args", args, ":", item );
        return true;
      }
      else
        log.silly( "Cache miss for", query, "lookup with args", args );
      return false;
    } );

    return item;

  }


  /** 
   * Process a TMDB response
   * @param {String} query - The name of the query
   * @param {Object} title - The title
   * @param {Object} response - The TMDB response
   */
  processResponse( query, title, response ) {

    // Parse searches
    if ( methodTypes[ query ] == "search" )
      return this.parseSearch( query, title, response );

    // Process info requests
    if ( methodTypes[ query ] == "info" )
      return this.parseInfo( query, title, response );

    // Unknown method?
    return new Error( "Unknown method type", query );

  }



  /**
   * Parse an information response
   * @param {String} query - The name of the query
   * @param {Object} title - The title
   * @param {Object} response - The TMDB response
   */
  parseInfo( query, title, response ) {

    // Parse response
    var item = this.parseOne( query, response, title );
    if ( item == undefined )
      throw new Error( "Failed to process information response for title" );

    // Update or add this item to cache
    this.cacheResults( query, [ item ] );

    title["tmdb"]["results"][ query ] = item; 
    title["meta"] = Object.assign( title["meta"], item );

  }


  /** 
   * Parse a search response
   * @param {String} query - The name of the query
   * @param {Object} title - The title
   * @param {Object} response - The TMDB response
   */
  parseSearch( query, title, response ) {

    log.silly( "Parsing search response", response );
    var match;

    // To store processed response items
    var items = [];

    // Pearse each response
    if ( response.results && response.results.length ) {
      // Build a list of items to cache and process
      response.results.forEach( (result) => {
        var item = this.parseOne( query, result, title );
        // An undefined item without an exception means it's bad, to be ignored
        if ( item == undefined )
          return;

        items.push( item );
      } );
    }
    else {
      return new Error( "No results received from query for title: " + title.name );
    }

    // Cache items if cache is enabled
    if ( ! this.config.get( 'nocache' ) )
      this.cacheResults( query, items );

    // Choose the best match
    match = this.chooseMatch( items, title );

    // Store only the matched item or null if not matched
    if ( match ) {
      title["tmdb"]["results"][ query ] = match;
      title["meta"] = Object.assign( title["meta"], match );
    }
    else {
      title["tmdb"]["results"][ query ] = null;
      return new Error( "Failed to determine match for title", title.name );
    }

    return;

  }


  /** 
   * Parse one response item
   * @param {String} query - The name of the query
   * @param {Object} result - The TMDB result piece
   * @param {Object} title - The title
  */
  parseOne( query, result, title ) {

    var ok = false;
    var item = {};
    var methFields = responseConf[ query ];

    // Go through each field we want
    ok = Object.keys( methFields ).every( ( field ) => { 
      var fconf = methFields[ field ];
      var source = fconf.source;
      var sourcefield = fconf.field;
      var transform = fconf.transform;

      if ( source == "tmdb" ) {
        if ( result.hasOwnProperty( sourcefield ) ) {
          if ( transform )
            item[field] = transform( result[sourcefield], this.cache );
          else
            item[field] = result[sourcefield];
        }
        else {
          log.warn( "Response is missing field " + sourcefield + ". Ignoring" );
          return false;
        }

      }
      else {
        // Assume other sources are other responses
        if ( title["tmdb"]["results"].hasOwnProperty( source ) && title["tmdb"]["results"][source].hasOwnProperty( sourcefield ) ) {
          if ( transform )
            item[field] = transform( title["tmdb"]["results"][source][sourcefield], this.cache );
          else
            item[field] = title["tmdb"]["results"][source][sourcefield];
        }
        else {
          log.error( "Missing response source data, source: " + source + ", field: " + field );
          return false;
        }
      }
      return true;
    } );

    if ( ! ok ) {
      log.warn( "Ignoring one response", result );
      return undefined;
    }

    // Add a timestamp
    item["fetchTime"] = Date.now();

    return item;

  }


  /**
   * Cache some given results
   * @param {String} query - The name of the query
   * @param {Object[]} items - The result items
   */
  cacheResults( query, items ) {
    items.forEach( (item) => {

      // Look for this by ID first
      var cacheItem = this.cache.get( query ).find( { id: item.id } ).value();

      // If found, update
      if ( cacheItem ) {
        log.silly( "Updating cache item", cacheItem );
        this.cache.get( query ).find( { id: item.id } ).assign( item ).write();
      }
      else {
        // Not found, create
        log.silly( "Creating cache item for method", query, item );
        this.cache.get( query ).push( item ).write();
      }

    } );
  }



  /**
   * Choose the best match
   * @param {Object[]} items - The search items
   * @param {Object} title - The title to match
   * @returns {Object} [match] - Any identified match
   */
  chooseMatch( items, title ) {
    var tname, tyear, match;

    log.silly( "Processing TMDB response for match for title", title );

    tname = title.pieces["name"];
    if ( title.pieces.hasOwnProperty("altname") )
      tname = title.pieces["altname"];
    tyear = title.pieces["year"];
    if ( title.pieces.hasOwnProperty("altyear") )
      tyear = title.pieces["altyear"]

    // Match title name plus year as part of the name ( eg blade runner 2049 )
    if ( tyear ) {
      match = items.find( (item) => {
        var testname = tname + " " + tyear;
        if ( testname == item["name_clean"] )
          return true;
        return false;
      } );
      if ( match )
        return match;
    }

    // Match title name and year if provided. A title without year
    // will match the first result with a matching name.
    match = items.find( (item) => {

      // Try to fully match titles
      if ( item["name_clean"] == tname ) {
        // Match by name. Check year if available
        if ( ! tyear || item["year"] == tyear ) {
          // I'd be satisfied with that. 
          log.info( "Matched", tname, tyear || "", "with", item["name"], item["year"] );
          return true;
        }
      }
      return false;
    } );


    // Matches all words from the first result title with title name
    if ( ! match ) {
      if ( items[0]["name_clean"].split( / / ).every( (bit) => { return tname.indexOf( bit ) == -1 ? false : true } ) ) {
        // Also check year
        if ( ! tyear || items[0]["year"] == tyear ) {
          log.info( "Matched", tname, tyear || "", "with", items[0]["name"], items[0]["year"] );
          match = items[0];
        }
      }
    }

    // Last ditch effort, if the first one mostly matches, use it.
    if ( ! match ) {
      if ( stringSimilarity.compareTwoStrings( items[0]["name_clean"], tname ) >= 0.8 ) {
        if ( ! tyear || items[0]["year"] == tyear ) {
          log.info( "Matched", tname, tyear || "", "with", items[0]["name"], items[0]["year"] );
          match = items[0];
        }
      }
    }

    return match;

  }


  /**
   * Build metadata without any query
   * @param {Object} title - The title for the query
   * @returns {Object} [meta] - Any constructed metadata
   */
  defaultMeta( title ) {

    log.silly( "Populating default metadata for title" );

    var dm = defaultMetaConf[ title.mediatype ];  
    var meta = {};

    // Collect query arguments and return if successful
    var ok = Object.keys( dm ).every( (arg) => {
      var fieldconf = dm[arg];
      var source = fieldconf.source;
      var field = fieldconf.field;
      var transform = fieldconf.transform;

      // Only this source for now
      if ( source == "title" ) {
        if ( title.pieces.hasOwnProperty( field ) ) {
          if ( transform ) 
            meta[arg] = transform( title.pieces[field], this.cache );
          else
            meta[arg] = title.pieces[field];
          return true;
        }
        else if ( ! fieldconf.required )
          return true;
        return false;
      }

    } );

    if ( ok )
      return meta;
    else
      return undefined;

  }


}

export default TMDB;

