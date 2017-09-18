


import chai from 'chai';
import chaiSubset from 'chai-subset';
import Proxyquire from 'proxyquire';
import sinon from 'sinon';
import tmp from 'tmp';
import fs from 'fs';
import path from 'path';

const proxyquire = Proxyquire.noCallThru();

const expect = chai.expect;

chai.use( chaiSubset );


// Always cleanup temp files
tmp.setGracefulCleanup();


describe("File processing -", function() {

  var configClass;
  var config;
  var filesClass;
  var files;
  var logStub;
  var titles = [];
  var testimage;
  var cwd = process.cwd();

  var testpng = "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mPUk1v/n4EIwDiqkL4KATQQE8/xlbLIAAAAAElFTkSuQmCC";

  var movtitles = [ 
    {
      dir: cwd + '/test/testfiles/movies',
      full: cwd + '/test/testfiles/movies/The House on Haunted Hill.mp4',
      name: 'The House on Haunted Hill',
      type: 'video',
      ext: 'mp4',
      subs: [],
      images: [],
      strategy: "mixed",
      meta: {} },
    { dir: cwd + '/test/testfiles/movies/Jungle Book 1942',
      full: cwd + '/test/testfiles/movies/Jungle Book 1942/Jungle Book 1942.avi',
      name: 'Jungle Book 1942',
      type: 'video',
      ext: 'avi',
      subs: [],
      images: [],
      strategy: "alone",
      meta: {} },
    { dir: cwd + '/test/testfiles/movies',
      full: cwd + '/test/testfiles/movies/Suddenly 1954.mp4',
      name: 'Suddenly 1954',
      type: 'video',
      ext: 'mp4',
      subs: [],
      images: [],
      strategy: "mixed",
      meta: {} },
    { dir: cwd + '/test/testfiles/movies/D.O.A 1950',
      full: cwd + '/test/testfiles/movies/D.O.A 1950/D.O.A 1950.mp4',
      name: 'D.O.A 1950',
      type: 'video',
      ext: 'mp4',
      subs: [],
      images: [],
      meta: {},
      strategy: "alone"
    }
  ];

  var movsubs = [
    { dir: cwd + '/test/testfiles/movies',
      name: 'The House on Haunted Hill',
      ext: 'sub',
      full: cwd + '/test/testfiles/movies/The House on Haunted Hill.sub',
      type: 'sub' },
     { dir: cwd + '/test/testfiles/movies/Jungle Book 1942/Subs',
      name: 'en',
      ext: 'sub',
      full: cwd + '/test/testfiles/movies/Jungle Book 1942/Subs/en.sub',
      type: 'sub' },
     { dir: cwd + '/test/testfiles/movies/Jungle Book 1942/Subs',
      name: 'en',
      ext: 'idx',
      full: cwd + '/test/testfiles/movies/Jungle Book 1942/Subs/en.idx',
      type: 'sub' }
  ];


  var tvtitles = [
    { dir: cwd + '/test/testfiles/tv/I Married Joan 1952/Season 1',
      full: cwd + '/test/testfiles/tv/I Married Joan 1952/Season 1/03_-_Ballet.avi',
      name: '03_-_Ballet',
      type: 'video',
      ext: 'avi',
      subs: [],
      images: [],
      strategy: "mixed",
      meta: {} },
    { dir: cwd + '/test/testfiles/tv/I Married Joan 1952/Season 1',
      full: cwd + '/test/testfiles/tv/I Married Joan 1952/Season 1/1-pilot.avi',
      name: '1-pilot',
      type: 'video',
      ext: 'avi',
      subs: [],
      images: [],
      strategy: "mixed",
      meta: {} },
    { dir: cwd + '/test/testfiles/tv/I Married Joan 1952/Season 1',
      full: cwd + '/test/testfiles/tv/I Married Joan 1952/Season 1/2 - career.avi',
      name: '2 - career',
      type: 'video',
      ext: 'avi',
      subs: [],
      images: [],
      strategy: "mixed",
      meta: {} },
    { dir: cwd + '/test/testfiles/tv/I Married Joan 1952/Season 2',
      full: cwd + '/test/testfiles/tv/I Married Joan 1952/Season 2/1.foo.avi',
      name: '1.foo',
      type: 'video',
      ext: 'avi',
      subs: [],
      images: [],
      strategy: "alone",
      meta: {} },
    { dir: cwd + '/test/testfiles/tv/My_Little_Margie',
      full: cwd + '/test/testfiles/tv/My_Little_Margie/s01e01_pilot_reverse_psychology.avi',
      name: 's01e01_pilot_reverse_psychology',
      type: 'video',
      ext: 'avi',
      subs: [],
      images: [],
      strategy: "alone",
      meta: {} },
    { dir: cwd + '/test/testfiles/tv/The Lucy Show',
      full: cwd + '/test/testfiles/tv/The Lucy Show/1x1-lucy-waits-up-for-chris.mp4',
      name: '1x1-lucy-waits-up-for-chris',
      type: 'video',
      ext: 'mp4',
      subs: [],
      images: [],
      strategy: "mixed",
      meta: {} },
    { dir: cwd + '/test/testfiles/tv/The Lucy Show/Specials',
      full: cwd + '/test/testfiles/tv/The Lucy Show/Specials/0x7_lucy_in_london.avi',
      name: '0x7_lucy_in_london',
      type: 'video',
      ext: 'avi',
      subs: [],
      images: [],
      strategy: "alone",
      meta: {} },
    { dir: cwd + '/test/testfiles/tv',
      full: cwd + '/test/testfiles/tv/petticoat.junction.s01e07.the.ringer.avi',
      name: 'petticoat.junction.s01e07.the.ringer',
      type: 'video',
      ext: 'avi',
      subs: [],
      images: [],
      strategy: "mixed",
      meta: {} },
  ];

  after(function() {
    config = null;
  } );


  before(function () {

    // Create fake logger
    logStub = function(){
      return {
        'debug': function(...t){},
        'silly': function(...t){},
        'error': function(...t){},
        'info': function(...t){},
        'level': function(){}
      }
    };

    // Use mock logger instead
    filesClass = proxyquire('../lib/filesmanager.js', { 
      './logger.js': logStub,
    }).default;
    configClass = proxyquire( '../lib/config.js', {
      './logger.js': logStub
    }).default;


    config = new configClass();
    config.load();
    files = new filesClass( config );

    // Set formats
    config.set( 'tv-format', '#name#/Season #season_number#/#episode_number# - #episode_name#' );
    config.set( 'movie-format', '#name# (#year#)/#name#' );
    config.set( 'tv-sub-format', '#name#/Season #season_number#/#episode_number# - #episode_name#' );
    config.set( 'movie-sub-format', '#name# (#year#)/#name#' );
    config.set( 'tv-poster-format', '#name#/poster' );
    config.set( 'tv-season-poster-format', '#name#/Season #season_number#/poster' );
    config.set( 'tv-show-fanart-format', '#name#/fanart' );
    config.set( 'tv-still-format', '#name#/Season #season_number#/#episode_number# - #episode_name#' );
    config.set( 'movie-poster-format', '#name# (#year#)/#name#' );
    config.set( 'movie-fanart-format', '#name# (#year#)/fanart' );


  });


  describe( "Find Titles -", function( ){

    it( "search movie titles", function( done ) {

      var t;

      expect( () => { t = files.findTitles( path.resolve( "test/testfiles/movies" ) ) } )
        .to.not.throw();

      expect( t )
        .to.be.an( "array" )
        .to.be.length(4)
        .containSubset( movtitles );

      titles = titles.concat( t );

      done();

    });

    it( "search tv titles", function( done ) {

      var t;

      expect( () => { t = files.findTitles( path.resolve( "test/testfiles/tv" ) ) } )
        .to.not.throw();

      expect( t )
        .to.be.an( "array" )
        .to.be.length(8)
        .containSubset( tvtitles );

      titles = titles.concat( t );

      done();

    } );

  });

  describe( "Related subs - ", function() {

    it( "movie titles", function( done ) {

      var title1 = titles.find( (a) => a.name == "The House on Haunted Hill" );
      var title2 = titles.find( (a) => a.name == "Jungle Book 1942" );

      // Set mediatypes
      title1["mediatype"] = "movie";
      title2["mediatype"] = "movie";

      var t;

      expect( () => { t = files.locateSubs( [ title1, title2 ] ) } )
        .to.not.throw();

      expect( title1.subs ).to.be.an( "array" );
      expect( title2.subs ).to.be.an( "array" );

      expect( title1 ).to.be.an( "object" )
        .to.deep.include( { subs: [ movsubs[0] ] } );

      expect( title2 ).to.be.an( "object" )
        .to.deep.include( { subs: [ movsubs[1], movsubs[2] ] } );

      done();

    } );

  });


  describe( "Sorting - ", function() {

    var tmpdir, tvtitle, movtitle;

    before( function() {

      // Create a temporary image for testing
      var tmpfile = tmp.fileSync();
      var filestream = fs.createWriteStream( '', { "fd": tmpfile.fd } );
      filestream.write( Buffer.from( testpng, 'base64' ) );
      testimage = tmpfile.name;

      // Set target path
      tmpdir = tmp.dirSync( { unsafeCleanup: true } );
      config.set( "target", tmpdir.name );

    } );

    it( "movie title - destination", function(done) {

      var meta = {
        "meta": {
          "name": "Jungle Book",
          "year": 1942
        }
      };

      movtitle = titles.find( (a) => a.name == "Jungle Book 1942" );

      files.fileTargets( Object.assign( movtitle, meta ) );

      expect( movtitle.subs )
        .to.be.an( 'array' )
        .to.have.length( 2 );

      expect( movtitle.subs[0] )
        .to.be.an( 'object' )
        .to.include( { dest: "Jungle Book (1942)/Jungle Book.sub" } );

      expect( movtitle.subs[1] )
        .to.be.an( 'object' )
        .to.include( { dest: "Jungle Book (1942)/Jungle Book.idx" } );

      expect( movtitle )
        .to.be.an( 'object' )
        .to.include( { dest: "Jungle Book (1942)/Jungle Book.avi" } );

      done();

    } );

    it( "tv title - destination", function(done) {

      var image = {
        "images": [ {
          "type": "show-backdrop",
          "full": testimage,
          "ext": "jpg"
        } ]
      };

      var meta = {
        "meta": {
          "name": "I Married Joan",
          "year": 1952,
          "episode_name": "Ballet",
          "season_number": 1,
          "episode_number": 3
        }
      };

      tvtitle = titles.find( (a) => /I Married Joan 1952\/Season 1\/03_-_Ballet.avi/.test( a.full ) );

      // Set mediatypes
      tvtitle["mediatype"] = "tv";

      files.fileTargets( Object.assign( tvtitle, meta, image ) );

      expect( tvtitle )
        .to.be.an( 'object' )
        .to.include( { dest: "I Married Joan/Season 01/03 - Ballet.avi" } );

      expect( tvtitle["images"] )
        .to.be.an( 'array' )
        .to.have.length( 1 );

      expect (tvtitle["images"][0] )
        .to.be.an("object")
        .to.include( { "dest": "I Married Joan/fanart.jpg" } );

      done();

    } );

    it( "movie title - copy", function( done ) {

      expect( () => { files.fileAction( "copy", movtitle ) } )
        .to.not.throw();

      // Test video and subs
      expect( fs.accessSync( config.get( 'target' ) + "/" + movtitle.dest ) ).to.be.undefined;
      expect( fs.accessSync( config.get( 'target' ) + "/" + movtitle.subs[0].dest ) ).to.be.undefined;
      expect( fs.accessSync( config.get( 'target' ) + "/" + movtitle.subs[1].dest ) ).to.be.undefined;

      done();

    } );


    it( "tv title - pre-sort image", function( done ) {

      expect( files.imageExists( tvtitle, "show-backdrop" ) )
        .to.be.false;

      expect( files.imageExists( tvtitle, "show-backdrop" ) )
        .to.be.false;

      done();
    } );


    it( "tv title - symlink", function( done ) {

      expect( () => { files.fileAction( "symlink", tvtitle ) } )
        .to.not.throw();

      // Check video and test image
      expect( fs.accessSync( config.get( 'target' ) + "/"  + tvtitle.dest ) ).to.be.undefined;
      expect( fs.accessSync( config.get( 'target' ) + "/" + path.dirname( tvtitle.dest ) + "/../fanart.jpg" ) ).to.be.undefined;

      // Also cleanup files, for next test
      expect( fs.unlinkSync( config.get( 'target' ) + "/" + tvtitle.dest ) ).to.be.undefined;

      done();

    } );

    it( "tv title - hardlink", function( done ) {

      expect( () => { files.fileAction( "link", tvtitle ) } )
        .to.not.throw();

      // Check video
      expect( fs.accessSync( config.get( 'target' ) + "/" + tvtitle.dest ) ).to.be.undefined;

      done();

    } );


    it( "tv title - post-sort image", function( done ) {

      expect( files.imageExists( tvtitle, "show-backdrop" ) )
        .to.be.true;

      done();
    } );

  } );

});


