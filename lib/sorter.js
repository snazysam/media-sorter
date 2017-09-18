
import Logger from './logger.js';
import ArchiveManager from './archivemanager.js';
import FilesManager from './filesmanager.js';
import TitlesManager from './titlesmanager.js';
import ImageManager from './imagemanager.js';
import TMDB from './tmdb.js';
import Config from './config.js';

import { Writable } from 'stream';


const log = new Logger( '::sorter' );


class Sorter {

  constructor( logfile, options={} ) {

    // Load configuration and validate
    this.config = new Config();

    if ( logfile )
      log.logToFile( logfile );

    try {
      this.config.load( options );
      this.config.validate({allowed: 'strict'});
    }
    catch( e ) {
      console.log( "Failed configuration validation: ", e.toString(), "\n" );
    }

    this.tmdb = new TMDB( this.config );
    this.archives = new ArchiveManager( this.config );
    this.files = new FilesManager( this.config );
    this.titles = new TitlesManager( this.config, this.files );
    this.images = new ImageManager( this.config );
  }



  /**
   * Sort all titles from one path to another
   * @async
   */
  async sortAll() {

    var action = this.config.get( 'action' );
    var tosort = this.config.get( 'path' );
    var target = this.config.get( 'target' );
    var titles = [];

    log.info( "Will attempt to", action, "titles from", tosort, "to", target );

    try { 
      // Check TMDB config if scraping - nil cb args
      await this.tmdb.checkConfig();

      // Cleanup cache
      this.tmdb.flushCache();

      // Unpack all archives - cb args: sortpath String
      await this.archives.extractAll( tosort );

      // Find titles to sort
      titles = this.files.findTitles( tosort );

      // Locate subtitles - cb args: titles List
      this.files.locateSubs( titles );

      // Parse file names into constituents
      this.titles.parseTitles( titles );

      // Prepare for scraping - cb args: titles List
      this.tmdb.prepareTitles( titles );

      // Scrape and sort all titles
      await this.scrapeAll( titles );

      // Cleanup archives as needed
      this.archives.cleanup( );

      log.info( "Sorting complete" );
    }
    catch( e ) {
      log.error( "Failure in sorting", e );
      throw e;
    }

  }


  /**
   * Scrape titles and sort
   * @private
   */
  async scrapeAll( titles ) {

    for( let title of titles ) {

      try { 
        // Execute TBDB queries
        await this.tmdb.executeQueries( title );

        // Fetch any required images
        await this.images.fetchImages( title );

        // TODO
        // Post-process images (resize / swap formats etc)
        // async.apply( image.postprocess.bind( image ), title ),

        // Sort finally
        this.titles.sortTitle( title );
      }
      catch( e ) {
        log.error( "Failure in sorting", title.name, ", skipping" );
        throw e;
      }
    }
  }
}

export default Sorter;

