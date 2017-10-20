
/**
 * Module dependencies.
 */

// get configuration settings
var config = require('./config');

// define requirements
var express = require('express')
  , http = require('http')
  , path = require('path');

// define app
var app = express();

// all environments
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());

// create ElasticSearch client
var elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({
  host: config.searchServer+':'+config.searchPort,
  log: 'error'
});
var errorObject = config.errorObject["400"];
var bodyObject = {};
var query = "";
var q = "";

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}

// callback function for all responses
function sendResponse(res,obj) {
  res.writeHead(obj.status, { "Content-Type": obj.contentType });
  res.write(obj.json);
  res.end();
}

//handle search engine response
function handleResponse(res, error, response) {
    if (error){
        errorObject.json = "{ \"error\": "+error+" }";
        sendResponse(res,errorObject);
      } else {
        // object to hold response properties
        var obj = {};
        obj.contentType = config.contentTypes.json; 
        obj.status = "200";
        obj.json = JSON.stringify(response);
	      sendResponse(res,obj);
      }
}

// initiate search engine search request
function doSearch(res,obj) {
    client.search(obj,function (error, response, status) {
    	handleResponse(res,error, response);
      });
}

// initiate search engine get request
function doGet(res,obj) {
    client.get(obj,function (error, response, status) {
    	handleResponse(res,error, response);
      });
}



// for all requests
app.all('/*', function(req, res, next) {

	  // enable CORS if configuration says to
	  if (config.cors.enabled) {
	    res.header("Access-Control-Allow-Origin", config.cors.sites);
	    res.header("Access-Control-Allow-Methods", config.cors.methods);
	    res.header("Access-Control-Allow-Headers", config.cors.headers);
	  }
	  
	  // set caching 
	  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
	  res.setHeader('Pragma', 'no-cache');
	  res.setHeader('Expires', 0);
	  
	  // intercept OPTIONS method
	  if ('OPTIONS' === req.method) {
	    res.send(200);
	  } else {
	    next();
	  }
	  
	});

// handle GET request patterns
app.get('/', function (req, res) {

      // look for a query parameter named "action"
      if (req.query.action) {
  
        // convert action value to lower case
        req.query.action = req.query.action.toLowerCase();
  
        // test whether the action parameter value is known
        if (config.action[req.query.action]) {
        	
        	  if (req.query.action === "aggregate") {
        		  var bucket1Date = {};
        		  var bucket2Date = {};
        		  if (req.query.to && req.query.from) { 
        			  bucket1Date.to = req.query.to;
        			  bucket2Date.from = req.query.from;
        		  } 
        		  
        		  // build query
        		  bodyObject = {};
        		  bodyObject.aggs = {};
        		  bodyObject.aggs.range = {};
        		  bodyObject.aggs.range.date_range = {};
        		  bodyObject.aggs.range.date_range.field = "published";
        		  bodyObject.aggs.range.date_range.format = "strict_date_optional_time||epoch_millis";
        		  bodyObject.aggs.range.date_range.ranges = [];
        		  bodyObject.aggs.range.date_range.ranges.push(bucket1Date);
        		  bodyObject.aggs.range.date_range.ranges.push(bucket2Date);
        		  
              // send the search and handle the elasticsearch response
              doSearch(res,{  
                  index: 'activity_streams',
                  type: 'activities',
                  body: bodyObject
                });
        		  
        	  } else if (req.query.action ==="range_search"){
        		  console.log('made it to search');
        		  var toDate = '';
        		  var fromDate = '';
        		  if (req.query.to && req.query.from) { 
        			  toDate = req.query.to;
        			  fromDate = req.query.from;
        		  } 
        		  
        		  // build query
        		  bodyObject = {};
        		  bodyObject.query = {};
        		  bodyObject.query.filtered = {};
        		  bodyObject.query.filtered.filter = {};
        		  bodyObject.query.filtered.filter.range = {};
        		  bodyObject.query.filtered.filter.range.published = {};
        		  bodyObject.query.filtered.filter.range.published.gte = fromDate;
        		  bodyObject.query.filtered.filter.range.published.lte = toDate;
        		  console.log(bodyObject);
        		  
              // send the search and handle the elasticsearch response
              doSearch(res,{  
                  index: 'activity_streams',
                  type: 'activities',
                  body: bodyObject
                });
        		  
        	  } else if (req.query.action === "search") {

        	// get query terms
            query = "*";
            if (req.query.q) { query = req.query.q; }
            
            // protect double quotes for phrase searches
            query = query.replace('"','\"');
            
            
            // get results size
            var sizeNum = 10;
            if (req.query.size) { 
              sizeNum = req.query.size;
            }
            
            // get result starting position
            var fromNum = 0;
            if (req.query.from) { 
            		fromNum = req.query.from;
            }
         
            
            // build the request body
            bodyObject = {};
            bodyObject.query = {};
            bodyObject.query.function_score = {};
            bodyObject.query.function_score.query = {};
            bodyObject.query.function_score.query.query_string = {};
            bodyObject.query.function_score.query.query_string.query = query;
            bodyObject.query.function_score.query.query_string.default_operator = "AND";
            bodyObject.size = sizeNum;
            bodyObject.from = fromNum;
            
            // send the search and handle the elasticsearch response
            doSearch(res,{  
                index: req.query.index,
                type: req.query.type,
                body: bodyObject
              });
        		
          
          } else if (req.query.action === "get") {
        	  
        	// get document id
            if (req.query.id) {
            	
              // send the get request and handle the elasticsearch response
              doGet(res,{  
                index: req.query.index,
                type:req.query.type,
                id: req.query.id
              });

              
            } else {
              errorObject.json = "{ \"error\": \"missing document id\" }";
              sendResponse(res,errorObject);
            }
        
          } else {
      
            // report an application error (should not get here, if known actions are 
    	    // accounted for in the if/else if conditions above)
            sendResponse(res,config.errorObject["500"]);
      
          }
      
        } else {
    
          // report an error for an invalid action name
          errorObject.json = "{ \"error\": \"invalid action\" }";
          sendResponse(res,errorObject);
      
        }
  
      } else {
  
        // report an error for the missing action parameter
    	errorObject.json = "{ \"error\": \"missing action parameter\" }";
        sendResponse(res,errorObject);
  
      }
  
});

//If no route is matched by now, it must be an invalid request
app.use(function(req, res) {
  sendResponse(res,config.errorObject["400"]);
});

http.createServer(app).listen(config.appPort, function(){
  console.log('Express server listening on port ' + config.appPort);
});
