
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
function handleResponse(req, res, error, response) {
	console.log('handler req ' + req);
    if (error){
        errorObject.json = "{ \"error\": "+JSON.stringify(error)+" }";
        sendResponse(res,errorObject);
      } else {
        // object to hold response properties
        var obj = {};
        
        // CHANGE = Made content type jsonld 
        obj.contentType = config.contentTypes.jsonld; 
        obj.status = "200";
        if (req.query.action === 'count'){
        	   var jsonld = response;
        }
        else if (req.query.action === 'get'){
            var jsonld = response['_source'];
            jsonld['@context'] = ["https://www.w3.org/ns/activitystreams", "http://iiif.io/api/presentation/2/context.json"];
	    }
        else {
	        var jsonld = {};
	        jsonld['@context'] = ["https://www.w3.org/ns/activitystreams", "http://iiif.io/api/presentation/2/context.json"];
	        //jsonld.type = "Collection";
	        jsonld.items = [];
	        response.hits.hits.map(function(hit){
	        	        jsonld.items.push(hit._source);
	        	    
	            });
        }
        obj.json = JSON.stringify(jsonld);
	    sendResponse(res,obj);
      }
}

// initiate search engine search request
function doSearch(req, res,obj) {
    client.search(obj,function (error, response, status) {
    	handleResponse(req, res,error, response);
      });
}

function doPagingSearch(req, res, obj, requestPage) {
	var currentPage = 0;
    client.search(obj,function getRightPage(error, response, status) {
    	currentPage += 1;
    	console.log('requested page ' + requestPage);
    	console.log('curent page ' + currentPage);
    	if (requestPage != currentPage) {
    		console.log('still in search loop');
    		client.scroll({
    		      scrollId: response._scroll_id,
    		      scroll: '10s'
    		    }, getRightPage);
    		  } else {
    			console.log('should be done');
    			//console.log(response);
    		    	handleResponse(req, res,error, response);
    		  }
      });
}

function doCount(req, res,obj) {
	console.log(req)
    client.count(obj,function (error, response, status) {
    	handleResponse(req, res,error, response);
      });
}

// initiate search engine get request
function doGet(req, res,obj) {
    client.get(obj,function (error, response, status) {
    	handleResponse(req, res,error, response);
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
        
        	// get results size
            var sizeNum = 500;
            if (req.query.size) { 
              sizeNum = req.query.size;
            }
         
            // get result starting position
            var fromNum = 0;
            if (req.query.from) { 
            		fromNum = req.query.from;
            }
        	
        	  if (req.query.action === "aggregate") {
        		  var bucket1Date = {};
        		  var bucket2Date = {};
        		  if (req.query.toDate && req.query.fromDate) { 
        			  bucket1Date.to = req.query.toDate;
        			  bucket2Date.from = req.query.fromDate;
        		  } 
        		  
        		  // build query
        		  bodyObject = {};
        		  bodyObject.aggs = {};
        		  bodyObject.aggs.range = {};
        		  bodyObject.aggs.range.date_range = {};
        		  bodyObject.aggs.range.date_range.field = "startTime";
        		  bodyObject.aggs.range.date_range.format = "strict_date_optional_time||epoch_millis";
        		  bodyObject.aggs.range.date_range.ranges = [];
        		  bodyObject.aggs.range.date_range.ranges.push(bucket1Date);
        		  bodyObject.aggs.range.date_range.ranges.push(bucket2Date);
        		  
              // send the search and handle the elasticsearch response
              doSearch(req, res,{  
                  index: config.indexName,
                  type: config.docType,
                  body: bodyObject
                });
        		  
        	  } else if (req.query.action ==="range_search"){
        		  var toDate = '';
        		  var fromDate = '';
        		  if (req.query.toDate && req.query.fromDate) { 
        			  toDate = req.query.toDate;
        			  fromDate = req.query.fromDate
        		  } 
        	   		  
        		  // build query
        		  bodyObject = {};
        		  bodyObject.query = {};
        		  bodyObject.query.filtered = {};
        		  bodyObject.query.filtered.filter = {};
        		  bodyObject.query.filtered.filter.range = {};
        		  bodyObject.query.filtered.filter.range.startTime = {};
        		  bodyObject.query.filtered.filter.range.startTime.gte = fromDate;
        		  bodyObject.query.filtered.filter.range.startTime.lte = toDate;
        		  bodyObject.size = sizeNum;
        		  bodyObject.from = fromNum;
        		  
              // send the search and handle the elasticsearch response
              doSearch(req, res,{  
            	  	index: config.indexName,
                  type: config.docType,
                  body: bodyObject
                });
        		  
        	  } else if (req.query.action ==="paging"){
        		  query = "*";
        		  var sizeNum = 5000;
              if (req.query.q) { query = req.query.q; }
        		  if (req.query.page) { 
        			  var requestPage = req.query.page;
        		  } 		  
        		  // build query
        		  bodyObject = {};
              bodyObject.query = {};
              bodyObject.query.function_score = {};
              bodyObject.query.function_score.query = {};
              bodyObject.query.function_score.query.query_string = {};
              bodyObject.query.function_score.query.query_string.query = query;
              bodyObject.size = sizeNum;
              //console.log(JSON.stringify(bodyObject))
        		  
              // send the search and handle the elasticsearch response
              doPagingSearch(req, res,{  
            	  	index: config.indexName,
                  type: config.docType,
                  scroll: '10s',
                  body: bodyObject
                }, requestPage);
        		  
        	  } else if (req.query.action === "search") {

        	// get query terms
            query = "*";
            if (req.query.q) { query = req.query.q; }
            
            // protect double quotes for phrase searches
            query = query.replace('"','\"');
         
            
            // build the request body
            bodyObject = {};
            bodyObject.query = {};
            bodyObject.query.function_score = {};
            bodyObject.query.function_score.query = {};
            bodyObject.query.function_score.query.query_string = {};
            bodyObject.query.function_score.query.query_string.query = query;
            //bodyObject.query.function_score.query.query_string.default_operator = "AND";
            bodyObject.size = sizeNum;
            bodyObject.from = fromNum;
            console.log(JSON.stringify(bodyObject))
            
            // send the search and handle the elasticsearch response
            doSearch(req, res,{  
            	    index: config.indexName,
                type: config.docType,
                body: bodyObject
              });
        		
          
          } else if (req.query.action === "get") {
        	  
        	// get document id
            if (req.query.id) {
            	
              // send the get request and handle the elasticsearch response
              doGet(req, res,{  
            	    index: config.indexName,
                type: config.docType,
                id: req.query.id
              });

              
            } else {
              errorObject.json = "{ \"error\": \"missing document id\" }";
              sendResponse(res,errorObject);
            }
        
          } else if (req.query.action === "count") {
        	     doCount(req, res,{  
            	    index: config.indexName,
                type: config.docType
              })
          
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

