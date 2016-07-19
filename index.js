var express = require('express');
var fs = require('fs');
var path = require('path');
var morgan = require('morgan'); // logger
var swig = require('swig'); // templating engine
require('dotenv').config(); // allow envvars to be stored in files
var bodyParser = require('body-parser'); // for post request req.body
var mongoDB = require('mongodb');
var MongoClient = mongoDB.MongoClient;
var ObjectId = mongoDB.ObjectID;
var assert = require('assert');
var session = require('express-session'); // for grant
var Grant = require('grant-express');  // for oauth2 login with facebook
var grantconfig = require('./grantconfig.json');
var grant = new Grant(grantconfig[process.env.NODE_ENV] || 'development');
var _ = require('lodash');
var app = express();

// Do logging with morgan
// ========================
// create a write stream (in append mode)
var accessLogStream = fs.createWriteStream(
    path.join(__dirname, 'access.log'), {flags: 'a'});
// setup the logger
app.use(morgan('combined', {stream: accessLogStream}));

app.use(session({secret: 'grant'}));
// mount grant
app.use(grant);

var port = process.env.PORT || 3000;
var url;
if (process.env.NODE_ENV === 'production') {
  url = process.env.MONGODB_URI;
} else {
  // url = 'mongodb://heroku_t776fjt0:q7iffsa51r7hd5lbev3ukmg021@ds027308.mlab.com:27308/heroku_t776fjt0';
  url = 'mongodb://127.0.0.1:27017';
}

swig.setDefaults({
  varControls: ['[[', ']]']
});

app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.use(express.static('public')); // serve js and css
var urlencodedParser = bodyParser.urlencoded({extended: false});
var INTERVAL = 3000;

// KIV - Maybe save to DB instead
var zombies = {};

// Start-off watchdog
checkExpiry();

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
    var ContractsDb = db.collection('contracts');
    ContractsDb.find(data).toArray(function(err, result) {
      if (err) throw err;
      if (result) {
        console.log(result);
      } else {
        console.log("not found");
      }
      db.close();
      res.send(result); // todo use this to send redirect with string.
    });
  });
});

app.get('/connect/facebook/callback', function(req, res) {
  console.log('ok');
  console.log(req.query);
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
    /*
       data = {
       promiserId: req.body.promiserId,
       promisedId: req.body.promisedId,
       contract: req.body.contract,
       value: req.body.value,
       expiry: req.body.expiry
       };
       */

    //var contractsDB = db.collection('uly-dev');
    /*
       ContractsDb.insert(data, function(err, result) {
       if (err) throw err;
       console.log(result);
       });
       db.close();
       */

    // TEMP!
    var user = req.body.promiserId;
    //var usersDB = db.collection('users');
    saveContractToUser(db, data, user);
  });
  res.status(200).end();
});

// TEMP - Replace with authentication module
app.get('/:user', function(req, res) {
  MongoClient.connect(url, function(err, db) {
    if (err) {
      res.status(501).end('Please try again in a short while');
      console.log("Error connecting to MongoDB");
      throw err;
    }
    retrieveUserContracts(db, req.params.user, function(error, result) {
      if (error) throw error;
      //console.log(result);
      //res.send(result);
      console.log("Passed middleware");
      //result.toArray().then(function(docs) {
      //console.log("First document");
      //if (docs) console.log(docs[0]);
      //});
      if (result) console.log("Contract objects are ");
      //console.log(result['contracts']);
      //console.log(JSON.stringify(result));
      console.log(result);
      //db.close();
      res.json(result);
      db.close();
    });
  });
});

app.get('/:user/zombies', function(req, res) {
  // TO-DO: Check that user is logged in

  // Send his expiries
  var userExpiries = zombies[req.params.user];
  res.json(userExpiries);
});


/*
 * Save contract object to DB
 * Retrieve _id from DB
 * Push it onto user's contracts list
 */
function saveContractToUser(db, contract, user) {
  //contractsDB.insert(contract)
  var contractsDB = db.collection('contracts');
  var usersDB = db.collection('users');
  var contractID;
  contractsDB.insert(contract, function(err, result) {
    if (err) throw err;
    console.log(result);
    contractID = result['insertedIds'][0];
    console.log("ContractID is " + contractID);
    usersDB.update({'userName':user}, {'$push':{'contracts':contractID}}, {'upsert' : true}, function(error, res) {
      if (error) throw error;
      console.log("Successfully appended " + contractID + " to user " + user);
      console.log(res);
      db.close();
    });
  });
} 

app.listen(port, function() {
  console.log('Example app listening on port 3000!');
  console.log(process.env.NODE_ENV);
})


function retrieveUserContracts(db, userName, next) {
  var usersDB = db.collection('users');
  var contractsDB = db.collection('contracts');
  // Try and replace with more efficient query that only retrieves the contracts field
  usersDB.find({'userName':userName}, {fields:{'contracts':1}}, function(error , result) {
    if (!error) {
      result.limit(1).toArray().then(function(docs, err) { // Assumed that user identifier will be unique, but limit 1 just in case
        if (err) next(err, docs);
        console.log("Passing matching document :");
        console.log(docs[0]);
        getContracts(contractsDB, docs[0]['contracts'], next);
        //getContracts(contractsDB, docs[0], next);
      });
    }
    else {
      next(error, result);
    }
  });

}


function getContracts(contractsDB, idsList, next) {
  var contractObjs = [];
  console.log('IDs list has length ' + idsList.length);
  idsList.forEach(function(contractID, index) {
    console.log("Getting contracts with list");
    contractsDB.find(ObjectId(contractID)).toArray().then(function(docs, err) {
      if (err) {
        console.log("Alert! Failed to fetch contract no. " + (index + 1));
        //continue;
        return; // Go to next index of forEach
      };
      console.log("Retrieved document for " + contractID);
      console.log(docs);
      contractObjs.push(docs[0]);
      if (index == idsList.length - 1) {
        next(null, contractObjs);
      }
    });
  });
}

function checkExpiry() {
  // Loop through contracts in db
  MongoClient.connect(url, function(err, db) {
    console.log("Watchdog connecting to DB");
    var contractsDB = db.collection('contracts');
    contractsDB.find().toArray().then(function(docs, error) {
      if (error) {
        console.log("Watchdog unable to retrieve contracts");
        throw err;
      }
      console.log(docs);
      var timeNow = new Date();
      var expiry;
      docs.forEach(function(doc, index) {
        // Check expiry time against current time
        expiry = new Date(doc['expiry']);
        if (expiry <= timeNow) {
          console.log("PromiserId is " + doc['promiserId']);    
          var oldList = _.get(zombies, doc['promiserId'], []);
          if (!hasContract(oldList, doc)) {
            oldList.push(doc);
          }
          _.set(zombies, doc['promiserId'], oldList);
          oldList = _.get(zombies, doc['promisedId'], []);
          if (!hasContract(oldList, doc)) {
            oldList.push(doc);
          } 
          _.set(zombies, doc['promisedId'], oldList); 
        }
      });
      console.log(JSON.stringify(zombies));
      console.log("\n\n");
      db.close();
    });

  }); 
  setTimeout(checkExpiry, INTERVAL);
}


function hasContract(contractsList, contract) {
  var contractStrs = contractsList.map(function(contract) {
    return contract._id.toString();
  });
  return contractStrs.indexOf(contract._id.toString()) !== -1;
}
