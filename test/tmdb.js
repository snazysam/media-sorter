
import * as assert from 'assert';
import chai from 'chai';
import Proxyquire from 'proxyquire';
import sinon from 'sinon';
import low from 'lowdb';
import fs from 'fs';
import path from 'path';

const proxyquire = Proxyquire.noCallThru();

const expect = chai.expect;

const MemAdapter = require('lowdb/adapters/Memory')


// NOTE: Rate limiting in code causes processing to take ~1 second


describe("TMDB - ", function() {
 
  var tmdb, tmdbClass;
  var config, configClass;
  var cacheDBClass;
  var logStub;
  var lowStub;

  var confresp = {
    "images": {
      "base_url": "http://image.tmdb.org/t/p/",
      "secure_base_url": "https://image.tmdb.org/t/p/",
    }
  };

  var badtitle1 = {
    dir: 'test/test123',
    full: 'test/test123/test.avi',
    name: 'test',
    type: 'video',
    ext: 'avi',
    subs: [],
    images: [],
    meta: {}
  };

  var title1 = {
    dir: 'test/Mr Magoo',
    full: 'test/Mr Magoo/Mr Magoo 1997.avi',
    name: 'Mr Magoo 1997',
    type: 'video',
    ext: 'avi',
    subs: [],
    images: [],
    meta: {},
    mediatype: "movie",
    pieces: { name: "mr. magoo", year: 1997  }
  };

  var title2 = {
    dir: 'test/test345',
    full: 'test/test345/foobarlol.avi',
    name: 'foobarlol',
    type: 'video',
    ext: 'avi',
    subs: [],
    images: [],
    meta: {},
    mediatype: "movie",
    pieces: { name: "foobarlol" }
  };

  var title3 = {
    dir: 'test/test789',
    full: 'test/test789/the.flintstones.s01e01.avi',
    name: 'the.flintstones.s01e01',
    type: 'video',
    ext: 'avi',
    subs: [],
    images: [],
    meta: {},
    mediatype: "tv",
    pieces: { name: "the flintstones", season: 1, episode: 1 }

  };

  var title1queries = [
    'searchMovie',
  ];

  var title2queries = [
    'searchMovie',
  ];

  var title3queries = [
    'searchTv',
    'episodeInfo',
    'seasonInfo'
  ];

  var mockDb;

  after(function() {
    config = null;
  } );

  before(function () {

    // Create fake logger
    logStub = function(){
      return {
        'debug': function( ...t ){},
        'silly': function( ...t ){},
        'error': function( ...t ){},
        'info': function( ...t ){},
        'level': function(){}
      }
    };

    // Use mock logger instead
    configClass = proxyquire( '../lib/config.js', {
      './logger.js': logStub
    }).default;

    config = new configClass();
    config.load();

    // Enable images just for config
    config.set( 'images', [ 'show-backdrop', 'show-poster', 'season-poster', 'episode-still', 'movie-backdrop', 'movie-poster' ] );

    // Database stubs
    var memadap = new MemAdapter();
    lowStub = sinon.stub()
    mockDb = low( memadap );
    mockDb.defaults( {} ).write();
    lowStub.returns( mockDb );
    

    cacheDBClass = proxyquire( '../lib/cachedb.js', {
      './logger.js': logStub,
      'lowdb': lowStub
    }).default;

    // Use mocks
    tmdbClass = proxyquire('../lib/tmdb', { 
      './logger.js': logStub,
      './cachedb.js': cacheDBClass
    }).default;
    tmdb = new tmdbClass( config );

  });

  describe( "TMDB Configuration -", function() {

    it( "fetch config", async () => {

      await tmdb.checkConfig();

      expect( mockDb.get( "configuration" ).value().images )
        .to.include.keys( [ 'base_url', 'secure_base_url', "poster_sizes", "backdrop_sizes", 'still_sizes', "profile_sizes", "logo_sizes" ] );

    } );

  } );

  describe( "Media - ", function( ){

    it( "prepare 1", async () => {

      // Set config
      config.set( 'tv-img-season-fetch', true );

      await tmdb.prepareTitles( [ title1 ] );

      expect( title1.tmdb.queries )
        .to.be.an( "array" )
        .to.be.deep.equal( title1queries );

    } );


    it( "prepare 2", async () => {

      // Set config
      config.set( 'images', [ 'show-backdrop', 'show-poster', 'movie-backdrop', 'movie-poster' ] );

      await tmdb.prepareTitles( [ title2 ] );

      expect( title2.tmdb.queries )
        .to.be.an( "array" )
        .to.be.deep.equal( title2queries );

    } );


    it( "prepare 3", async () => {

      // Set config
      config.set( 'images', [ 'show-backdrop', 'show-poster', 'season-poster' ] );

      await tmdb.prepareTitles( [ title3 ] );

      expect( title3.tmdb.queries )
        .to.be.an( "array" )
        .to.be.deep.equal( title3queries );
    } );


    it( "failed prepare", async () => {

      await tmdb.prepareTitles( [ badtitle1 ] ); 

      expect( badtitle1.tmdb.queries ).to.be.an("array")
        .to.have.lengthOf( 0 );

    } );


    it( "execute 1 - match", async () => {

      await tmdb.executeQueries( title1 );

      expect( title1.tmdb.results )
        .to.be.an( "object" )
        .to.have.all.keys( "searchMovie" );

      expect( mockDb.get( "searchMovie" ).value() )
        .to.be.an('array')
        .to.have.lengthOf.at.least(1);

      expect( mockDb.get( "searchMovie" ).value()[0] )
        .to.deep.include( { "id": 9438 } );

    } );


    it( "execute 1 - cache hit", async () => {

      delete title1.tmdb.results["searchMovie"];

      var spy1 = sinon.spy( mockDb, 'get' );

      await tmdb.executeQueries( title1 );

      expect( title1.tmdb.results )
        .to.be.an( "object" )
        .to.have.all.keys( "searchMovie" );

      expect( mockDb.get( "searchMovie" ).value() )
        .to.be.an('array')
        .to.have.lengthOf.at.least(1);

      sinon.assert.calledTwice( spy1 );

    } );


    it( "cache flush", async () => { 

      mockDb.get( "searchMovie" )
        .each( (t) => { t["fetchTime"] = ( Date.now() - ( 40 * 86400 * 1000 ) ) } )
        .write();

      expect( mockDb.get( "searchMovie" ).value()[0] )
        .to.be.an('object')
        .to.deep.include( { name_clean: "mr. magoo" } )

      tmdb.flushCache();

      expect( mockDb.get( "searchMovie" ).value() )
        .to.be.an('array')
        .to.be.length(0);

    } );


    it( "execute 2 - search - no match", async () => {

      await tmdb.executeQueries( title2 );

      expect( title2.tmdb.results )
        .to.be.an( "object" );

      expect( Object.keys( title2.tmdb.results ) )
        .to.have.lengthOf( 0 );

    } );


    it( "execute 3 - tv match", async () => {

      await tmdb.executeQueries( title3 );

      expect( mockDb.get( "searchTv" ).value() )
        .to.be.an('array')
        .to.have.lengthOf.at.least(1);

      expect( mockDb.get( "searchTv" ).value()[0] )
        .to.deep.include( { "id": 1996 } );

      expect( title3.meta )
        .to.be.an( "object" )
        .to.deep.include( { name: "The Flintstones", year: '1960', episode_name: 'The Flintstone Flyer' } );
    } );


    it( "execute 3 - default metadata", async () => { 

      // Cleanup
      title3.tmdb.queries = [];
      title3.tmdb.results = {};
      title3.meta = {};

      await tmdb.executeQueries( title3 );
      expect( title3.meta )
        .to.be.an( "object" )
        .to.deep.include( { 'name': 'The Flintstones', 'name_clean': 'the flintstones', 'episode_number': 1, 'season_number': 1 } );

    } );

  } );

} );


