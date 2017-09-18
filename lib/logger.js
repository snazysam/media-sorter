

import winston from 'winston';
import util from 'util';
import path from 'path';
import us from 'lodash';


let loginst = undefined;


class Logger {

  constructor( namespace ) {

    if ( ! loginst )
      this.setupLog();

    this.namespace = namespace;
  }

  // Setup a winston handle
  setupLog() {

    loginst = new winston.Logger({
      exitOnError: false,
      level: process.env.LOG_MODE || 'info',
      transports: [ ]
    });

    loginst.add( winston.transports.Console, {
      'colorize': true,
      'prettyPrint': true,
      'debugStdout': true
    });

  }


  // Add a file or stream log transport
  logToFile( outThing ) {

    var conf = {};

    if ( typeof outThing == "string" ) {
      conf[ 'name' ] = 'file-out';
      conf[ 'json' ] = false;
      conf[ 'filename' ] = outThing;
    }
    else {
      conf[ 'name' ] = 'stream-out';
      conf[ 'json' ] = true;
      conf[ 'stream' ] = outThing;
    }

    if ( loginst._names.indexOf( conf[ 'name' ] ) != -1 )
      loginst.remove( 'file-out' );
    loginst.add( winston.transports.File, conf );
  }


  // -------------------------
  // Wrap methods
  // -------------------------

  // Error logging
  error(...args) {
    loginst.error( this.namespace, ...args );
  }

  // Warning logging
  warn(...args) {
    loginst.warn( this.namespace, ...args );
  }

  // Info logging
  info(...args) {
    loginst.info( this.namespace, ...args );
  }

  // Debug logging
  debug(...args) {
    loginst.debug( this.namespace, ...args );
  }

  // Silly logging
  silly(...args) {
    loginst.silly( this.namespace, ...args );
  }

  // Generic log
  log(...args) {
    loginst.log( this.namespace, ...args );
  }

  // Use a specific namespace
  logWithNamespace( namespace, ...args ) {
    loginst.log( namespace, ...args );
  }

  // Change the log level
  level( lvl ) {
    loginst.level = lvl;
  }

}

export default Logger;
 

