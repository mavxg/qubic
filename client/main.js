var slatejs = require('slatejs');
var ql      = require('qube');
var xl      = require('qube-excel');
var slatejs_qube = require('slatejs-qube');
var slatejs_encryption = require('slatejs-encryption');
var share = require('share/lib/client');
var ec    = require('encrypted-context')(slatejs);
var Wrap = require('./wrap');
var friar = require('friar');
var Dummy = require('dummy-sharejs-connection');
var UndoManager = require('undomanager');
window.Slate = slatejs;

share.registerType(slatejs.type);

document.addEventListener('DOMContentLoaded', function () {

	//TODO: remove dummy dependency and make a
	// true readonly store to pass to Wrap
	if(docMode=='edit'){
		var dummy = new BCSocket(null, {reconnect: true});
		dummy.canSendJSON = false; //need this because goog.json.serialize doesn't call toJSON	
	} else {
		var dummy = new Dummy(slatejs.ottypes);
	}

	var share_connection = new share.Connection(dummy);
	window.share_connection = share_connection;
	share_connection.debug = true;
	var sharedoc = share_connection.get(docCollection, docId); //docCollection and docId set in the view
	sharedoc.subscribe();

	var qube = new ql.Qube(ql.prelude);
	qube.extend(xl);
	window.qube = qube;
	//qube plugin will monkey patch the type
	var qubePlugin = slatejs_qube(qube, slatejs);

	var doc = window.docSexpr || '(doc (section (h1 "") (p "")))';

	var catalog = window.catalog || 'unknown';

	sharedoc.whenReady(function() {
		if (!sharedoc.type) {
			sharedoc.create('sexpr', doc);
		}
		else {
			sharedoc.snapshot = slatejs.type.deserialize(sharedoc.snapshot);
		}

		qube.clear();
		qube.exprs(sharedoc.snapshot.qube_expressions());
		qube.build();

		var baseContext = sharedoc.createContext();
		var context = new ec.EncryptedContext(baseContext);
		var encryptionPlugin = slatejs_encryption(context, slatejs);

		var undoManager = new UndoManager(slatejs.type, 400);
		var p = slatejs.plugins;
		var plugins = [p.base, p.table, qubePlugin, encryptionPlugin];

		window.wrap = Wrap({
			qube: qube,
			plugins: plugins,
			sharedoc: sharedoc,
			context: context,
			undoManager: undoManager,
			catalog: catalog,
			defaultCatalog: window.defaultCatalog,
			docId: window.docId,
			owns: window.owns || [],
			status: window.docStatus || 'private',
			messages: window.messages || [],
			readonly: window.readonly,
			url: window.url || ('/' + catalog + '/' + window.docId),
		});

		try {
			friar.renderComponent(wrap, document.getElementById('wrap'));
		} catch (e) {
			console.log('Failed at render');
			console.log(e);
		}
	});
});
