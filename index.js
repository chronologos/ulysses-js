var express = require('express');
var fs = require('fs');
var path = require('path');
var morgan = require('morgan'); // logger
var swig = require('swig'); // templating engine
require('dotenv').config(); // allow envvars to be stored in files
var bodyParser = require('body-parser'); // for post request req.body
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var session = require('express-session'); // for grant
var Grant = require('grant-express');  // for oauth2 login with facebook
var grantconfig = require('./grantconfig.json')
var grant = new Grant(grantconfig[process.env.NODE_ENV] || 'development')
var app = express()

// Do logging with morgan
// ========================
// create a write stream (in append mode)
var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'})
// setup the logger
app.use(morgan('combined', {stream: accessLogStream}))

app.use(session({secret: 'grant'}))
// mount grant
app.use(grant)

var port = process.env.PORT || 3000;
var url;
if (process.env.NODE_ENV === 'production') {
  url = process.env.MONGODB_URI;
} else {
  url = 'mongodb://heroku_t776fjt0:q7iffsa51r7hd5lbev3ukmg021@ds027308.mlab.com:27308/heroku_t776fjt0';
}

swig.setDefaults({
  varControls: ['[[', ']]']
});
app.engine('html', swig.renderFile);
app.set('view engine', 'html'); // TODO(iantay) what is this
app.use(express.static('public')); // serve js and css
var urlencodedParser = bodyParser.urlencoded({extended: false});
// app.use(bodyParser.json());       // to support JSON-encoded bodies
// app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
// extended: true
// }));
// app.use(express.json());       // to support JSON-encoded bodies
// app.use(express.urlencoded()); // to support URL-encoded bodies
app.get('/', function(req, res) {
  console.log('index');
  res.render('index.html', {
    pagename: 'awesome people',
    authors: ['Paul', 'Jim', 'Jane']
  });
});

app.get('/contract/:contract', function(req, res) {
  console.log(req.params);
  MongoClient.connect(url, function(err, db) {
    if (err) throw err;
      // data = { promiserId: req.body.promiserId, promisedId: req.body.promisedId, contract: req.body.contract, value: req.body.value, expiry: req.body.expiry }
    var data = {contract: req.params.contract};
    console.log(data);
    var ContractsDb = db.collection('uly-dev');
    ContractsDb.find(data).toArray(function(err, result) {
      if (err) throw err;
      if (result) {
        console.log(result);
      } else {
        console.log("not found")
      }
      db.close();
      res.send(result); // todo use this to send redirect with string.
    });
  });
});

app.get('/connect/facebook/callback', function(req, res) {
  console.log('ok')
  console.log(req.query)
  //res.end(JSON.stringify(req.query, null, 2))
})

app.post('/submit_contract', urlencodedParser, function(req, res) {
  console.log("contract");
  var data = {promiserId: req.body.promiserId,
    promisedId: req.body.promisedId,
    contract: req.body.contract,
    value: req.body.value,
    expiry: req.body.expiry
  };
  console.log(data);
  MongoClient.connect(url, function(err, db) {
    console.log("Connected correctly to server.");
    assert.equal(null, err);
    data = {
      promiserId: req.body.promiserId,
      promisedId: req.body.promisedId,
      contract: req.body.contract,
      value: req.body.value,
      expiry: req.body.expiry
    };
    var ContractsDb = db.collection('uly-dev');
    ContractsDb.insert(data, function(err, result) {
      if (err) throw err;
      console.log(result);
    });
    db.close();
    res.status(200).end();
  });
});

app.listen(port, function() {
  console.log('Example app listening on port 3000!');
  console.log(process.env.NODE_ENV);
});
