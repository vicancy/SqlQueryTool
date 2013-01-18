CodeMirror.defineMode("sql", function(config, parserConfig) {
  "use strict";

  var client         = parserConfig.client || {},
      atoms          = parserConfig.atoms || {"false": true, "true": true, "null": true},
      builtin        = parserConfig.builtin || {},
      keywords       = parserConfig.keywords,
      operatorChars  = /^[*+\-%<>!=&|~^]/,
      hooks          = parserConfig.hooks || {},
      dateSQL        = parserConfig.dateSQL || {"date" : true, "time" : true, "timestamp" : true};

  function tokenBase(stream, state) {
    var ch = stream.next();

    if (hooks[ch]) {
      var result = hooks[ch](stream, state);
      if (result !== false) return result;
    }

    if ((ch == "0" && stream.match(/^[xX][0-9a-fA-F]+/))
	|| (ch == "x" || ch == "X") && stream.match(/^'[0-9a-fA-F]+'/)) {
      // hex
      return "number";
    } else if (((ch == "b" || ch == "B") && stream.match(/^'[01]+'/))
	       || (ch == "0" && stream.match(/^b[01]+/))) {
      // bitstring
      return "number";
    } else if (ch.charCodeAt(0) > 47 && ch.charCodeAt(0) < 58) {
      // numbers
      stream.match(/^[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/);
      return "number";
    } else if (ch == "?" && (stream.eatSpace() || stream.eol() || stream.eat(";"))) {
      // placeholders
      return "variable-3";
    } else if (ch == '"' || ch == "'") {
      // strings
      state.tokenize = tokenLiteral(ch);
      return state.tokenize(stream, state);
    } else if (/^[\(\),\.;\[\]]/.test(ch)) {
      return null;
    } else if (ch == "#" || (ch == "-" && stream.eat("-") ))//&& stream.eat(" "))) 
	{
      // 1-line comments
	  stream.skipToEnd();
      return "comment";
    } else if (ch == "/" && stream.eat("*")) {
      // multi-line comments
      state.tokenize = tokenComment;
      return state.tokenize(stream, state);
    } else if (operatorChars.test(ch)) {
      stream.eatWhile(operatorChars);
      return false;
    } else if (ch == '{' &&
        (stream.match(/^( )*(d|D|t|T|ts|TS)( )*'[^']*'( )*}/) || stream.match(/^( )*(d|D|t|T|ts|TS)( )*"[^"]*"( )*}/))) {
      // dates (weird ODBC syntax)
      return "number";
    } else {
      stream.eatWhile(/^[_\w\d]/);
      var word = stream.current().toLowerCase();
      // dates (standard SQL syntax)
      if (dateSQL.hasOwnProperty(word) && (stream.match(/^( )+'[^']*'/) || stream.match(/^( )+"[^"]*"/)))
        return "number";
      if (atoms.hasOwnProperty(word)) return "atom";
      if (builtin.hasOwnProperty(word)) return "builtin";
      if (keywords.hasOwnProperty(word)) return "keyword";
      if (client.hasOwnProperty(word)) return "string-2";
      return "variable";
    }
  }

  function tokenLiteral(quote) {
    return function(stream, state) {
      var escaped = false, ch;
      while ((ch = stream.next()) != null) {
	if (ch == quote && !escaped) {
	  state.tokenize = tokenBase;
	  break;
	}
	escaped = !escaped && ch == "\\";
      }
      return "string";
    };
  }
  function tokenComment(stream, state) {
    while (true) {
      if (stream.skipTo("*")) {
	stream.next();
	if (stream.eat("/")) {
	  state.tokenize = tokenBase;
	  break;
	}
      } else {
	stream.skipToEnd();
	break;
      }
    }
    return "comment";
  }

  function pushContext(stream, state, type) {
    state.context = {
      prev: state.context,
      indent: stream.indentation(),
      col: stream.column(),
      type: type
    };
  }

  function popContext(state) {
    state.indent = state.context.indent;
    state.context = state.context.prev;
  }

  return {
    startState: function() {
      return {tokenize: tokenBase, context: null};
    },

    token: function(stream, state) {
      if (stream.sol()) {
	if (state.context && state.context.align == null)
	  state.context.align = false;
      }
      if (stream.eatSpace()) return null;

      var style = state.tokenize(stream, state);
      if (style == "comment") return style;

      if (state.context && state.context.align == null)
	state.context.align = true;

      var tok = stream.current();
      if (tok == "(")
        pushContext(stream, state, ")");
      else if (tok == "[")
        pushContext(stream, state, "]");
      else if (state.context && state.context.type == tok)
        popContext(state);
      return style;
    },

    indent: function(state, textAfter) {
      var cx = state.context;
      if (!cx) return CodeMirror.Pass;
      if (cx.align) return cx.col + (textAfter.charAt(0) == cx.type ? 0 : 1);
      else return cx.indent + config.indentUnit;
    }
  };
});

(function() {
  "use strict";

  function hookIdentifier(stream) {
    var escaped = false, ch;

    while ((ch = stream.next()) != null) {
      if (ch == "`" && !escaped) return "variable-2";
      escaped = !escaped && ch == "`";
    }
    return false;
  }

  // variable token
  function hookVar(stream) {
    // variables
    // @@ and prefix
    if (stream.eat("@")) {
      stream.match(/^session\./);
      stream.match(/^local\./);
      stream.match(/^global\./);
    }

    if (stream.eat("'")) {
      stream.match(/^.*'/);
      return "variable-2";
    } else if (stream.eat('"')) {
      stream.match(/^.*"/);
      return "variable-2";
    } else if (stream.eat("`")) {
      stream.match(/^.*`/);
      return "variable-2";
    } else if (stream.match(/^[0-9a-zA-Z$\.\_]+/)) {
      return "variable-2";
    }
    return false;
  };

  // short client keyword token
  function hookClient(stream) {
    // \g, etc
    return stream.match(/^[a-zA-Z]\b/) ? "variable-2" : false;
  }

  //var sqlKeywords = "alter and as asc between by count create delete desc distinct drop from having in insert into is join like not on or order select set table union update values where ";
  //make sure to use lowercase, from http://msdn.microsoft.com/en-us/library/ms189822(v=sql.100).aspx
  var sqlReservedKeywordsForSqlServer2008 = "add exists precision all exit primary alter external print and fetch proc any file procedure as fillfactor public asc for raiserror authorization foreign read backup freetext readtext begin freetexttable reconfigure between from references break full replication browse function restore bulk goto restrict by grant return cascade group revert case having revoke check holdlock right checkpoint identity rollback close identity_insert rowcount clustered identitycol rowguidcol coalesce if rule collate in save column index schema commit inner securityaudit compute insert select constraint intersect session_user contains into set containstable is setuser continue join shutdown convert key some create kill statistics cross left system_user current like table current_date lineno tablesample current_time load textsize current_timestamp merge then current_user national to cursor nocheck top database nonclustered tran dbcc not transaction deallocate null trigger declare nullif truncate default of tsequal delete off union deny offsets unique desc on unpivot disk open update distinct opendatasource updatetext distributed openquery use double openrowset user drop openxml values dump option varying else or view end order waitfor errlvl outer when escape over where except percent while exec pivot with execute plan writetext ";
  //var sqlReservedKeywordsForSqlServer2012 = "add external procedure all fetch public alter file raiserror and fillfactor read any for readtext as foreign reconfigure asc freetext references authorization freetexttable replication backup from restore begin full restrict between function return break goto revert browse grant revoke bulk group right by having rollback cascade holdlock rowcount case identity rowguidcol check identity_insert rule checkpoint identitycol save close if schema clustered in securityaudit coalesce index select collate inner semantickeyphrasetable column insert semanticsimilaritydetailstable commit intersect semanticsimilaritytable compute into session_user constraint is set contains join setuser containstable key shutdown continue kill some convert left statistics create like system_user cross lineno table current load tablesample current_date merge textsize current_time national then current_timestamp nocheck to current_user nonclustered top cursor not tran database null transaction dbcc nullif trigger deallocate of truncate declare off try_convert default offsets tsequal delete on union deny open unique desc opendatasource unpivot disk openquery update distinct openrowset updatetext distributed openxml use double option user drop or values dump order varying else outer view end over waitfor errlvl percent when escape pivot where except plan while exec precision with execute primary within group exists print writetext exit proc ";

  function set(str) {
    var obj = {}, words = str.split(" ");
    for (var i = 0; i < words.length; ++i) obj[words[i]] = true;
    return obj;
  }

  CodeMirror.defineMIME("text/x-sql", {
    name: "sql",
    keywords: set(sqlReservedKeywordsForSqlServer2008),
    builtin: set("bool boolean bit blob enum long longblob longtext medium mediumblob mediumint mediumtext time timestamp tinyblob tinyint tinytext text bigint int int1 int2 int3 int4 int8 integer float float4 float8 double char varbinary varchar varcharacter nvarchar ntext text precision real date datetime year unsigned signed decimal numeric"),
    atoms: set("false true null unknown"),
    dateSQL: set("date time timestamp")
  });

}());
