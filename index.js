var express = require('express'),
    swig  = require('swig'),
    bodyParser = require('body-parser'),
    MongoClient = require('mongodb').MongoClient,
    assert = require('assert');

var port = process.env.PORT || 3000;
if (process.env.NODE_ENV === 'production') {
    var url = process.env.MONGODB_URI;
}
swig.setDefaults({
    varControls: ['[[', ']]'] 
});
var app = express();
app.engine('html',swig.renderFile);
app.set('view engine', 'html'); //todo(iantay) what is this
app.use(express.static('public')); //serve js and css
var urlencodedParser = bodyParser.urlencoded({ extended: false });
//app.use(bodyParser.json());       // to support JSON-encoded bodies
//app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
//extended: true
//})); 
//app.use(express.json());       // to support JSON-encoded bodies
//app.use(express.urlencoded()); // to support URL-encoded bodies
app.get('/', function (req, res) {
    res.render('index.html',{
        pagename: 'awesome people',
        authors: ['Paul', 'Jim', 'Jane']
    });
});

app.get('/contract/:promiserId/:promisedId/:contract/:value/:expiry', function(req,res){
    console.log(req.params)
    MongoClient.connect(url, function(err,db) {
        data = { promiserId: req.body.promiserId, promisedId: req.body.promisedId, contract: req.body.contract, value: req.body.value, expiry: req.body.expiry }
        console.log(data)
        var contracts_db = db.collection('uly-dev');
        contracts_db.find(data, function(err, result){
            res.send(result)
            if (err) throw err;
            console.log(result);
            db.close()
        });
    });
});


app.post('/submit_contract', urlencodedParser, function (req, res) {
    console.log("contract");
    console.log(req.body.id);
    res.json({ userId: req.body.id});
    MongoClient.connect(url, function(err, db) {
        console.log("Connected correctly to server.");
        assert.equal(null, err);
        data = { promiserId: req.body.promiserId, promisedId: req.body.promisedId, contract: req.body.contract, value: req.body.value, expiry: req.body.expiry }
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
