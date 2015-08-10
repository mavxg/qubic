var express = require('express');
var router = express.Router();

var User = require('../models/user');
var Collection = require('../models/collection');
var Document = require('../models/document');

router.get('/settings', function(req, res, next) {
  res.render('me/settings');
});

router.get('/models', function(req, res, next) {
  res.redirect('models/drafts');
});

router.all('*', function(req, res, next) {
    res.header("Cache-Control", "no-cache, no-store, must-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires",0);
    next();
});

router.all('/models/*', function(req, res, next) {
  Document.aggregate() 
    .match( { catalog : ('@' + req.user.name)} )
    .group({
      _id : "$status",
      count: { $sum: 1 }
    }).exec(function (err, response) {
      if (err) next(err);
      var counts = {
        'draft': 0,
        'public': 0,
        'unlisted': 0,
      };
      for (var i = response.length - 1; i >= 0; i--) {
        var r = response[i];
        counts[r._id] = r.count;
      };
      req.counts = counts;
      next();
    });
})

router.get('/models/drafts', function(req, res, next) {
  Document.find({
    'catalog':('@' + req.user.name),
    'status':'draft',
  }, 'title slug created', function(err, docs){
    res.render('me/stories-draft', { stories:(docs || []) });
  });
});

router.get('/models/public', function(req, res, next) {
  Document.find({
  	'catalog':('@' + req.user.name),
  	'status':'public',
  }, 'title slug created', function(err, docs){
    res.render('me/stories-public', { stories:(docs || []) });
  });
});

router.get('/models/unlisted', function(req, res, next) {
  Document.find({
    'catalog':('@' + req.user.name),
    'status':'unlisted',
  }, 'title slug created', function(err, docs){
    res.render('me/stories-unlisted', { stories:(docs || []) });
  });
});

router.get('/collections', function(req, res, next) {
  var user = req.user;
  Collection.find({ $or: [
    {owners:user.name},
    {writers:user.name},
    {readers:user.name},
    {name: { $in: user.following }},
  ]}, function(err, collections) {
    collections = collections || [];
    var owns = [];
    var writes = [];
    var reads = [];
    var follows = [];
    for (var i = collections.length - 1; i >= 0; i--) {
      var col = collections[i];
      if (col.owners.indexOf(user.name) >= 0)
        owns.push(col);
      else if (user.following.indexOf(col.name) >= 0)
        follows.push(col);
      else if (col.writers.indexOf(user.name) >= 0)
        writes.push(col);
      else
        reads.push(col);
    };
    res.render('me/collections', {
      collections:collections,
      owns:owns,
      writes:writes,
      reads:reads,
      follows:follows,
    });
  });
});

// keys ---

//also want this on the profile/public_key
router.get('/keys', function(req, res) {
  res.send(req.user.public_keys);
});

//should not be accessable anywhere else 
//(requires user authentication)
router.get('/private_keys', function(req, res) {
  res.send(req.user.private_keys);
});

router.post('/keys', function(req, res) {
  var user = req.user;
  var openpgp = require('openpgp');
  var ascii = req.body.key;
  var desc = req.body.description
  var key = openpgp.key.readArmored(ascii).keys[0];
  var pubkey = new User.Key();
  if (key.isPrivate()) {
    var pk = new User.Key();
    pk.description = desc;
    pk.key = ascii;
    pk.key_id = key.primaryKey.keyid.toHex();
    pk.fingerprint = key.primaryKey.getFingerprint();
    if (!user.private_keys)
      user.private_keys = [];
    user.private_keys.unshift(pk);
    //public key
    key = key.toPublic();
    ascii = key.armor()
  }
  pubkey.description = desc;
  pubkey.key = ascii;
  pubkey.key_id = key.primaryKey.keyid.toHex();
  pubkey.fingerprint = key.primaryKey.getFingerprint();
  if (!user.public_keys)
    user.public_keys = [];
  user.public_keys.unshift(pubkey);
  user.save(function (err) {
    if (err)
      res.send(err);                 
    res.redirect('settings')
  });
});

module.exports = router;