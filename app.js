var express      = require('express');
var path         = require('path');
var favicon      = require('serve-favicon');
var logger       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');

var Collection = require('./models/collection');

var hat          = require('hat'); 

//var session      = require('express-session');
var session      = require('cookie-session')

var livedb       = require('livedb');
var livedbMongo  = require('livedb-mongo');
var Socket       = require('browserchannel').server;
var Duplex       = require('stream').Duplex;
var sharejs      = require('share');

var mongoose     = require('mongoose');
var flash        = require('connect-flash');

var ntlm         = require('express-ntlm');

var auth     = require('./config/passport');
var passport = auth.passport;

var params   = require('./app/params');
var doc      = require('./controllers/document');
var userc    = require('./controllers/user');

var app = express();

app.locals.auth = auth.config;
app.locals.env = process.env;
app.locals.moment = require('moment');

var ot = require('ot-sexpr');

livedb.ot.registerType(ot);

var MONGODB_URL = process.env.QUBE_MONGODB_URL ||
  'mongodb://localhost:27017/qube';
var AD_CONTROLLER = process.env.AD_CONTROLLER;

//we have two connections to mongodb
mongoose.connect(MONGODB_URL);
var db = livedbMongo(MONGODB_URL, {safe:false});
var backend = livedb.client(db);
var drafts = backend.collection('draft');

var sharec = require('./controllers/share')(backend);

app.locals.backend = backend;

const Document = require('./models/document');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json({limit: '150mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use("/fonts", express.static("node_modules/font-awesome"));
app.use("/pgp", express.static("node_modules/openpgp/dist"));

if (AD_CONTROLLER) app.use(ntlm({ domaincontroller: AD_CONTROLLER }));

// required for passport
var session_secret = process.env.QUBE_SESSION_SECRET ||
  'OIU9083029ksdflkj2930ljlksdfj293080293';
app.use(session({ secret: session_secret }));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash());

if (AD_CONTROLLER) {
  app.all('*', passport.authenticate('ad'), function(req, res, next){
    if(req.isAuthenticated())
      next();
    else
      next(new Error(401)); // 401 Not Authorized
  });
}

//allow req access from templates
app.use(function(req,res,next){
    res.locals.req = req;
    res.locals.user = req.user;
    res.locals.canLogout = !AD_CONTROLLER;
    if (req.user)
      res.locals.newCatalog = req.user.catalog;
    req.drafts = drafts; //livedb collection
    next();
});

const share = sharejs.server.createClient({backend: backend});
share.use(function(req, next) {
  //TODO: op filter for share docs here
  next();
});

var pv = {}
share.preValidate = function(op, doc) {
  if (op.op != undefined) {
    pv[doc.docName + ':' + doc.v] = doc.data.toSexpr()
  }
}

share.validate = function(op, doc) {
  if (op.op != undefined) {
    try {
      var key = doc.docName + ':' + doc.v;
      var prevSS = pv[key];
      delete pv[key];
      var o = ot.invert(op.op);
      var prev = ot.apply(doc.data, o);
      var prevS = prev.toSexpr();
      if (prevSS != prevS) {
        return 'Inverse does not match original';
      }
    } catch(e) {
      console.log(e)
      return "Could not invert op";
    }
  }
  return;
};

//sharejs websocket hookup
app.use(Socket(function(client, req) {
  if (req.user) {
    client.user = req.user;
  }
  
  var stream = new Duplex({objectMode: true});

  stream._read = function() {};
  stream._write = function(chunk, encoding, callback) {
    if (client.state !== 'closed') {
      client.send(chunk);
    }
    callback();
  };

  client.on('message', function(data) {
    console.log(JSON.stringify(data))
    stream.push(data);
  });

  client.on('close', function(reason) {
    stream.push(null);
    stream.emit('close');
  });

  stream.on('end', function() {
    client.close();
  });

  // Give the stream to sharejs
  return share.listen(stream, client);
}));

// provide rack for ids (new rack every 2 hours)
var MILLISECONDS_PER_RACK = 1000 * 60 * 60 * 2;
var INITIAL_RACK = 1428821798083; //epoch for ids.

function rackHour(ut) {
  return Math.floor((ut - INITIAL_RACK) / MILLISECONDS_PER_RACK);
}

app.locals.lastRack = Date.now();
app.locals.rackHour = rackHour(app.locals.lastRack);
app.locals.rack     = hat.rack(36,36);
app.use(function(req,res,next){
    var now = Date.now();
    if ((now - MILLISECONDS_PER_RACK) > app.locals.lastRack) {
      app.locals.lastRack = now;
      app.locals.rackHour = rackHour(now);
      app.locals.rack = hat.rack(36,36);
    }
    next();
});

//TODO: put this in utils
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated())
    return next();

  if (req.method == 'GET' && req.session)
    req.session.returnTo = req.originalUrl || req.url;

  //if we have active directory we use that.
  if (req.ntlm)
    res.redirect('/auth/ad');
  else
    res.redirect('/login');
}

function nop(req, res, next) { next(); }

app.use('/admin', isLoggedIn, require('./routes/admin'));
app.use('/settings', isLoggedIn, require('./routes/settings'));
app.use('/search', require('./routes/search'));
app.use('/auth', require('./routes/auth'));
app.use('/unlink', isLoggedIn, require('./routes/unlink'));
app.use('/collection', isLoggedIn, require('./routes/collection'));
app.use('/api/share', share.rest())

app.get('/', (AD_CONTROLLER ? isLoggedIn : nop), function(req, res) {
  if (req.isAuthenticated()) {
    return res.redirect('/@' + req.user.name);
  }
  res.render('index' );
});

function genId() {
  var rid = app.locals.rack();
  var hour = app.locals.rackHour.toString(36);
  return hour + rid;
}

app.post('/:catalog/new', isLoggedIn, function(req, res, next) {
  var id = genId();
  var doc = new Document();
  doc.hidden = true;
  doc._id = id;
  doc.catalog = req.catalog;
  doc.title = '';
  doc.slug = '';
  doc.save(function(err) {
    if (err) return next(err);
    req.user.save(function(err) {
      if (err) return next(err);
      res.redirect('/' + req.catalog + '/untitled-' + id);
    });
  });
});

app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

if (AD_CONTROLLER) {
  //login goes to ad controller
  app.get('/login', function(req, res) { 
    res.redirect('/auth/ad'); 
  });
} else {
  app.use(require('./routes/login'));
}

app.param('title', params.findDocument);
app.param('collection', params.findCollection);
app.param('name', params.findUser);
app.param('catalog', params.findCatalog);

var DEFAULT_DOC = '(doc (section {"placeholder":"Add a title"}(h1 "") (p "")))'

function create(req, res, next) {
  if (!(req.collection_writer))
    return next(new Error(401)); // 401 Not Authorized
  var sexpr = req.body.sexpr || DEFAULT_DOC;
  var id = genId();
  var doc = new Document();
  if (req.body.parent)
    doc.parent = req.body.parent;
  if (req.body.parent_version)
    doc.parent_version = parseInt(req.body.parent_version);
  doc._id = id;
  doc.catalog = req.catalog;
  doc.title = req.body.title || '';
  doc.text = '';
  doc.slug = '';
  doc.status = 'private';
  doc.save(function(err) {
    if (err) return next(err);
    req.drafts.submit(
      id,
      {v:0, create:{type:'sexpr', data:sexpr}},
      function(err) {
        if (err) return next(err);
        res.redirect('/' + req.catalog + '/untitled-' + id);
      });
  });
}

app.post('/new/:catalog', isLoggedIn, create);

app.post('/try',function(req, res, next) {
  var id = genId();
  var doc = new Document();
  var sexpr = req.body.sexpr || DEFAULT_DOC;
  doc._id = id;
  doc.catalog = 'anonymous';
  doc.title = '';
  doc.text = '';
  doc.slug = '';
  doc.status = 'full_unlisted'; //anyone can edit
  doc.save(function(err) {
    if (err) return next(err);
    req.drafts.submit(
      id,
      {v:0, create:{type:'sexpr', data:sexpr}},
      function(err) {
        if (err) return next(err);
        res.redirect('/' + doc.catalog + '/untitled-' + doc._id);
      });
  });
});

function canRead(req, res, next) {
  if (!(req.reader || req.collection_reader))
    return next(new Error(401)); // 401 Not Authorized
  next();
}

app.get('/api/history/:catalog/:title', canRead, function(req, res, next) {
  var docName = req.id;
  req.drafts.fetch(docName, function(err, doc) {
      if (err) return next(err);
      if (!doc.type) return next('Unknown file');
      var to = parseInt(req.params.rev || doc.v);
      var from = to - 10000;
      if (from <= 0) from = 1;
      req.drafts.getOps(docName, from, to, function(err, ops) {
        if (err) return next(err);
        var hist = [];
        var last;
        for (var i = ops.length - 1; i >= 0; i--) {
          var op = ops[i];
          var date = new Date(op.m.ts);
          var d = date.valueOf()
          if (last == undefined || d < (last - (15*60000)) ) {
            hist.push({date:date.toISOString(), v:op.v});
            last = d;
          }
        }
        res.send({to:to, from:from, history:hist});
      });
  });
});

//IMPORTANT: These routes need to come last as they might overlap a keyword

app.get('/@:name', doc.listed, userc.loadCatalogs, function(req, res) {
  if (req.isAuthenticated()) {
    res.locals.showNew = true;
    res.locals.newCatalog = !!req.collection_writer ?
      req.catalog :
      req.user.catalog;
  }
  res.locals.showEdit = !!req.collection_owner;
  res.render('profile', {
    collection: req.collection,
    stories: (req.docs || []),
  });
});

app.get('/:collection', doc.listed, userc.loadCatalogs, function(req, res) {
  if (req.isAuthenticated()) {
    res.locals.showNew = true;
    res.locals.newCatalog = !!req.collection_writer ?
      req.catalog :
      req.user.catalog;
  }
  res.locals.showEdit = !!req.collection_owner;
  res.render('collection', {
    collection: req.collection,
    stories: (req.docs || []) //TODO: rename
  });
});

app.get('/:catalog/:title/:rev', function(req, res, next) {
  var doc = req.doc;
  var messages = req.messages || [];
  sharec.revision('draft', req.id, req.params.rev, function(err, snapshot) {
      if (err) return next(err);
          console.log(snapshot.toSexpr())
      if (req.xhr) {
        res.send(snapshot.toSexpr() || '(doc)');
      } else {
        res.render('readonly', {
          title: 'Qubic',
          doc:doc,
          sexpr:snapshot.toSexpr(),
          catalog: req.catalog,
          owns: JSON.stringify(req.collection_owner),
          writes: JSON.stringify(req.writer),
          owns_catalogs: JSON.stringify((res.locals.owns || []).map(function(c) { return { 
            name: c.name,
            catalog: c.catalog,
            title: c.title,
            description: c.description,
          }; })),
          docId: req.doc.id,
          messages: JSON.stringify(messages),
          url: ('/' + req.params.catalog + '/' + req.params.title),
        });
      }
  });
});

//TODO: can we make catalog contain a / so we can have mavxg/proj/doc
// and then restrict the notebooks in a collection to be 1 deep.
app.get('/:catalog/:title', doc.listed, loadSnapshot, userc.loadCatalogs, function(req, res, next) {
  if (!(req.collection_reader || req.reader) || req.deny)
    return next(new Error(401)); // 401 Not Authorized
  if (req.xhr)
    return res.send(res.locals.snapshot.data || '(doc)');
  res.render((req.doc.archived ? 'readonly' : 'edit'), {
      title: 'Qubic',
      sexpr:(res.locals.snapshot.data || '(doc)'),
      doc: req.doc,
      catalog: req.catalog,
      owns: JSON.stringify(!!req.collection_owner),
      writes: JSON.stringify(req.collection_writer || req.writer),
      owns_catalogs: JSON.stringify((res.locals.owns || []).map(function(c) { return { 
        name: c.name,
        catalog: c.catalog,
        title: c.title,
        description: c.description,
      }; })),
      docId: req.id,
      messages: JSON.stringify(req.messages || []),
      url: req.path
  });
});

function loadSnapshot(req, res, next) {
  try {
    req.drafts.fetch(req.id, function(err, doc) {
      if (err) return next(err);
      if (!doc.type) return next('Unknown file');
      res.locals.snapshot = doc;
      return next();
    });
  } catch (e) {
    console.log(e)
    return next(e);
  }
}

//TODO: move this to ot-sexpr

ot.AttributedString.prototype.textContent = function() {
  return this.str;
};
ot.List.prototype.textContent = function() {
  if (!this._textContent) {
    var ts = [];
    this.values.forEach(function(x) {
      if (typeof x.textContent === 'function')
        ts.push(x.textContent());
    });
    this._textContent = ts.join(' '); //space or not?
  }
  return this._textContent;
};

function deleteDoc(req, res, next) {
  //TODO: delete the doc
  req.drafts.submit(req.id, {del:true}, function(err) {
    if (err) return next(err);
    Document.remove({_id:req.id, catalog:req.catalog}, function(err) {
      if (err) return next(err);
      res.redirect('/' + req.catalog);
    });
  });
}

function moveDoc(req, res, next) {
  var doc = req.doc;
  if (!(req.collection_owner))
    return next(new Error(401)); // 401 Not Authorized
  doc.catalog = req.body.catalog
  if (req.body.catalog == ('@' + req.user.name)) {
    return doc.save(function(err) {
      if (err) return next(err);
      res.redirect('/' + req.body.catalog + '/' + req.params.title);
    });
  }
  Collection.findOne({name:req.body.catalog, owners:req.user.name},function(err, col) {
    if (err) return next(err);
    doc.save(function(err) {
      if (err) return next(err);
      res.redirect('/' + req.body.catalog + '/' + req.params.title);
    });
  });
}

function archiveDoc(req, res, next) {
  var doc = req.doc;
  if (!(req.collection_owner))
    return next(new Error(401)); // 401 Not Authorized
  doc.archived = true;
  doc.save(function(err) {
    if (err) return next(err);
    res.redirect('/' + req.params.catalog);
  });
}

function unarchiveDoc(req, res, next) {
  var doc = req.doc;
  if (!(req.collection_owner))
    return next(new Error(401)); // 401 Not Authorized
  doc.archived = false;
  doc.save(function(err) {
    if (err) return next(err);
    res.redirect('/' + req.params.catalog + '/' + req.params.title);
  });
}

//update a document in its current location
//expected to be an ajax call.
app.post('/:catalog/:title', loadSnapshot, function(req, res, next) {
  if (!(req.collection_writer || req.writer))
    return next(new Error(401)); // 401 Not Authorized

  if (req.body.del) {
    console.log("Deleting: " + req.id);
    return deleteDoc(req, res, next);
  }

  if (req.body.move) {
    return moveDoc(req, res, next);
  }

  if (req.body.archive) {
    return archiveDoc(req, res, next);
  }

  if (req.body.unarchive) {
    return unarchiveDoc(req, res, next);
  }
  
  //update document
  var doc = req.doc;
  var body = req.body;

  try {
    var sexpr = ot.parse(res.locals.snapshot.data || '(doc)')[0];
    doc.text = sexpr.textContent();
  } catch (e) {
    console.log(e);
  }

  if (req.body.status && req.collection_writer)
    doc.status = req.body.status;

  //TODO: have a way to override the title.
  doc.title = body.title || doc.title;
  doc.slug = body.slug || doc.slug;
  //update text content from the document snapshot

  //TODO: Update the location (must have write permission on the target)

 doc.save(function(err) {
    if (err) return next(err);
    res.send({message:'Document updated'});
  });
});

app.delete('/:catalog/:title', function(req, res, next) {
  if (!(req.collection_writer || req.writer))
    return next(new Error(401)); // 401 Not Authorized
  deleteDoc(req, res, next);
});

//app.get('/api/:cName/:docName/ops', canRead, sharec.ops);
//app.get('/api/:cName/:docName/hist/:rev?', canRead, sharec.history);
//app.get('/archive/:cName/:docName/:rev', function(req, res, next) {
//    share.revision(req.params.cName, req.params.docName, req.params.rev, function(err, snapshot) {
//        if (err) next(err);
//        res.send(snapshot.toSexpr()); //TODO: check request type and render doc as html or json
//      });
//  })
/*
function show_revision(req, res, next) {
  console.log(req.params);
  var doc = req.doc;
  var messages = req.messages || [];
  //if (req.params.rev) {
  share.revision('draft', req.id, req.params.rev || doc.v, function(err, snapshot) {
          console.log('here')
          console.log(err)
          if (err) return next(err);
          console.log(snapshot.toSexpr())
          if (req.xhr) {
        res.send(snapshot.toSexpr() || '(doc)');
      } else {
        res.render('readonly', {
          doc:doc,
          sexpr:snapshot.toSexpr(),
          catalog: req.catalog,
          owns: JSON.stringify(req.collection_owner),
          writes: JSON.stringify(req.writer),
          docId: req.doc.id,
          messages: JSON.stringify(messages),
        });
      }
  });
}
*/
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;


