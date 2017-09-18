
import Logger from './lib/logger.js';
import Sorter from './lib/sorter.js';
import Config from './lib/config.js';

import path from 'path';
import fs from 'fs';

// Get logger and send to file
const log = new Logger( '::main' );
log.logToFile(  path.join( __dirname, '..', 'log', 'media-sort.log' ) );


// Attempt to load configuration before the sorter does
var config;
try {
  config = new Config();
  config.load();
  if ( config.get( 'help' ) ) {
    config.usage();
    process.exit( 0 );
  }
  config.validate({allowed: 'strict'});
}
catch( e ) {
  log.error( "Failed to load or validate configuration: " + e.message );
  config.usage();
  process.exit( 1 );
}

if ( config.get( 'help' ) ) {
  config.usage();
  process.exit( 0 );
}

const sorter = new Sorter();

// Check access to the paths
log.debug( "Checking target path..." );
console.log( config.get( 'target' ) );
var resolved = path.resolve( config.get( 'target' ) );
fs.accessSync( resolved );

log.debug( "Checking source path..." );
resolved = path.resolve( config.get( 'path' ) );
fs.accessSync( resolved );

// Run the sort
sorter.sortAll()
  .then( () => { log.info( "Finished" ) } );


