

import tempWrite from 'temp-write';
import { get } from 'simple-get-promise';
import path from 'path';

import Logger from './logger.js';
import FilesManager from './filesmanager.js';

const log = new Logger( '::image' );

const extname = path.extname;


// Map application
const imageKeys = {
  'show-backdrop':  "fanart_url",
  'show-poster':    "poster_url",
  'season-poster':  "season_poster_url",
  'episode-still':  "thumb_url",
  'movie-backdrop': "fanart_url",
  'movie-poster':   "poster_url"
};


// Tie image types to media types
const mediaTypeKeys = {
  'show-backdrop':  "tv",
  'show-poster':    "tv",
  'season-poster':  "tv",
  'episode-still':  "tv",
  'movie-backdrop': "movie",
  'movie-poster':   "movie" 
};



class ImageManager {

  constructor( config ) {
    this.config = config;

    this.filesmanager = new FilesManager( config );
  }


  /**
   * Fetch images for a title
   * @async
   * @param {Object} title - The title
   */
  async fetchImages( title ) {

    var toFetch = [];

    log.debug( "Fetching media for title", title.name );

    // Build a list of things to fetch 
    this.config.get( 'images' ).forEach( (type) => {

      var key, url, ext;

      key = imageKeys[type];

      // If no URL for this type
      if ( ! title["meta"].hasOwnProperty( key ) || title["meta"][ key ] == undefined || title["mediatype"] != mediaTypeKeys[type] )
        return;

      url = title["meta"][key];
      ext = extname( url ).replace( /^\./, "" );

      // Do we have a url for this image
      if ( ! title["meta"].hasOwnProperty( key ) || title["mediatype"] != mediaTypeKeys[type] )
        return

      // Don't fetch if image already exist and we're not replacing images
      if ( ! this.config.get( "replace" ) && this.filesmanager.imageExists( title, type ) )
        return;

      // We need to fetch, add to list
      toFetch.push( { "type": type, "url": url, "ext": ext } );

    } );

    // Nothing to download?
    if ( ! toFetch.length ) {
      log.debug( "No images to fetch for title", title.name );
      return;
    }

    log.silly( "Will fetch following images", toFetch );

    // Fetch all
    for ( let needed of toFetch ) {
      await this.fetchOne( title, needed );
    }
  }



  /** 
   * Fetch one image
   * @async
   * @param {Object} title - The title
   * @param {Object} image - The image to fetch
   * @throws on any failure
   */
  async fetchOne( title, image ) {
    var response = {};


    // Fetch...
    try { 
      log.info( "Fetching", image.type, "for title", title.name, "to temp file" );

      response = await get( image.url );

      if ( response.statusCode != "200" )
        throw new Error( "Failed to fetch image: code " + response.statusCode + ", message: " + response.statusMessage ); 

      // Write to file
      var tmpPath = await tempWrite( response.buffer );

      title["images"].push( { 
        "type": image.type, 
        "full": tmpPath,
        "ext": image.ext 
      } );

    }
    catch(e) {
      if ( ! response ) 
        log.error( "Failed to fetch image: " + e.message );
      else 
        log.error( "Failed to fetch image, code: " + response.statusCode + ", message: " + response.statusMessage );
      throw e;
    }

  }


}


export default ImageManager;




