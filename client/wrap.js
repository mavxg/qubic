var friar = require('friar');
var DOM         = friar.DOM;
var createClass = friar.createClass;

var Toolbars = require('./toolbar');
var Sidebar = require('./sidebar');
var Slate = require('slatejs');
var ot = Slate.type;
var plugins = Slate.plugins;
var Editor = Slate.Editor;

var Selection = ot.Selection;
var Region    = ot.Region;

//var slatejs_encryption = require('slatejs-encryption');

function findTitle(list) {
	if (!(typeof list === 'object' && list.type === 'list')) return;
	var h = list.head().sym;

	switch (h) {
		case 'h1':
		case 'h2':
			return list.textContent();
		case 'section':
		case 'doc':
		    if (list.attributes && list.attributes.title) return list.attributes.title;
			for (var i = 1; i < list.values.length; i++) {
				var child = list.values[i];
				var t = findTitle(child);
				if (t) return t;
			};
		default:
			return;
	}
}

function findSubtitle(list) {
	if (!(typeof list === 'object' && list.type === 'list')) return;
	var h = list.head().sym;

	switch (h) {
		case 'p':
		case 'h2':
		case 'h3':
		case 'blockquote':
		case 'quote':
			return list.textContent();
		case 'section':
			for (var i = 1; i < list.values.length; i++) {
				var child = list.values[i];
				var t = findTitle(child);
				if (t) break;
			};
			for (i++; i < list.values.length; i++) {
				var child = list.values[i];
				var t = findSubtitle(child);
				if (t) return t;
			};
			return;
		case 'doc':
		    if (list.attributes && list.attributes.subtitle) return list.attributes.subtitle;
			for (var i = 1; i < list.values.length; i++) {
				var child = list.values[i];
				var t = findSubtitle(child);
				if (t) return t;
			};
		default:
			return;
	}
}

var Messages = createClass({
	onMessage: function() {
		var s = this.state;
		var p = this.props;
		this.setState({acknowledged:true});
	},
	render: function() {
		var s = this.state;
		var p = this.props;
		p.messages = p.messages || [];
		var self = this;

		if(s.acknowledged || p.acknowledged || p.messages.length == 0) {
			if (this.timeout)
				clearTimeout(this.timeout);
			return DOM.div({});
		}

		this.timeout = setTimeout(function() {
			self.timeout = null;
			self.setState({acknowledged:true});
		}, 10000);

		return DOM.div({className:"content message"},[
				DOM.div({className:"pure-u-1"},[
					DOM.a({href:"#",className:"btn pull-right", onClick:p.toggleMessages},
					[DOM.em({className:"fa fa-times"},"")]),
					DOM.div({},	p.messages.map(function(msg){
									return DOM.p({},msg);
								})),
				]),
		])
	},
});

var Delete = createClass({
	render: function() {
		var p = this.props;

		return DOM.div({className:'modal-inner delete-modal'},[
				DOM.span({className:"fa fa-trash-o modal-icon"},""),
				DOM.h3({},"Delete Model"),
				DOM.hr({}),
				DOM.p({},[DOM.span({},"Are you sure you want to delete "),DOM.strong({},p.title),DOM.span({},"?")]),
				DOM.form({className:'',action:p.url,method:'post'},[
					DOM.input({type:'hidden', name:'del', value:'true'}),
					DOM.a({className:"pure-button pure-u-1-5", onClick: p.closeDialog},"Cancel"),
					DOM.button({type:'submit',className:"pure-u-1-5 pure-button pure-button-primary"},"Delete")
				])
			]);
	}
})

var SettingsModal = createClass({
	getInitialState: function() {
		var doc = this.props.doc;
		return {
			title: '',
			subtitle: '',
			catalog: '',
			status: this.props.status,
		};
	},
	onChange: function(e) {
		var ele = e.target.form.elements;

		var statuses = ele['status'];
		var status = 'private';
		for (var i=0;i<statuses.length;i++) {
			if (statuses[i].checked) {
				status = statuses[i].value;
				break;
			}
		}

		this.setState({
			title: ele['title'].value || '',
			subtitle: ele['subtitle'].value || '',
			catalog: ele['catalog'].value || '',
			status: status,
		});
	},
	onSubmit: function(e) {
		e.preventDefault();
		e.stopPropagation();
		//this.onChange(e);
		var s = this.state;
		var p = this.props;
		var catalog = s.catalog || p.catalog;
		var req = new XMLHttpRequest();
		var url = p.url;
		//return false;
		req.onreadystatechange = function (data) {
  			// code
  			if (req.readyState == XMLHttpRequest.DONE ) {
  				if (req.status === 200)
  					console.log(data);
  				else if (req.status === 400)
  					console.log(data);
  				else
  					console.log(req.responseText);
  			}
		};
		req.open('POST', url);
		req.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
		var obj = {
			title:(s.title || p.title),
			slug:(s.subtitle || p.subtitle),
			text:p.doc.textContent(),
			data:p.doc.toSexpr(),
			status:s.status,
		};
		req.send(JSON.stringify(obj));
		p.closeDialog();
		return false;
	},
	render: function() {
		var p = this.props;
		var s = this.state;

		var catalog = s.catalog || p.catalog;

		return DOM.div({className:'modal-inner settings-modal'},[
				DOM.span({className:"fa fa-cog modal-icon"},""),
				DOM.h3({},"Model Settings"),
				DOM.hr({}),
				//DOM.p({},[DOM.span({},"Settings for "),DOM.strong({},p.title),DOM.span({},"?")]),
				DOM.form({
					className:'pure-form pure-form-stacked pure-g',
					onChange: this.onChange,
					onSubmit: this.onSubmit,
				},[
	
					DOM.label({'for':'title',className:"pure-u-1"},"Title"),
					DOM.input({
						className:"pure-u-1",
						type:'text',
						placeholder:p.title,
						name:'title',
						id:'title',
						value:s.title}),
					DOM.label({'for':'subtitle',className:"pure-u-1"},"Subtitle"),
					DOM.textarea({
						className:"pure-u-1",
						placeholder:p.subtitle,
						name:'subtitle',
						id:'subtitle',
					}, s.subtitle),
					DOM.label({'for':'status',className:"pure-u-1"},"Visibility"),
					DOM.label({'for':'status_full', className:"pure-u-4-5"},[
						DOM.input({
							type:'radio',
							id:'status_full',
							name:'status',
							value:'full',
							checked: (s.status == 'full'),
						}),
						DOM.text(" Anyone can find and edit"),
					]),
					DOM.label({'for':'status_full_unlisted', className:"pure-u-4-5"},[
						DOM.input({
							type:'radio',
							id:'status_full_unlisted',
							name:'status',
							value: 'full_unlisted',
							checked: (s.status == 'full_unlisted'),
						}),
						DOM.text(" Anyone with the link can edit"),
					]),
					DOM.label({'for':'unlisted', className:"pure-u-4-5"},[
						DOM.input({
							type:'radio',
							id:'status_public',
							name:'status',
							value:'public',
							checked: (s.status == 'public'),
						}),
						DOM.text(" Anyone can find and read"),
					]),
					DOM.label({'for':'status_public_unlisted', className:"pure-u-4-5"},[
						DOM.input({
							type:'radio',
							id:'status_public_unlisted',
							name:'status',
							value: 'public_unlisted',
							checked: (s.status == 'public_unlisted'),
						}),
						DOM.text(" Anyone with the link can read"),
					]),
					DOM.label({'for':'status_private', className:"pure-u-4-5"},[
						DOM.input({
							type:'radio',
							id:'status_private',
							name:'status',
							value: 'private',
							checked: (s.status == 'private'),
						}),
						DOM.text(" Private"),
					]),
					DOM.div({className:"pure-g pure-u-1 modal-button-row"},[
						DOM.a({className:"pure-button pure-u-1-5", onClick: p.closeDialog},"Cancel"),
						DOM.button({
							className:"pure-button pure-button-primary btn pure-u-1-5",
							type:'submit',
						},"Update")
					])
				])
			]);
	}
})


var MoveModal = createClass({
	getInitialState: function() {
		return {
			catalog: this.props.catalog,
			new_collection: '',
		};
	},
	onChange: function(e) {
		var ele = e.target.form.elements;

		var new_collection = ele['name'];

		var cats = ele['catalog'];
		var cat = this.state.catalog;
		for (var i=0;i<cats.length;i++) {
			if (cats[i].checked) {
				cat = cats[i].value;
				break;
			}
		}
		this.setState({catalog:cat, new_collection: new_collection});
	},
	render: function() {
		var p = this.props;
		var s = this.state;

		var catalog = s.catalog;

		var catalogs = window.owns_catalogs.map(function(c) {
			var id = 'catalog_' + c.catalog
			return DOM.label({key:id + '_label', for:id, className:"pure-u-4-5", title: c.description || c.name},[
						DOM.input({
							type:'radio',
							id:id,
							name:'catalog',
							value:c.catalog,
							checked: (c.catalog == catalog),
						}),
						DOM.text(" " + c.catalog),
					]);
		});

		return DOM.div({className:'modal-inner move-modal'},[
				DOM.span({className:"fa fa-book modal-icon"},""),
				DOM.h3({},"Move Model"),
				DOM.hr({}),
				DOM.p({},[DOM.text("Move "),DOM.strong({},p.title || "Untitled"), DOM.text(" from "),DOM.strong({},p.catalog || "Untitled"),DOM.text(" to:")]),
				DOM.form({
					className:'pure-form pure-form-stacked pure-g',
					//onChange: this.onChange,
					action:p.url,
					method:'post',
				},[
					DOM.input({type:'hidden', name:'move', value:'true'}),
					DOM.div({className: "pure-u-1"},catalogs),
					//DOM.label({'for':'catalog_new', className:"pure-u-4-5"},[
					//	DOM.input({
					//		type:'radio',
					//		id:'catalog_new',
					//		name:'catalog',
					//		value:'_new_catalog',
					//		checked: (s.catalog == '_new_catalog'),
					//	}),
					//	DOM.text(" Create new collection ..."),
					//]),
					//DOM.input({
					//	className:"pure-u-1",
					//	style: {"display": (s.catalog == '_new_catalog' ? "block" : "none")},
					//	type:'text',
					//	placeholder:"New catalog name",
					//	name:'name',
					//	id:'new-collection',
					//	value:s.new_collection}),
					DOM.div({className:"pure-g pure-u-1 modal-button-row"},[
						DOM.a({className:"pure-button pure-u-1-5", onClick: p.closeDialog},"Cancel"),
						DOM.button({
							className:"pure-button pure-button-primary btn pure-u-1-5",
							type:'submit',
						},"Move")
					])
				]),
				DOM.p({},[DOM.text("Archive "),DOM.strong({},p.title || "Untitled"), DOM.text(" in "), DOM.strong({},p.catalog|| "Untitled")]),
				DOM.form({
					className:'pure-form',
					action:p.url,
					method:'post',
				},[
					DOM.input({type:'hidden', name:'archive', value:'true'}),
					DOM.div({className:"pure-g pure-u-1 modal-button-row"},[DOM.button({
						className:"pure-button button-error btn pure-u-1-5",
						type:'submit',
					},"Archive")])
				])
			]);
	}
});

//Example of how to make a document undo manager plugin
var undoer = function(app) {
	function undo() {
		app.undo();
	}
	undo.description = function() { return "Undo previous action."; };

	function redo() {
		app.redo();
	}
	redo.description = function() { return "Redo previous action."; };

	return function(editor) {
		return {
			commands: {
				undo,
				redo,
			},
			keymap: [
				{keys:["ctrl+z"], command:"undo"},
				{keys:["cmd+z"], command:"undo"},
				{keys:["ctrl+shift+z"], command:"redo"},
				{keys:["cmd+y"], command:"redo"},
			]
		}
	}
}

//undo manager needs to live in here.
var Wrap = createClass({
	getInitialState: function() {
		var p = this.props;
		p.context._onOp = this.serverApply.bind(this);
		this.undoer = undoer(this);
		return {
			doc: p.context.getSnapshot(),
			selection: new Selection([new Region(7,7)]),
			paused: p.sharedoc.paused,
			catalog: p.catalog,
			sidebar: 'summary',
			search: false,
			editable: (docMode === 'edit'),
			filter: '',
		};
	},
	didMount: function() {
		var sharedoc = this.props.sharedoc;
		sharedoc.on('after op', this.afterOp);
	},
	undo: function() {
		var self = this;
		if (!this.canUndo()) return;
		this.props.undoManager.performUndo(function(err, op) {
			if (err) {
				console.log(err);
				return;
			}
			self.props.undoManager.add(op);
			self._apply(op);
		});
	},
	redo: function() {
		var self = this;
		if (!this.canRedo()) return;
		this.props.undoManager.performRedo(function(err, op) {
			if (err) {
				console.log(err);
				return;
			}
			self.props.undoManager.add(op);
			self._apply(op);
		});
	},
	canUndo: function() {
		return this.props.undoManager.canUndo();
	},
	canRedo: function() {
		return this.props.undoManager.canRedo();
	},
	serverApply: function(op) {
		//serverApply must not throw or ops get duplicated
		try {
			var selection = ot.transformCursor(this.state.selection, op, false);
			this.setState({doc: this.props.context.getSnapshot(), selection: selection});
			this.props.undoManager.transform(op);
		} catch (e) {
			console.log(e);
		}
	},
	afterOp: function(op, localcontext) {
		if (!localcontext) this.onChange();
	},
	willUnmount: function() {
		this.props.sharedoc.removeListener('after op', this.afterOp);
	},
	updateSlug: function() {
		if (window.readonly) return;
		console.log('updateSlug');
		var p = this.props;
		var s = this.state;
		var doc = s.doc;
		if (doc === undefined || doc === null) return;
		var req = new XMLHttpRequest();
		//return false;
		req.onreadystatechange = function (data) {
  			// code
  			if (req.readyState == XMLHttpRequest.DONE ) {
  				if (req.status === 200)
  					console.log(req.responseText);
  				else if (req.status === 400)
  					console.log(req.responseText);
  				else
  					console.log(req.responseText);
  			}
		};
		req.open('POST', p.url);
		req.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
		var obj = {
			title:findTitle(doc),
			slug:findSubtitle(doc),
		};
		console.log(JSON.stringify(obj))
		req.send(JSON.stringify(obj));
		return false;
	},
	onChange: function() {
		var doc = this.props.context.getSnapshot();
		if (doc === undefined) return;

		if (doc !== this.state.doc)
			this.setState({doc: doc});
		//Update the document (TODO: don't do this if paused)
		if (this.timeout) //unless we have more than a minutes changes to save
			clearTimeout(this.timeout);
		var self = this;
		if (this.props.sharedoc.paused || !this.state.editable) return; //Don't update paused
		this.timeout = setTimeout(function() {
			self.timeout = null;
			self.updateSlug();
		}, 1000); //TODO: 0 if we have more than 1 minutes changes to save.
	},
	toggleSidebar: function(n) {
		var s = this.state;
		this.setState({sidebar:(s.sidebar === n ? 'none' : n )});
	},
	onErrors: function() {
		this.toggleSidebar('errors');
	},
	onNotebooks: function() {
		this.toggleSidebar('notebooks');
	},
	onStarred: function() {
		this.toggleSidebar('starred');
	},
	onCollections: function() {
		//TODO: might want this to be a modal
		// not a sidebar.
		this.toggleSidebar('collections');
	},
	onSummary: function() {
		this.toggleSidebar('summary');
	},
	onInfo: function() {
		this.toggleSidebar('info');
	},
	onHistory: function() {
		this.toggleSidebar('history');
	},
	onSearch: function() {
		if (!this.state.search)
			this.setState({sidebar:'summary', search:true, filter:''});
		else
			this.setState({search:false, filter:''});
	},
	onSearchChange: function(e) {
		this.setState({filter:e.target.value});
	},
	onMessageAck: function() {
		this.setState({acknowledged:true});
	},
	pause: function() {
		this.props.sharedoc.pause();
		this.setState({paused: this.props.sharedoc.paused});
	},
	resume: function() {
		this.props.sharedoc.resume();
		this.updateSlug();
		this.setState({paused: this.props.sharedoc.paused});

	},
	star: function() {
		//TODO: star document api
		this.setState({starred: !this.state.starred});
	},
	showDelete: function() {
		this.setState({modal: 'delete'});
	},
	showSettings: function() {
		this.setState({modal: 'settings'});
	},
	showMove: function() {
		this.setState({modal: 'move'});
	},
	closeDialog: function() {
		this.setState({modal: undefined});
	},
	select: function(selection) {
		if (this.state.selection !== selection)
			this.setState({selection: selection});
	},
	_apply: function(op, selection) {
		var context = this.props.context;
		context.submitOp(op);
		var sel = selection ? selection :
			ot.transformCursor(this.state.selection, op, true);
		this.setState({doc: context.getSnapshot(), selection: sel});
		this.onChange();
	},
	apply: function(op, selection, compose) {
		this._apply(op, selection);
		this.props.undoManager.add(op, compose);
		console.log('apply(ed)');
	},
	render: function() {
		var p = this.props;
		var s = this.state;
		//Document not available yet
		if (s.doc === undefined)
			return DOM.h1({},"Document Loading...");

		var cname = 'book ' + s.sidebar;
		this.editor = Editor({
			id: "preview",
			document: s.doc,
			apply: this.apply,
			select: this.select,
			selection: s.selection,
			//plugins:[undoer, base, table]
			plugins: [
				plugins.base,
				plugins.table,
				this.undoer,
				p.qubePlugin,
				//slatejs_qube,
				//slatejs_encryption,
			],
		});
		var title = findTitle(s.doc);		
		var subtitle = findSubtitle(s.doc);
		var bcname = "book-content";
		var modals = [];
		var modal_class = '';
		if (s.modal) {
			modal_class = 'show-modal';
			switch(s.modal) {
				case 'delete':
					modals = [Delete({
						id: 'modal-dialog',
						title: title,
						url: p.url,
						closeDialog: this.closeDialog
					})];
					break;
				case 'settings':
					modals = [SettingsModal({
						doc:s.doc,
						docId: p.docId,
						owns: p.owns,
						catalog: s.catalog,
						title: title,
						status: p.status,
						subtitle: subtitle,
						url: p.url,
						closeDialog: this.closeDialog
				})];
					break;
				case 'move':
					modals = [MoveModal({
						doc:s.doc,
						docId: p.docId,
						owns: p.owns,
						catalog: s.catalog,
						title: title,
						url: p.url,
						closeDialog: this.closeDialog
				})];
			}
		}
		var Toolbar = p.readonly ? Toolbars.ToolbarReadonly : Toolbars.Toolbar;
		return DOM.div({className:cname}, [
			Sidebar({
				id:"sidebar",
				show:s.sidebar,
				search:s.search,
				doc:s.doc,
				onSearchChange:this.onSearchChange,
				filter:s.filter,
			}),
			DOM.div({id:"book-content", className:bcname},[
				Toolbar({
					id: "toolbar",
					className: "toolbar",
					title: title,
					toggleSummary: this.onSummary,
					toggleInfo: this.onInfo,
					toggleHistory: this.onHistory,
					toggleSearch: this.onSearch,
					toggleSettings: this.onSettings,
					toggleErrors: this.onErrors,
					toggleNotebooks: this.onNotebooks,
					toggleCollections: this.onCollections,
					toggleStarred: this.onStarred,
					showDelete: this.showDelete,
					showSettings: this.showSettings,
					showMove: this.showMove,
					editable: s.editable,
					docId: p.docId,
					url: p.url,
					defaultCatalog: p.defaultCatalog,
					catalog: s.catalog,
					doc: s.doc,
					sharedoc: p.sharedoc,
					pause: this.pause,
					resume: this.resume,
					paused: s.paused,
				}),
				Messages({
					acknowledged: s.acknowledged,
					messages: p.messages,
					toggleMessages: this.onMessageAck,
				}),
				DOM.div({id:"preview"},[this.editor]),
			]),
			DOM.div({id:"modal",className:modal_class},[
				DOM.div({className:'modal-outer'},[
					DOM.div({className:'modal-cell'},modals)])]),
		]);
	},
});

module.exports = Wrap;