

import Logger from './logger.js';


import { createExtractorFromFile } from 'node-unrar-js';
import unzip from 'decompress-zip';
import glob from 'globule';
import path from 'path';
import del from 'del';
import fs from 'fs';



const log = new Logger( '::archivesmanager' );



class ArchiveManager {

  constructor( config ) {
    this.config = config;


    // Track what we have extracted
    this.extracted = [];
  }



  /**
   * Extract all archives found in a path
   * @param {String} fileOrPath - the qualified path to extract archives within
   */
  async extractAll( fileOrPath ) {

    var failsafe = 0;
    var foundNew = true;
    var archives;

    // Empty memory
    this.prevArchives = [];
    this.extracted = [];

    // If unpacking disabled, stop
    if ( ! this.config.get( 'unpack' ) )
      return;

    log.debug( "Extracting all archives for path", fileOrPath );

    var pathStat = fs.statSync( fileOrPath );

    // Begin the extraction loop
    while( foundNew == true ) {
      archives = this.findArchives( fileOrPath )
      if ( ! archives.length ) {
        log.debug( "No archives to extract" );
        return;
      }

      if ( failsafe >= 5 ) {
        log.error( "Recursive extraction stuck without error, failing" );
        throw new Error( "Recursive extraction stuck without error" );
      }

      foundNew = await this.extractArchives( archives );
      failsafe++;
    }

    return;
  }


  /**
   * Cleanup archives
   * @async
   * @throws
   *
   */
  async cleanup( fileOrPath ) {

    // If nothing to do
    if ( ! this.extracted.length )
      return;

    // Also exit if cleanup disabled, and never linking titles
    if ( ! this.config.get( 'cleanup' ) || this.config.get( 'action' ) == "link" )
      return;

    log.debug( "Cleaning up archives" );

    for( let archive of this.extracted ) {

      var extractpath = archive.substring( 0, archive.lastIndexOf( '.' ) );
      try { 
        // May be out of our CWD, so have to force
        await del( extractpath, { force: true } );
      }
      catch( e ) {
        log.error( "Failed to cleanup after archive", archive, e.message );
        throw e;
      }
    };

  }



  /**
   * Find all archives in a given location
   * @param {String} fileOrPath - the qualified path to find archives within
   */
  findArchives( fileOrPath ) {
    var archives = [];
    var pathStat = fs.statSync( fileOrPath );

    log.debug( "Searching for archives in", fileOrPath );

    if ( pathStat.isFile() ) {
      if ( fileOrPath.endsWith( '.zip' ) || fileOrPath.endsWith( '.rar' ) )
        archives.push( fileOrPath );

      // Check for nested archives when given a single file
      if ( this.extracted.indexOf( fileOrPath ) !== -1 ) {
        var extractPath = fileOrPath.substring( 0, fileOrPath.lastIndexOf( '.' ) );
        archives = archives.concat( this.findArchives( extractPath ) );
      }
    }
    else
      archives = glob.find( fileOrPath + '/**/*.+(zip|rar)' );

    archives = archives.filter( a => this.extracted.indexOf( a ) == -1 );

    return archives;

  }


  /**
   * Extract all provided archives
   * @param {String[]} archives - The archives to extract
   * @returns {Boolean} - If any archives were extracted
   * @throws - any errors during extraction
   */
  async extractArchives( archives ) {

    var extractedAny = false;

    for( let archive of archives ) {
      await this.extractOne( archive );
      extractedAny = true;
    };

    return extractedAny;
  }


  /** 
   * Extract one archive
   * @param {String} archive - Filename to the archive to extract
   * @throws - in event of extraction failure
   */
  async extractOne( archive ) {

    log.debug( "Extracting archive", archive );
    if ( archive.endsWith( '.zip' ) ) {
      try {
        await this.extractZip( archive );
        this.extracted.push( archive );
      }
      catch(e) {
        throw e;
      }
    }
    else if ( archive.endsWith( '.rar' ) ) {
      try {
        this.extractRar( archive );
        this.extracted.push( archive );
      }
      catch(e) {
        throw e;
      }
    }
  }


  /**
   * Extract a zip archive
   * @param {String} archive - Filename of archive
   * @returns {Promise}
   */
  extractZip( archive ) {

    return new Promise( (resolve, reject) => {

      var outpath, unzipper;

      // Output path is the archive name
      outpath = archive.substring( 0, archive.lastIndexOf( '.' ) );

      log.silly( "Extracting ZIP archive", archive, "to", outpath );

      unzipper = new unzip( archive );

      unzipper.on( 'error', function(err) {
        log.error( "Failed to extract ZIP archive", err.message );
        reject( err );
      } );

      unzipper.on( 'extract', function() {
        log.debug( "Successfully extracted ZIP archive" );
        resolve();
      } );

      // Finally extract
      unzipper.extract( { "path": outpath } );

    } );
  }


  /**
   * Extract a RAR archive
   * @param {String} archive - Filename of archive
   * @throws
   * */
  extractRar( archive ) {
    var outpath, extractor, result;

    outpath = archive.substring( 0, archive.lastIndexOf( '.' ) );

    log.silly( "Extracting RAR archive", archive, "to", outpath );

    extractor = createExtractorFromFile( archive, outpath );
    var result = extractor.extractAll();

    if ( result[0].state != "SUCCESS" ) {
      log.error( "Failed to extract RAR archive:", result[0].msg );
      throw new Error( "Failed to extract RAR archive" );
    }

    log.debug( "Successfully extracted RAR archive" );
  }



}


export default ArchiveManager;


