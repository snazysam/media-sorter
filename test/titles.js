

import * as assert from 'assert';
import chai from 'chai';
import chaiFiles from 'chai-files';
import Proxyquire from 'proxyquire';
import sinon from 'sinon';
import low from 'lowdb';
import tmp from 'tmp';
import fs from 'fs';
import path from 'path';

const proxyquire = Proxyquire.noCallThru();

const expect = chai.expect;

chai.use(chaiFiles);


tmp.setGracefulCleanup();


describe("Title processing -", function() {

  var config, configClass;
  var titles, titlesClass;
  var logStub;
  var titles;
  var testimage;
  var cwd = process.cwd();

  var movtitles = [ 
    {
      dir: cwd + '/test/testfiles/movies',
      full: cwd + '/test/testfiles/movies/The House on Haunted Hill.mp4',
      name: 'The House on Haunted Hill',
      type: 'video',
      ext: 'mp4',
      subs: [],
      images: [],
      meta: {} },
    { dir: cwd + '/test/testfiles/movies/Jungle Book 1942',
      full: cwd + '/test/testfiles/movies/Jungle Book 1942/Jungle Book.avi',
      name: 'Jungle Book',
      type: 'video',
      ext: 'avi',
      subs: [],
      images: [],
      meta: {} },
    { dir: cwd + '/test/testfiles/movies',
      full: cwd + '/test/testfiles/movies/suddenly.1954.copy.mp4',
      name: 'suddenly.1954.copy',
      type: 'video',
      ext: 'mp4',
      subs: [],
      images: [],
      meta: {} },
    { dir: cwd + '/test/testfiles/movies/D.O.A 1950',
      full: cwd + '/test/testfiles/movies/D.O.A 1950/D.O.A 1950.mp4',
      name: 'D.O.A 1950',
      type: 'video',
      ext: 'mp4',
      subs: [],
      images: [],
      meta: {}
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
      meta: {} },
    { dir: cwd + '/test/testfiles/tv/I Married Joan 1952/Season 1',
      full: cwd + '/test/testfiles/tv/I Married Joan 1952/Season 1/1-pilot.avi',
      name: '1-pilot',
      type: 'video',
      ext: 'avi',
      subs: [],
      images: [],
      meta: {} },
    { dir: cwd + '/test/testfiles/tv/I Married Joan 1952/Season 1',
      full: cwd + '/test/testfiles/tv/I Married Joan 1952/Season 1/2 - career.avi',
      name: '2 - career',
      type: 'video',
      ext: 'avi',
      subs: [],
      images: [],
      meta: {} },
    { dir: cwd + '/test/testfiles/tv/I Married Joan 1952/Season 2',
      full: cwd + '/test/testfiles/tv/I Married Joan 1952/Season 2/1.foo.avi',
      name: '1.foo',
      type: 'video',
      ext: 'avi',
      subs: [],
      images: [],
      meta: {} },
    { dir: cwd + '/test/testfiles/tv/My_Little_Margie',
      full: cwd + '/test/testfiles/tv/My_Little_Margie/s01e01_pilot_reverse_psychology.avi',
      name: 's01e01_pilot_reverse_psychology',
      type: 'video',
      ext: 'avi',
      subs: [],
      images: [],
      meta: {} },
    { dir: cwd + '/test/testfiles/tv/The Lucy Show',
      full: cwd + '/test/testfiles/tv/The Lucy Show/1x1-lucy-waits-up-for-chris.mp4',
      name: '1x1-lucy-waits-up-for-chris',
      type: 'video',
      ext: 'mp4',
      subs: [],
      images: [],
      meta: {} },
    { dir: cwd + '/test/testfiles/tv/The Lucy Show/Specials',
      full: cwd + '/test/testfiles/tv/The Lucy Show/Specials/0x7_lucy_in_london.avi',
      name: '0x7_lucy_in_london',
      type: 'video',
      ext: 'avi',
      subs: [],
      images: [],
      meta: {} },
    { dir: cwd + '/test/testfiles/tv',
      full: cwd + '/test/testfiles/tv/petticoat.junction.s01e07.the.ringer.avi',
      name: 'petticoat.junction.s01e07.the.ringer',
      type: 'video',
      ext: 'avi',
      subs: [],
      images: [],
      meta: {} },
  ];

  after(function() {
    config = null;
  } );


  before(function () {

    // Create fake logger
    logStub = function(){
      return {
        'debug': function( ...t ){ },
        'silly': function( ...t ){ },
        'error': function( ...t ){ },
        'info': function( ...t ){ },
        'level': function() {}
      }
    };

    // Use mock logger instead
    titlesClass = proxyquire('../lib/titlesmanager.js', { 
      './logger.js': logStub,
    }).default;
    configClass = proxyquire( '../lib/config.js', {
      './logger.js': logStub
    }).default;


    config = new configClass();
    config.load();
    titles = new titlesClass( config );


  });


  describe( "Title parsing - ", function() {

    // All movies in one go

    it( "movie titles", async () => {

      var title1 = movtitles.find( (a) => a.name == "The House on Haunted Hill" );
      var title2 = movtitles.find( (a) => a.name == "Jungle Book" );
      var title3 = movtitles.find( (a) => a.name == "suddenly.1954.copy" );
      var title4 = movtitles.find( (a) => a.name == "D.O.A 1950" );

      await titles.parseTitles( [ title1, title2, title3, title4 ] );

      expect( title1 ).to.be.an( "object" )
        .to.deep.include( { mediatype: "movie", pieces: { name: "the house on haunted hill" } } );

      expect( title2 ).to.be.an( "object" )
        .to.deep.include( { mediatype: "movie", pieces: { name: "jungle book", year: 1942 } } );

      expect( title3 ).to.be.an( "object" )
        .to.deep.include( { mediatype: "movie", pieces: { name: "suddenly", year: 1954 } } );

      expect( title4 ).to.be.an( "object" )
        .to.deep.include( { mediatype: "movie", pieces: { name: "d.o.a", year: 1950 } } );

    } );


    it( "tv titles", async () => {

      var title1 = tvtitles.find( (a) => /I Married Joan 1952\/Season 1\/1-pilot.avi/.test( a.full ) );
      var title2 = tvtitles.find( (a) => /I Married Joan 1952\/Season 1\/2 - career.avi/.test( a.full ) );
      var title3 = tvtitles.find( (a) => /I Married Joan 1952\/Season 1\/03_-_Ballet.avi/.test( a.full ) );
      var title4 = tvtitles.find( (a) => /I Married Joan 1952\/Season 2\/1.foo.avi/.test( a.full ) );
      var title5 = tvtitles.find( (a) => /My_Little_Margie\/s01e01_pilot_reverse_psychology.avi/.test( a.full ) );
      var title6 = tvtitles.find( (a) => /The Lucy Show\/1x1-lucy-waits-up-for-chris.mp4/.test( a.full ) );
      var title7 = tvtitles.find( (a) => /The Lucy Show\/Specials\/0x7_lucy_in_london.avi/.test( a.full ) );
      var title8 = tvtitles.find( (a) => /petticoat.junction.s01e07.the.ringer.avi/.test( a.full ) );

      await titles.parseTitles( [ title1, title2, title3, title4, title5, title6, title7, title8 ] );

      expect( title1 ).to.be.an( "object" )
        .to.deep.include( { mediatype: "tv", pieces: { name: "i married joan", year: 1952, episode: 1, season: 1 } } );

      expect( title2 ).to.be.an( "object" )
        .to.deep.include( { mediatype: "tv", pieces: { name: "i married joan", year: 1952, episode: 2, season: 1 } } );

      expect( title3 ).to.be.an( "object" )
        .to.deep.include( { mediatype: "tv", pieces: { name: "i married joan", year: 1952, episode: 3, season: 1 } } );

      expect( title4 ).to.be.an( "object" )
        .to.deep.include( { mediatype: "tv", pieces: { name: "i married joan", year: 1952, episode: 1, season: 2 } } );

      expect( title5 ).to.be.an( "object" )
        .to.deep.include( { mediatype: "tv", pieces: { name: "my little margie", episode: 1, season: 1 } } );

      expect( title6 ).to.be.an( "object" )
        .to.deep.include( { mediatype: "tv", pieces: { name: "the lucy show", episode: 1, season: 1 } } );

      expect( title7 ).to.be.an( "object" )
        .to.deep.include( { mediatype: "tv", pieces: { name: "the lucy show", season: 0, episode: 7 } } );

      expect( title8 ).to.be.an( "object" )
        .to.deep.include( { mediatype: "tv", pieces: { name: "petticoat junction", episode: 7, season: 1 } } );

    } );

    it( "failed parsing", async () => {

      var title1 = movtitles.find( (a) => a.name == "The House on Haunted Hill" );

      // Cleanup old info
      delete title1.parsed;
      delete title1.pieces;
      delete title1.mediatype;

      // Set mediatype to TV
      config.set( "mediatype", "tv" );

      await titles.parseTitles( [ title1 ] );

      expect( title1 ).to.be.an( "object" )
        .to.deep.include( { parsed: false } )
        .to.not.have.any.keys( 'mediatype', 'pieces' );

    } );

  });

});


