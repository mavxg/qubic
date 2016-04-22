const Collection = require('../models/collection');
const router     = require('express').Router();
const params     = require('../app/params');

router.get('/new', function(req, res) {
	var collection = new Collection();
	collection.name = '';
	collection.title = '';
	collection.description = '';
	collection.owners.push(req.user.name);
	res.render('collection/new', {collection:collection});
});

router.post('/new', function(req, res) {
	var col = new Collection();
	var body = req.body;
	//TODO: validate name
	col.name = req.body.name.replace(' ','-');
	col.title = req.body.title;
	col.description = req.body.description;
	col.owners = body.owners.split(/ *[,;] */g);
	if (col.owners.length === 0)
		col.owners.push(req.user.name);
	col.writers = body.writers.split(/ *[,;] */g);
	col.readers = body.readers.split(/ *[,;] */g);
	col.save(function (err) {
		if (err) {
			req.flash('new-collection', err);
			return res.render('collection/new', {
				collection:col
			});
		}
		res.redirect('../'+ col.name);
	});
});

//assumes you have already logged in and loaded a collection
function isOwner(req, res, next) {
	if (req.collection.owners.indexOf(req.user.name) === -1)
		next('You do not have permission to edit this collection');

	res.locals.newCatalog = req.collection.name;
	next();
}

router.param('collection', params.findCollection);

router.get('/settings/:collection', isOwner, function(req, res, next) {
	res.render('collection/settings', {
		collection: req.collection
	});
});

router.post('/settings/:collection', isOwner, function(req, res, next) {
	var body = req.body;
	var col = req.collection;
	col.name = body.name.replace(' ','-');
	col.title = body.title;
	col.description = body.description;
	col.owners = body.owners.split(/ *[,;] */g);
	if (col.owners.length === 0)
		col.owners.push(req.user.name);
	col.writers = body.writers.split(/ *[,;] */g);
	col.readers = body.readers.split(/ *[,;] */g);
	col.save(function(err) {
		if (err) {
			req.flash('collection/settings', err);
  			return res.render('collection/settings', {
  				collection:col
  			});
		}
		res.redirect('../'+col.name);
	})
});

module.exports = router;