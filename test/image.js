
import MockRes from 'mock-res';

import * as assert from 'assert';
import chai from 'chai';
import chaiSubset from 'chai-subset';
import Proxyquire from 'proxyquire';
import sinon from 'sinon';
import tmp from 'tmp';
import fs from 'fs';
import path from 'path';

const proxyquire = Proxyquire.noCallThru();

const should = chai.should();
const expect = chai.expect;

chai.use( chaiSubset );


describe("Image - ", function() {
  
  var logStub, wrapStub, getStub, config, configClass, image, imageClass, filesClass;

  var response1 = new MockRes();
  var response2 = new MockRes();
  var response3 = new MockRes();
  response3.statusCode = 404;

  var testtitle1 = { 
    dir: 'test/testfiles/tv/I Married Joan 1952/Season 1',
    full: 'test/testfiles/tv/I Married Joan 1952/Season 1/03_-_Ballet.avi',
    name: '03_-_Ballet',
    type: 'video',
    ext: 'avi',
    subs: [],
    images: [],
    meta: {},
    mediatype: "tv",
    meta: {
      'fanart_url': "resp1.jpg",
      'name': 'I Married Joan'
    }
  };

  var testtitle2 = { 
    dir: 'test/testfiles/tv/I Married Joan 1952/Season 1',
    full: 'test/testfiles/tv/I Married Joan 1952/Season 1/1-pilot.avi',
    name: '1-pilot',
    type: 'video',
    ext: 'avi',
    subs: [],
    images: [],
    meta: {},
    mediatype: "tv",
    meta: {
      'fanart_url': "resp2.png",
      'poster_url': "resp2.png",
      'name': 'I Married Joan'
    }
  };

  var testtitle3 = {
    dir: 'test/testfiles/tv/I Married Joan 1952/Season 2',
    full: 'test/testfiles/tv/I Married Joan 1952/Season 2/1.foo.avi',
    name: '1.foo',
    type: 'video',
    ext: 'avi',
    subs: [],
    images: [],
    meta: {},
    mediatype: "tv",
    meta: {
      'season_poster_url': "err1.jpg",
      'season_number': 2,
      'name': 'I Married Joan'
    }
  };


  var testtitle4 = {
    dir: 'test/testfiles/tv/I Married Joan 1952/Season 2',
    full: 'test/testfiles/tv/I Married Joan 1952/Season 2/1.foo.avi',
    name: '1.foo',
    type: 'video',
    ext: 'avi',
    subs: [],
    images: [],
    meta: {},
    mediatype: "tv",
    meta: {
      'season_poster_url': "notfound.jpg",
      'season_number': 2,
      'name': 'I Married Joan'
    }
  };

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
        'level': function( ...t ){}
      }
    };

    var testpng = "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mPUk1v/n4EIwDiqkL4KATQQE8/xlbLIAAAAAElFTkSuQmCC";

    // Setup responses
    response1.write( Buffer.from( testpng, 'base64' ) );
    response1.end();
    response2.write( Buffer.from( testpng, 'base64' ) );
    response2.end();

    // Create HTTP stubs
    getStub = sinon.stub();
    getStub.withArgs( "resp1.jpg" ).returns( { statusCode: "200", buffer: response1 } );
    getStub.withArgs( "resp2.png" ).returns( { statusCode: "200", buffer: response2 } );
    getStub.withArgs( "err1.jpg" ).returns( new Error( "Test" ) );
    getStub.withArgs( "notfound.jpg" ).returns( response3 );
    wrapStub = { get: getStub };

    // Use mocks
    filesClass = proxyquire('../lib/filesmanager.js', { 
      './logger.js': logStub,
    });

    imageClass = proxyquire('../lib/imagemanager.js', { 
      './logger.js': logStub,
      './filesmanager.js': filesClass,
      'simple-get-promise': wrapStub
    }).default;

    configClass = proxyquire( '../lib/config.js', {
      './logger.js': logStub
    }).default;

    config = new configClass();
    config.load();
    image = new imageClass( config );

    // Enable image processing
    config.set( 'images', [ 'show-backdrop', 'show-poster', 'season-poster', 'episode-still', 'movie-backdrop', 'movie-poster' ] );

  });

  describe( "Fetching -", function() {

    it( "fetch1", async () => {

      await image.fetchImages( testtitle1 );

      expect( testtitle1 )
        .to.include.keys( [ "images" ] );

      expect( testtitle1.images )
        .to.be.an( 'array' )
        .to.have.lengthOf( 1 );

      expect( testtitle1.images[0] )
        .to.have.all.keys( "type", "full", "ext" );

      expect( testtitle1.images[0].ext )
        .to.be.equal( "jpg" );

      expect( testtitle1.images[0].type )
        .to.be.equal( "show-backdrop" );

      expect( testtitle1.images[0].full )
        .to.be.a( "string" );
    } );


    it( "fetch2", async () => {

      await image.fetchImages( testtitle2 );

      expect( testtitle2 )
        .to.include.keys( [ "images" ] );

      expect( testtitle2.images )
        .to.be.an( 'array' )
        .to.have.lengthOf( 2 );

      expect( testtitle2.images[0] )
        .to.deep.include.keys( "type", "full", "ext" );

      expect( testtitle2.images[1] )
        .to.deep.include.keys( "type", "full", "ext" );

      expect( testtitle2.images[0].ext )
        .to.be.equal( "png" );

      expect( testtitle2.images[1].ext )
        .to.be.equal( "png" );

      expect( testtitle2.images[0].type )
        .to.be.equal( "show-backdrop" );

      expect( testtitle2.images[1].type )
        .to.be.equal( "show-poster" );
    } );


    it( "fail fetch 1", async () => {

      var r = image.fetchImages( testtitle3 );

      assert.rejects( r );

    } );


    it( "fail fetch 2", async () => {

      var r = image.fetchImages( testtitle4 );

      assert.rejects( r );

    } );

  } );

} );


