(function(){
  function isReservedWord(word) {
    var words = sqlReservedKeywordsForSqlServer2008.split(" ");
    return (words.indexOf(word) != -1);
  }
  
  function isHintForTableName(tokens, currentIndex) {
    if(tokens[i-1]==null) return false;
    if(tokens[i-1].toUpperCase()=="JOIN" ||tokens[i-1].toUpperCase()=="FROM" ||tokens[i-1].toUpperCase()==","){
	    //Current index is the last word
		return true;
	}
    return false;
  }
  
  function getPreviousValidToken(){
  
  }
})();