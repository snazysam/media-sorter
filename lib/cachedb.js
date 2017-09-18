// Cache database singleton

import Logger from './logger.js';


import fs from 'fs';
import path from 'path';
import low from 'lowdb';
import mkdirp from 'mkdirp';
import findConfig from 'find-config';
import FileSync from 'lowdb/adapters/FileSync';


const log = new Logger( '::cachedb' );

// FIXME: Configurise this
// Maximum cache age, 1 month
const oldAge = Date.now() - ( 30 * 86400 * 1000 );

// Cache DB
// Note, caching is only for TV show information (not seasons/episodes)
// as that will likely be the only duplicate TMDB request. Seasons or episode
// information is fetched as required.

let _instance = undefined;


class CacheDB {

  constructor( config ) {

    if ( _instance != undefined )
      return _instance;

    this.config = config;
  }


  setup() {
    var dbPath = this.dbPath();
    var adapter = new FileSync( dbPath );
    this.db = low( adapter );

    // Defaults for cache
    this.db.defaults({ 
      "configuration": undefined,
      "searchTv": [],
      "searchMovie": [],
      "tvEpisodeInfo": [],
      "tvSeasonInfo": []
    }).write();
  }


  /**
   * Proxied setter
   */
  set( ...args ) {
    return this.db.set( ...args );
  }


  /**
   * Proxied getter
   */
  get( ...args ) {
    return this.db.get( ...args );
  }


  /** 
   * Return the database file
   */
  dbPath() {
    var dbfile, found;
    var locations = [];

    dbfile = this.config.get( 'cachefile' );
    if ( dbfile != '' && dbfile != undefined ) {
      if ( fs.existsSync( dbfile ) )
        return dbfile;
      found = findConfig( dbfile, { dir: 'data' } );
      if ( found != null )
        return dbfile;
      if ( fs.existsSync( 'data' ) )
        return 'data/' + dbfile;
      else {
        mkdirp.sync( 'data' );
        return 'data/' + dbfile;
      }
    }

    mkdirp.sync( 'data' );
    return 'data/cache.json';
  }


  /**
   * Flush old records
   * @param {String} section - Cache section to prune
   */
  flush( section ) {
    log.silly( "Pruning", section, "cache records" );
    var records = this.db.get( section ).value() || [];
    records = records.filter( ( record ) => { if ( ! record["fetchTime"] || record["fetchTime"] <= oldAge ) { return false } return true; } );
    this.db.set( section, records ).write();
  }

}


export default CacheDB;


