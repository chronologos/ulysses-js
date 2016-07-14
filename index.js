var express = require('express'),
    swig  = require('swig'),
    bodyParser = require('body-parser'),
    MongoClient = require('mongodb').MongoClient,
    assert = require('assert');

var port = process.env.PORT || 3000;
if (process.env.NODE_ENV === 'production') {
    var url = process.env.MONGODB_URI;
}
else {
    var url =  'mongodb://heroku_t776fjt0:q7iffsa51r7hd5lbev3ukmg021@ds027308.mlab.com:27308/heroku_t776fjt0'
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
    console.log('index')
        res.render('index.html',{
            pagename: 'awesome people',
            authors: ['Paul', 'Jim', 'Jane']
        });
});

app.get('/contract/:contract', function(req,res){
    console.log(req.params)
        MongoClient.connect(url, function(err,db) {
            //data = { promiserId: req.body.promiserId, promisedId: req.body.promisedId, contract: req.body.contract, value: req.body.value, expiry: req.body.expiry }
            data = {contract: req.params.contract}
            console.log(data)
                var contracts_db = db.collection('uly-dev');
            contracts_db.find(data).toArray(function(err, result){
                if (err) throw err;
                console.log(result);
                db.close()
                    res.send(result) //todo use this to send redirect with string.
            });
        });
});


app.post('/submit_contract', urlencodedParser, function (req, res) {
    console.log("contract");
    data = { promiserId: req.body.promiserId, promisedId: req.body.promisedId, contract: req.body.contract, value: req.body.value, expiry: req.body.expiry }
    console.log(data);
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
            res.status(200).end()
    });
});


app.listen(port, function () {
    console.log('Example app listening on port 3000!');
});
