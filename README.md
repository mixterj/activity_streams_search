

# IIIF Activity Streams Search API



## Usage

This Node Express JS application creates an API for accessing [IIIF](http://iiif.io/) [Activity Streams](https://www.w3.org/TR/activitystreams-core/) data. It requires an [ElasticSearch Index](https://www.elastic.co/products/elasticsearch) installation and IIIF Activity Stream data. The data can be produced using this Python code.


## Developing

This is a proof of concept and provided 'as is'.

## Installation

### Prerequisites

* NodeJS
* ElasticSearch
* IIIF Activity Streams data index in ElasticSearch

### Running the API code

* Navigate to the parent directory and run `npm install`. This will download all of the code dependencies
* In the config.js modify the config.searchServer, config.searchPort, config.indexName, and config.docType to match your ElasticSearch installation and index/type names.

* Run `node app.js` to start the API on port 3061

### Tools

Created with [Nodeclipse](https://github.com/Nodeclipse/nodeclipse-1)
 ([Eclipse Marketplace](http://marketplace.eclipse.org/content/nodeclipse), [site](http://www.nodeclipse.org))   

Nodeclipse is free open-source project that grows with your contributions.
