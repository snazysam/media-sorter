
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


// Always cleanup temp files
tmp.setGracefulCleanup();



describe("Unpacking - ", function() {

  var config;
  var configClass;
  var logStub;
  var archivesClass;
  var archives;
  var cwd;
  var tmpdir1, tmpdir2, tmpdir3, tmpdir4;

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
        'level': function(){}
      }
    };

    // Use mock logger instead
    archivesClass = proxyquire('../lib/archivemanager.js', { 
      './logger.js': logStub,
    }).default;
    configClass = proxyquire( '../lib/config.js', {
      './logger.js': logStub
    }).default;

    config = new configClass();
    config.load();
    archives = new archivesClass( config );

    tmpdir1 = tmp.dirSync( { unsafeCleanup: true } );
    tmpdir2 = tmp.dirSync( { unsafeCleanup: true } );
    tmpdir3 = tmp.dirSync( { unsafeCleanup: true } );
    tmpdir4 = tmp.dirSync( { unsafeCleanup: true } );

    cwd = process.cwd();
  });


  describe( "Extraction -", function() {

    it( "directory - nested archive", async () => {

      fs.copyFileSync( cwd + "/test/testfiles/test123.rar", tmpdir1.name + "/foo.rar" );

      await archives.extractAll( tmpdir1.name );

      // Zip archive extracted from RAR
      expect( chaiFiles.file( tmpdir1.name + "/foo/test123.zip" ) ).to.exist;

      // Nested zip contents
      expect( chaiFiles.file( tmpdir1.name + "/foo/test123/test123.avi" ) ).to.exist;        


    } );

    it( "file - nested archive", async () => {

      fs.copyFileSync( cwd + "/test/testfiles/test123.rar", tmpdir2.name + "/bar.rar" );

      await archives.extractAll( tmpdir2.name + "/bar.rar" )

      // Zip archive extracted from RAR
      expect( chaiFiles.file( tmpdir2.name + "/bar/test123.zip" ) ).to.exist;

      // Nested zip contents
      expect( chaiFiles.file( tmpdir2.name + "/bar/test123/test123.avi" ) ).to.exist;        

    } );

  } );


  describe( "Cleanup -", function() {

    it( "all archives", async () => {

      await archives.cleanup() 

      expect( chaiFiles.file( tmpdir2.name + "/bar/" ) ).to.not.exist;

    } );

  } );


  describe( "Bad archives -", function() {

    it( "file - bad rar archive", async () => {

      fs.copyFileSync( cwd + "/test/testfiles/badarchive.rar", tmpdir3.name + "/bad.rar" );

      var shouldfail = archives.extractAll( tmpdir3.name + "/bad.rar" );

      assert.rejects( shouldfail );

    } );

    it( "file - bad zip archive", async () => {

      fs.copyFileSync( cwd + "/test/testfiles/badarchive.zip", tmpdir4.name + "/bad.zip" );

      var shouldfail = archives.extractAll( tmpdir4.name + "/bad.zip" );

      assert.rejects( shouldfail );

    } );

  } );

} );


