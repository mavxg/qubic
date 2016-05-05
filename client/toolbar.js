var friar = require('friar');
var DOM         = friar.DOM;
var createClass = friar.createClass;
/*
					toggleErrors: this.onErrors,
					toggleNotebooks: this.onNotebooks,
					toggleCollections: this.onCollections,
*/
var Toolbar = createClass({

	render: function() {
		var p = this.props;
		var s = this.state;
		var d = p.doc.toSexpr();
		return DOM.div({className:'toolbar'},[
			DOM.a({href:"#",className:"btn pull-left", onClick:p.toggleSummary},
				[DOM.em({className:"fa fa-align-justify"},"")]),
			DOM.a({href:"#",className:"btn pull-left", onClick:p.toggleSearch},
				[DOM.em({className:"fa fa-search"},"")]),
			DOM.a({href:"#",className:"btn pull-left", onClick:p.toggleInfo},
				[DOM.em({className:"fa fa-question-circle"},"")]),
			DOM.a({href:"#",className:"btn pull-left", onClick:p.toggleHistory},
				[DOM.em({className:"fa fa-history"},"")]),
			DOM.a({href:"#",className:(p.hasErrors ? "btn pull-left error" : "btn pull-left"), onClick:p.toggleErrors},
				[DOM.em({className:"fa fa-exclamation-triangle"},"")]),
			DOM.a({href:"/" + window.catalog,className:"btn pull-right"},
				[DOM.em({className:"fa fa-arrow-left"},"")]),
			DOM.a({href:"#",className:"btn pull-right", onClick:p.showSettings},
				[DOM.em({className:"fa fa-cog"},"")]),
			DOM.a({href:"#",className:"btn pull-right", onClick:p.showMove},
				[DOM.em({className:"fa fa-book"},"")]),
			DOM.a({href:"#",className:"btn pull-right", onClick: (p.paused ? p.resume : p.pause)},
				[DOM.em({className:(p.paused ? "fa fa-play" : "fa fa-pause")},"")]),
			DOM.form({action:"/new/" + p.defaultCatalog, method:'post',className:"pull-right"},
				[DOM.input({type:'hidden', name:'sexpr', value:d}),
				 DOM.input({type:'hidden', parent:p.url}),
				 DOM.button({type:'submit',className:"btn pull-right"},
				 	[DOM.em({className:"fa fa-copy"},"")])
				]),
			//DOM.a({href:"#",className:"btn pull-right", onClick:p.star},
			//	[DOM.em({className:"fa fa-star-o"},"")]),
			DOM.a({href:"#",className:"btn pull-right", onClick:p.showDelete},
				[DOM.em({className:"fa fa-trash-o"},"")]),		
			DOM.h1({},(p.title || 'Untitled')), //Put connected users here??
			]);
	},
});

var ToolbarReadonly = createClass({

	render: function() {
		var p = this.props;
		var s = this.state;
		var d = p.doc.toSexpr();
		return DOM.div({className:'toolbar'},[
			DOM.a({href:"#",className:"btn pull-left", onClick:p.toggleSummary},
				[DOM.em({className:"fa fa-align-justify"},"")]),
			DOM.a({href:"#",className:"btn pull-left", onClick:p.toggleSearch},
				[DOM.em({className:"fa fa-search"},"")]),
			DOM.a({href:"#",className:"btn pull-left", onClick:p.toggleInfo},
				[DOM.em({className:"fa fa-question-circle"},"")]),
			DOM.a({href:"#",className:"btn pull-left", onClick:p.toggleHistory},
				[DOM.em({className:"fa fa-history"},"")]),
			DOM.a({href:"#",className:(p.hasErrors ? "btn pull-left error" : "btn pull-left"), onClick:p.toggleErrors},
				[DOM.em({className:"fa fa-exclamation-triangle"},"")]),
			DOM.a({href:"/" + window.catalog,className:"btn pull-right"},
				[DOM.em({className:"fa fa-arrow-left"},"")]),
			DOM.form({action:"/new/" + p.defaultCatalog, method:'post',className:"pull-right"},
				[DOM.input({type:'hidden', name:'sexpr', value:d}),
				 DOM.input({type:'hidden', parent:p.url}),
				 DOM.button({type:'submit',className:"btn pull-right"},
				 	[DOM.em({className:"fa fa-copy"},"")])
				]),		
			DOM.h1({},(p.title || 'Untitled')), //Put connected users here??
			]);
	},
});

module.exports = {
	Toolbar: Toolbar,
	ToolbarReadonly: ToolbarReadonly
};