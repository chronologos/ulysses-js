var express = require('express');
var fs = require('fs');
var path = require('path');
var morgan = require('morgan'); // logger
var swig = require('swig'); // templating engine
require('dotenv').config(); // allow envvars to be stored in files
var bodyParser = require('body-parser'); // for post request req.body
var multer = require('multer');
var mongoDB = require('mongodb');
var MongoClient = mongoDB.MongoClient;
var ObjectId = mongoDB.ObjectID;
var assert = require('assert');
var session = require('express-session'); // for grant
var _ = require('lodash');
var app = express();
var HARDCODED_USER = "10153931907971748" // TODO(iantay) this is only for hackduke demo

// Do logging with morgan
// ========================
// create a write stream (in append mode)
var accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'access.log'), {flags: 'a'});
  // setup the logger
  app.use(morgan('combined', {stream: accessLogStream}));

  app.use(session({secret: process.env.FACEBOOK_APP_SECRET, cookie: {maxAge: 60000}, resave: false, saveUninitialized: false}));

  if (app.get('env') === 'production') {
    app.set('trust proxy', 1); // trust first proxy
    if (session && session.cookie) session.cookie.secure = true; // serve secure cookies
  }

  console.log('Client ID is ' + process.env.FACEBOOK_APP_ID);

  var passport = require('passport')
  , FacebookStrategy = require('passport-facebook').Strategy;

  passport.use(new FacebookStrategy({

    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: process.env.FB_CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
    console.log(accessToken);
    console.log(refreshToken);
    console.log(profile);
  }
));

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
//var imgParser = bodyParser({uploadDir:'/images/tmp.jpg', extended: true});
//var binaryParser = bodyParser.raw();

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'images')
  },
  filename: function (req, file, cb) {
    cb(null, req.session.userID + '-' + Date.now() + '.jpg')
  }
});

var checkLoggedIn = function(req, res, next) {
  if (!req.session || !req.session.userID) {
    console.log("User not logged in, middleware redirecting to index");
    res.redirect('/');
  }
  else {
    //next(req, res);
    next();
  }
};

var imgUpload = multer({ storage: storage });

var INTERVAL = 3000;

// KIV - Maybe save to DB instead
var zombies = {};

// Start-off watchdog
console.log("Watchdog connecting to DB");
checkExpiry();

app.get('/', function(req, res) {
  console.log('index');
  res.render('index.html', {
    pagename: 'Ulysses Contracts'
    // authors: ['Paul', 'Jim', 'Jane']

  });
});

app.get('/auth/facebook', passport.authenticate('facebook'));

app.get('/contracts', function(req, res) {
  if (!req.session || !req.session.userID) {
    console.log("GET request to contracts by non-signed in user, redirecting to index");
    res.redirect('/');
  }
  else {
    res.redirect('/users/' + req.session.userID);
  }
});

app.get('/auth/facebook/callback', function(req, res) {
  console.log("Received FB data from client");
  console.log(req.query);
  var userID = req.query.id; // id returned by facebook will be primary key for user in DB
  // res.end(JSON.stringify(req.query, null, 2))
  if (req.session) {
    req.session.userID = userID;
    console.log("Saved userID to session");
  }
  else {
    console.log("Session was not created");
    res.redirect('/');
  }
  console.log("Redirecting logged-in user to his homepage");
  res.redirect('/users/' + userID);
});

// should change to use req.userID using sessions OR by saving userID on client side after call to FB API and making button post to /:id/submit_contract
app.post('/submit_contract', urlencodedParser, function(req, res) {
  if (!req.session || !req.session.userID) {
    console.log("No session ID found, redirecting user to login page");
    res.status(401).redirect('/');
  }

  else {
    console.log("Posting in progress, redirecting user to his home page");
    res.redirect("/users/" + req.session.userID);
    console.log("Session userID is " + req.session.userID);
    var data = {// promiserId: req.body.promiserId,
      promiserId: req.session.userID,
      promisedId: req.body.promisedId,
      contract: req.body.contract,
      value: req.body.value,
      expiry: req.body.expiry
    };
    console.log(data);
    MongoClient.connect(url, function(err, db) {
      console.log("Connected correctly to server.");
      assert.equal(null, err);
      var user = req.session.userID;
      saveContractToUser(db, data, user);
    });
  }
  // res.status(200).end();
});

app.get('/users/:user', function(req, res) { // Need sessions support to ensure that id was not directly entered by non-logged in user
  if (req.session) {
    console.log("Session userID is " + req.session.userID);
    console.log("User param is " + req.params.user);
    if (req.session.userID != req.params.user) {
      console.log("Security alert! Session userID does not match URL params userID, redirecting");
      res.redirect('/');
    }
  }
  else {
    console.log("No session ID found, redirecting user to login page");
    res.redirect('/');
  }

  MongoClient.connect(url, function(err, db) {
    if (err) {
      res.status(501).end('Please try again in a short while');
      console.log("Error connecting to MongoDB");
      throw err;
    }
    retrieveUserContracts(db, req.params.user, function(error, result) {
      if (error) throw error;
      console.log("Passed middleware");
      if (result) console.log("Contract objects are ");
      console.log(result);
      console.log("Sending json response");
      res.json(result);
      db.close();
    });
  });
});

app.get('/users/:user/zombies', checkLoggedIn, function(req, res) {

  // Send his expiries
  var userExpiries = zombies[req.params.user];
  res.json(userExpiries);
});


app.get('/imgUpload', checkLoggedIn, function(req, res) {
  res.sendFile(__dirname + '/views/imgUploadTest.html');
});

app.post('/uploadImg', checkLoggedIn, imgUpload.single('photo'), function(req, res) {
  if (!req.session.userID) {
    console.log("Unauthorized attempt at image upload, redirecting to index");
    res.redirect('/');
  }
  else {
    console.log("Image being uploaded...");
    var userID = req.session.userID;
    console.log("UserID of image uploader is " + userID);
    console.log("Filename is " + req.file.filename);
    MongoClient.connect(url, function(err, db) {
      if (err) res.sendStatus(501).end("Oops, something went wrong. Please try again!");
      else {
        var usersDB = db.collection('users');
        saveImageToUser(usersDB, userID, req.file.filename, function() {
          db.close();
        });
      }
    });
    res.status(200).end("Your image has been saved!"); // Respond to client before saving to DB for lower latency
  }
});

app.get('/user/images', checkLoggedIn, function(req, res) {
  MongoClient.connect(url, function(err, db) {
    if (err) res.sendStatus(501).end("Oops, something went wrong. Please try again!");
    var usersDB = db.collection('users');
    retrieveUserImages(usersDB, req.session.userID, function(err, result) {
      if (err) {
        res.sendStatus(501).end("Please try again");
        console.log("Error retrieving user's images: " + err);
      }
      else {
        res.json(result);
      }
      db.close();
    });
  });
});

app.post('/internetbutton', urlencodedParser, function(req, res) {
  res.send(200).end("success")
});

// TODO(iantay) this is only for hackduke demo
app.get('/internetbutton', function(req, res) {
  console.log("IB: internet button called")
  MongoClient.connect(url, function(err, db) {
    console.log("IB: connected to mongoclient")
    if (err) {
      res.status(501).end('IB: Please try again in a short while');
      console.log("IB: Error connecting to MongoDB");
      throw err;
    }
    retrieveUserContracts(db, HARDCODED_USER, function(error, result) {
      if (error){
        console.log("IB: error in internetbutton")
      }
      else {
        console.log("IB: in callback after retrieveUserContracts")
        console.log(result)
        var firstContract = result[0]
        var expiry = parseInt(firstContract.expiry)
        var uid = firstContract._id
        expiry += 1
        firstContract.expiry = expiry
        console.log(firstContract)
        contractsDB.replaceOne({_id:uid}, {$set: firstContract}, function(err,r){
          if (err){
            res.sendStatus(501).end("IB: internetbutton failed");
          }
          else{
            console.log("IB: internet button done.")
            res.sendStatus(200)
          }
        });
      }
    });
    db.close();
  });
});

app.get('/images/:image', checkLoggedIn, function(req, res) {
  res.sendFile(__dirname + "/images/" + req.params.image);
});

app.get('/userImages', checkLoggedIn, function(req, res) {
  res.sendFile(__dirname + "/views/userImages.html");
});

app.get('/displayImages', checkLoggedIn, function(req, res) {
  res.sendFile(__dirname + "/public/displayImages.js");
});

app.listen(port, function() {
  console.log('Example app listening on port 3000!');
  console.log(process.env.NODE_ENV);
});

/*
* Save contract object to DB
* Retrieve _id from DB
* Push it onto user's contracts list
*/
function saveContractToUser(db, contract, user) {
  // contractsDB.insert(contract)
  var contractsDB = db.collection('contracts');
  var usersDB = db.collection('users');
  var contractID;
  // contract.promiserId = user; // Set promiserID from req.session.userID
  contractsDB.insert(contract, function(err, result) {
    if (err) throw err;
    console.log(result);
    contractID = result['insertedIds'][0];
    console.log("ContractID is " + contractID);
    usersDB.update({'userID': user}, {'$push': {'contracts': contractID}}, {'upsert': true}, function(error, res) {
      if (error) throw error;
      console.log("Successfully appended " + contractID + " to user " + user);
      console.log(res);
      db.close();
    });
  });
}


function retrieveUserContracts(db, userID, next) {
  var usersDB = db.collection('users');
  var contractsDB = db.collection('contracts');
  // Try and replace with more efficient query that only retrieves the contracts field
  usersDB.find({'userID': userID}, {fields: {'contracts': 1}}, function(error, result) {
    if (!error) {
      result.limit(1).toArray().then(function(docs, err) { // Assumed that user identifier will be unique, but limit 1 just in case
        if (err) {
          console.log(err);
          next(err, []);
        }
        console.log("Passing matching document :");
        console.log(docs[0]);
        getContracts(contractsDB, docs[0]['contracts'], next);
        // getContracts(contractsDB, docs[0], next);
      });
    }
    else {
      res.sendStatus(501);
    }
  });
}

function getContracts(contractsDB, idsList, next) {
  console.log("in getcontracts")
  var contractObjs = [];
  // console.log('IDs list has length ' + idsList.length);
  idsList.forEach(function(contractID, index) {
    console.log(contractID);
    contractsDB.find(ObjectId(contractID)).toArray().then(function(docs, err) {
      if (err) {
        console.log("Alert! Failed to fetch contract no. " + (index + 1));
        // continue;
        return; // Go to next index of forEach
      }
      console.log("Retrieved document for " + contractID);
      console.log(docs);
      contractObjs.push(docs[0]);
      if (index == idsList.length - 1) {
        console.log("getContracts done...");
        console.log(contractObjs);
        next(null, contractObjs);
      }
    });
    console.log("Attempted no. " + index);
    
  });
}

function checkExpiry() {
  // Loop through contracts in db
  MongoClient.connect(url, function(err, db) {
    if (err) throw err;
    // console.log("Watchdog connecting to DB");
    var contractsDB = db.collection('contracts');
    contractsDB.find().toArray().then(function(docs, error) {
      if (error) {
        console.log("Watchdog unable to retrieve contracts");
        throw err;
      }
      // console.log(docs);
      var timeNow = new Date();
      var expiry;

      // console.log("Number of documents retrieved: " + docs.length);

      docs.forEach(function(doc, index) {
        // Check expiry time against current time
        expiry = new Date(doc['expiry']);
        if (expiry <= timeNow) {
          // console.log("PromiserId is " + doc['promiserId']);
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
      // console.log(JSON.stringify(zombies));
      // console.log("\n\n");
      if (Object.keys(zombies).length > 0) {
        // console.log(JSON.stringify(zombies));
        // console.log("\n\n");
      }
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

function saveImageToUser(usersDB, userID, imageFilePath, next) {
  console.log("Trying to save imageFilePath to user");
  usersDB.update({'userID':userID}, {'$push':{'images':imageFilePath}}, {'upsert' : true}, function(error, res) {
    if (error) throw error;
    console.log("Saved file path " + imageFilePath + " to user, response is " + res);
    next();
  });
  return;
}

function retrieveUserImages(usersDB, userID, next) {
  usersDB.find({'userID': userID}, {fields: {'images': 1}}, function(error, result) {
    if (!error) {
      result.limit(1).toArray().then(function(docs, err) { // Assumed that user identifier will be unique, but limit 1 just in case
        if (err) next(err, null);
        //console.log("Passing matching document :");
        console.log(docs[0]);
        console.log("Sending image paths: " + JSON.stringify(docs[0]['imags']));
        next(null, docs[0]['images']);
      });
    }
    else {
      next(error, result);
    }
  });


}
