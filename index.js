var express = require('express');
var bodyParser = require('body-parser')

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var port = process.env.PORT || 3000;
if (process.env.NODE_ENV === 'production') {
    var url = process.env.MONGODB_URI;
}

var app = express();
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
})); 
//app.use(express.json());       // to support JSON-encoded bodies
//app.use(express.urlencoded()); // to support URL-encoded bodies
app.get('/', function (req, res) {
    res.send('Hello World!');
});

app.post('/contract', function (req, res) {
    console.log("contract");
    console.log(req.body.id);
    res.json({ userId: req.body.id});
    MongoClient.connect(url, function(err, db) {
        console.log("Connected correctly to server.");
        assert.equal(null, err);
        data = { userId: req.body.id}
        var contracts_db = db.collection('uly-dev');
        contracts_db.insert(data, function(err,result) {
            if(err) throw err;
            console.log(result);
        });
        db.close()
    });

});


app.listen(port, function () {
    console.log('Example app listening on port 3000!');
});
