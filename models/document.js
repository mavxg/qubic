var mongoose = require('mongoose');


/*
Document represents the published document.

Note: since _id is unique a document can appear
in one and only one collection.
*/
var documentSchema = mongoose.Schema({
	_id : String,
	catalog: String, //<collection.name> or @<user.name>
	title: String,
	slug: String,
	text: String,
	data: String, //snapshot
	version: { type: Number, default: 0 },
	created: { type: Date, default: Date.now },
	updated: { type: Date, default: Date.now },
	status: { type: String, default: 'private' },
	archived: { type: Boolean, default: false }, //archive
	writers: [String],
	readers: [String],
	parent: String,
	parent_v: Number //parent version
});

documentSchema.index({
	title: 'text', 
	text: 'text', 
	slug: 'text',
	status: 1,
	catalog: 1
},{
	weights:{
		title:10,
		slug:5
		//text: 1
	}
});
documentSchema.index({catalog: 1, status: 1});
documentSchema.index({catalog: 1, status: 1, archived: 1});

documentSchema.pre('save', function(next){
  now = new Date();
  this.updated = now;
  next();
});

module.exports = mongoose.model('Document', documentSchema);