(function () {
  function forEach(arr, f) {
    for (var i = 0, e = arr.length; i < e; ++i) f(arr[i]);
  }
  
  function arrayContains(arr, item) {
    if (!Array.prototype.indexOf) {
      var i = arr.length;
      while (i--) {
        if (arr[i] === item) {
          return true;
        }
      }
      return false;
    }
    return arr.indexOf(item) != -1;
  }

  function scriptHint(editor, keywords, getToken, options) {
    // Find the token at the cursor
    var cur = editor.getCursor(), token = getToken(editor, cur), tprop = token;
    // If it's not a 'word-style' token, ignore the token.
		if (!/^[\w$_]*$/.test(token.string)) {
      token = tprop = {start: cur.ch, end: cur.ch, string: "", state: token.state,
                       type: token.string == "." ? "column" : "table"};
    }
	//Peek to the previous token to see if it is time for a table
	//1. Begin of the line: Should not be --,
	//2. The nearest previous "/*, */" pair should not be /*,
	//3. The same line, "JOIN", "FROM", "," ahead
	//4. Or the above line, 
    // If it is a column, find out which table it belongs.
    
	  tprop = getToken(editor, {line: cur.line, ch: tprop.start});
	
	
    return {list: getCompletions(token, keywords, options),
            from: {line: cur.line, ch: token.start},
            to: {line: cur.line, ch: token.end}};
  }

  CodeMirror.sqlHint = function(editor, triggerToken, options) {
    
	var script = editor.getValue();
	var tokens = script.trim().split(/[\s]+/);
	//do as similar to the one in c#
	//TODO: Check if comes after "from"/ "join"
	
    return scriptHint(editor, tableSchema,
                      function (e, cur) {return e.getTokenAt(cur);},
                      options);
  };

  var tableSchema = "TraceDetail View_TraceDetail CTServiceApiDetail".split(" ");
  var columnSchema = "dt_time dt_id".split(" ");
 
  function getCompletions(token, keywords, options) {
    var found = [], start = token.string;
    function maybeAdd(str) {
      if (str.indexOf(start) == 0 && !arrayContains(found, str)) found.push(str);
    }
    
	if (token.type == "column") forEach(columnSchema, maybeAdd);
    else forEach(tableSchema, maybeAdd);
    
    return found;
  }
})();
