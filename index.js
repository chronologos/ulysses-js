var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var port = process.env.PORT || 3000;
if (process.env.NODE_ENV === 'production') {
    var url = process.env.MONGODB_URI;
}
MongoClient.connect(url, function(err, db) {
  assert.equal(null, err);
  console.log("Connected correctly to server.");
  db.close();
});

var app = express();
app.get('/', function (req, res) {
  res.send('Hello World!');
});

app.listen(port, function () {
  console.log('Example app listening on port 3000!');
});
