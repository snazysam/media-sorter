
import Logger from './logger.js';


const log = new Logger( '::titles' );


// TODO: Externalise these somewhere
const regexes = [
  // File "show name 1999 s01e01" or "show name (1999) 1x02"
  { id: 1, type: "tv", matches: "name", reg: /^(.+?)[ ._-]+[\(\[]?((?:19|20)[0-9]{2})[\)\]]?[ ._-]+s?([0-9]{1,2})?[ex]([0-9]{1,2})/i,
    captures: [ "name", "year", "season", "episode" ], hint: /\d{4}/ },

  // File "show name s01e01" or "show name 1x02"
  { id: 2, type: "tv", matches: "name", reg: /^(.+?)[ ._-]+s?([0-9]{1,2})[ex]([0-9]{1,2})/i,
    captures: [ "name", "season", "episode" ] }, 

  // File and directory "show name 2000/specials/2 - title"
  { id: 3, type: "tv", matches: "full", reg: /^.*\/(.+?)[ ._-][\(\[]?((?:19|20)[0-9]{2})[\)\]]?\/specials\/s?([0-9]{1,2})?[ex]([0-9]{1,3})/i,
    captures: [ "name", "year", "season", "episode" ], hint: /specials/i },

  // File and directory "show name/specials/2 - title"
  { id: 4, type: "tv", matches: "full", reg: /^.*\/(.+?)\/specials\/s?([0-9]{1,2})?[ex]([0-9]{1,3})/i,
    captures: [ "name", "season", "episode" ], hint: /specials/i }, 

  // File and directory "show name 1999/s01e02" or "show name (1999)/1x2 foo"
  { id: 5, type: "tv", matches: "full", reg: /^.*\/(.+?)[ ._-][\(\[]?((?:19|20)[0-9]{2})[\)\]]?\/s?([0-9]{1,2})?[ex]([0-9]{1,2})/i,
    captures: [ "name", "year", "season", "episode" ], hint: /\d{4}/ },

  // File and directory "show name/s01e02" or "show name/1x2 foo"
  { id: 6, type: "tv", matches: "full", reg: /^.*\/(.+?)\/s?([0-9]{1,2})?[ex]([0-9]{1,2})/i,
    captures: [ "name", "season", "episode" ] }, 

  // File and directory "show name 1999/season 1/2 - title"
  { id: 7, type: "tv", matches: "full", reg: /^.*\/(.+)[ ._-][\(\[]?((?:19|20)[0-9]{2})[\)\]]?\/season[ ._-]?([0-9]{1,2}).*?\/.*?e?([0-9]{1,2})/i,
    captures: [ "name", "year", "season", "episode" ], hint: /season/i },

  // File and directory "show name/season 1/2 - title"
  { id: 8, type: "tv", matches: "full", reg: /^.*\/(.+)\/season[ ._-]?([0-9]{1,2}).*?\/([0-9]{1,2})/i,
    captures: [ "name", "season", "episode" ], hint: /season/i }, 

  // File and directory "show name 1999 - season 1/2 - title"
  { id: 9, type: "tv", matches: "full", reg: /^.*\/(.+)[ ._-][\(\[]?((?:19|20)[0-9]{2})[\)\]]?[ ._-]+season[ ._-]?([0-9]{1,2}).*?\/.*?e?([0-9]{1,2})/i,
    captures: [ "name", "year", "season", "episode" ], hint: /season/i },

  // File and directory "show name - season 1/2 - title"
  { id: 10, type: "tv", matches: "full", reg: /^.*\/(.+)[ ._-]+season[ ._-]?([0-9]{1,2}).*?\/.*?e?([0-9]{1,2})/i,
    captures: [ "name", "season", "episode" ], hint: /season/i },

  // File "movie name 1960"
  { id: 11, type: "movie", matches: "name", reg: /^(.+)[ ._-][\(\[]?((?:19|20)[0-9]{2})[\)\]]?/,
    captures: [ "name", "year" ] },

  // File and directory "movie name 1999/movie name"
  { id: 12, type: "movie", matches: "full", reg: /^.* ((?:19|20)[0-9]{2})\/(.+)\.\w+$/,
    captures: [ "year", "name" ] },

  // File "movie name"
  { id: 13, type: "movie", matches: "name", reg: /^(.+)$/, captures: [ "name" ] },
];


// How scraped fields are treated
const fieldTypes = {
  name: "string",
  year: "number",
  season: "number",
  episode: "number"
};



class TitlesManager {

  constructor( config, files ) {
    this.config = config;
    this.files = files;
  }

  /**
   * Parse found titles
   * @param {Object[]} titles - The titles to parse
   */
  parseTitles( titles ) {

    var mediatype = this.config.get( "mediatype" );

    titles.forEach( (title) => {

      log.silly( "Attempting to parse title", title.full );

      var rules, match, foundRegex, pieces = {};

      // Choose rules. For auto detection, use all rules
      if ( mediatype == "auto" )
        rules = regexes;
      else {
        // Otherwise by type
        rules = regexes.filter( (reg) => {
          return reg.type == mediatype;
        } );
      }

      // Try each regex looking for a match
      foundRegex = rules.find( (rule) => {
        var toTest = title[ rule.matches ];
        match = toTest.match( rule.reg );

        if ( match ) {
          log.silly( "Matched", title.name, "with regex", rule.id, ", type", rule.type );
          title.parsed = true;
          title.mediatype = rule.type;
          return true;
        }
      } );

      // If we have a match...
      if ( foundRegex != undefined ) {

        // Process captures
        foundRegex.captures.forEach( (name, idx) => {
          if ( fieldTypes[name] == "string" ) {
            // Always convert underscores to spaces, and make the title lower case ( important! )
            pieces[name] = match[idx + 1].replace( /[_]/g, " " ).toLowerCase();

            // Selectively convert hyphens to spaces
            if ( ! / /.test( title.name ) )
              pieces[name] = pieces[name].replace( /-/g, " " );

            // Selectively replace periods with spaces when no spaces exist in the name
            if ( ! / /.test( title.name ) )
              pieces[name] = pieces[name].replace( /\./g, " " );
          }
          else if ( fieldTypes[name] == "number" )
            pieces[name] = parseInt( match[idx + 1], 0 );

        } );
        log.silly( "Match pieces are", pieces );
        title.pieces = pieces;

        // Add a provided title if set
        if ( this.config.get( 'alttitle' ) != "" )
          title.pieces["altname"] = this.config.get( 'alttitle' );

        // Add a provided year if set
        if ( this.config.get( 'altyear' ) != '' )
          title.pieces["altyear"] = this.config.get( 'altyear' );
      }
      else { 
        title.parsed = false;
        log.debug( "Failed to match candidate", title.name );
      }
    } );

  }


  /**
   * Sort one title
   * @param {Object} title - The title to sort
   */
  sortTitle( title ) {

    var action = this.config.get( 'action' );

    switch( action ) {
      case "copy":
      case "link":
      case "revlink":
      case "symlink":
      case "move":
        this.files.fileAction( action, title );
        break;
      case "artwork":
        // FIXME: unimplemented
        this.files.artworkAction( title );
        break;
    };


  }

}


export default TitlesManager;

