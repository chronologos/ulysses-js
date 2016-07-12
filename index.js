var express = require('express');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var port = process.env.PORT || 3000;
if (process.env.NODE_ENV === 'production') {
    var url = process.env.MONGODB_URI;
}

var app = express();
app.get('/', function (req, res) {
    res.send('Hello World!');
});

app.post('/contract', function (req, res) {
    console.log("contract")
    console.log(req.params);
    console.log(JSON.stringify(req.params));
    res.json({ userId: req.params.userId});
});

MongoClient.connect(url, function(err, db) {
    assert.equal(null, err);
    console.log("Connected correctly to server.");
    var contracts_db = db.collection('uly-dev');
    //contracts_db.insert(data, function(err,result) {
    //if(err) throw err;
    //console.log(result);
    //});
    db.close()
});

app.listen(port, function () {
    console.log('Example app listening on port 3000!');
});
