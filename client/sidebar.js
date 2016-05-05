var friar = require('friar');
var slatejs = require('slatejs');
var DOM         = friar.DOM;
var createClass = friar.createClass;
var moment = require('moment');

var ql = require('qube');

var keyToId = slatejs.keyToId;

function toHeaders(list, filter, stack, num) {
	stack = stack || [];
	num = num || [0,0,0,0,0,0,0];
	level = 0;
	for (var i = num.length - 1; i >= 0; i--) {
		if (num[i] > 0) {
			level = i;
			break;
		}
	};

	//console.log(list)
	//console.log(list instanceof List)

	if (!(typeof list === 'object'))
		return stack;

	function clearAfter(l) {
		for (var i = num.length - 1; i > l; i--)
			num[i] = 0;
	}

	//console.log("toHeaders")
	//console.log(list.head)
	var h = list.head().sym;
	var show = !(filter && !(filter.test(list.textContent())))
	switch (h) {
		case 'h1':
		case 'h2':
		case 'h3':
		case 'h4':
		case 'h5':
		case 'h6':
		    var lvl = parseInt(h.slice(1));
		    if (lvl < level) clearAfter(lvl);
		    num[lvl]++;
		    if (show)
				stack.push({level:lvl, text:list.textContent(), id:list.id, num:num.slice(1,lvl+1).join('.')});
			//console.log(stack)
			break;
		case 'encrypted':
			num[0]++;
			clearAfter(0);
			if (show)
				stack.push({level:0, text:'Section', id:list.id, num:Roman(num[0]), tag:'lock'});
			break;
		case 'section':
		case 'encrypt':
		    num[0]++;
			clearAfter(0);
			var el = {level:0, text:'Section', id:list.id, num:Roman(num[0])}
			if (h === 'encrypt')
				el.tag ='unlock';
			if (show)
				stack.push(el);
			//fall through
		case 'doc':
			for (var i = 1; i < list.values.length; i++) {
				var child = list.values[i];
				toHeaders(child, filter, stack, num);
			};
			break;
		default:
			if (filter && show)
				stack.push({level:6, text:list.textContent(), id:list.id, num:''});
			break;
	}
	return stack;
}

function toRef(id) {
	return "#clay:" + id.toString(36);
}

//really noddy but will do for now
var ROMAN = ['0','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII'];
function Roman(n) {
	return ROMAN[n] || n;
}

var Summary = createClass({
	render: function() {
		var p = this.props;
		var doc = p.doc;
		var filter;
		if (p.filter && p.filter.length >= 3)
			try {
				filter = new RegExp(p.filter,'ig');
			} catch(e) {
				console.log(e);
			}
		var hs = toHeaders(doc, filter);
		var cs = hs.map(function(it) {
			var cels = [
			DOM.span({},it.text),
			]
			if (it.level === 0)
				cels.push(DOM.span({},' ' + it.num));
			else
				cels.unshift(DOM.span({}, it.num + ' '));
			if (it.tag) {
				cels.push(DOM.span({className:("fa fa-" + it.tag)},""));
			}
			return DOM.li({},[
				DOM.a({href:toRef(it.id)},cels),
				]);
		})
		return DOM.ul({className:"summary"},cs);
	},
});

var Info = createClass({
	render: function() {
		return DOM.div({className:"info"},[
			DOM.h3({},"Help"),
			DOM.p({},"Insert Table: Ctrl+Alt+t"),
			DOM.p({},"Insert Row: Enter (in table)"),
			DOM.p({},"Insert Column Before: Ctrl+Alt+c (in table)"),
			DOM.p({},"Insert Column After: Ctrl+Alt+d (in table)"),
			DOM.p({},"Bold: Ctrl+b"),
			DOM.p({},"Italics: Ctrl+i"),
			DOM.p({},"Superscript: Ctrl+."),
			DOM.p({},"Subscript: Ctrl+,"),
			DOM.p({},"Strike through: Alt+Shift+5"),
			DOM.p({},"Code: Space (on new line)"),
			DOM.p({},"Blockquote: > Space (on new line)"),
			DOM.p({},"Heading 1: # Space (on new line)"),
			DOM.p({},"Heading 2: ## Space (on new line)"),
			DOM.p({},"Heading 3: ### Space (on new line)"),
			DOM.p({},"Heading 4: #### Space (on new line)"),
			DOM.p({},"Multiple selection: Hold down Ctrl while selecting to get multiple selections."),
			]);
	}
});

var History = createClass({
	getInitialState: function() {
		return {history:[], more:false}
	},
	updateHistory: function(hist) {
		var history = this.state.history.concat(hist.history);
		this.setState({history:history, from:hist.from, more:(hist.from > 1)})
	},
	loadMore: function() {
		this.setState({more:false});
		var req = new XMLHttpRequest();
		var url = '/api/history'+window.url
		if (this.state.from)
			url += '?rev=' + this.state.from;
		var updateHistory = this.updateHistory;
		//return false;
		req.onreadystatechange = function (data) {
  			// code
  			if (req.readyState == XMLHttpRequest.DONE ) {
  				if (req.status === 200)
  					updateHistory(JSON.parse(req.responseText));
  				else if (req.status === 400)
  					console.log(data);
  				else
  					console.log(req.responseText);
  			}
		};
		req.open('GET', url, true);
		req.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
		req.send();
	},
	didMount: function() {
		this.loadMore();
	},
	onLoadMore: function(e) {
		e.preventDefault();
		this.loadMore();
		return false;
	},
	render: function() {
		var hist = [
			DOM.h3({key:'hist'},"History")
		]
		var doc = this.props.doc;
		var parent = window.parent;
		var today = moment();
		var year = today.year();
		var month = today.month();
		var day = today.day();
		this.state.history.forEach(function(h, i) {
			var d = moment(h.date);
			var dy = d.year();
			var dm = d.month();
			var dd = d.day();
			var url = '/' + window.catalog + '/' + window.docId + '/' + h.v
			if (dy != year) {
				hist.push(DOM.h4({key:i+'_year'},""+dy));
				year = dy;
				month = -1;
				day = -1;
			}
			if (dm != month) {
				hist.push(DOM.h4({key:i+'_month'},d.format('MMMM')));
				month = dm;
				day = -1;
			}
			if (dd != day) {
				hist.push(DOM.h4({key:i+'_day'},d.format('ddd Do')));
				day = dd;
			}
			hist.push(DOM.a({key:i, href: url, style:{display:'block'}},d.format('H:mm a')));
		})
		parent && hist.push(
			DOM.a({key:'parent', href:parent},"Source Qube"));
		if (this.state.more) {
			hist.push(DOM.a({key:'load', onClick:this.onLoadMore, href:'#'},"Load More ..."))
		}
		return DOM.div({className:"history"},hist);
	}
});

//list of errors for the current open notebook
var ErrorList = createClass({
	render: function() {
		var cells = this.props.cells;
		var errors = [];
		if (cells) cells.forEach(function(cell) {
			if (cell.errors && cell.errors.length > 0)
				errors.push(cell);
		});
		if (errors.length > 0) {
			return DOM.div({className:'errors'},[
			DOM.h3({key:'errors'},"Errors"),
			DOM.div({key:'elist'},errors.map(function(cell) {
				return DOM.div({},[
					DOM.a({href: '#' + keyToId(cell.context.node), className:"error"},ql.showMr(cell.originalSexpr)),
					DOM.pre({className:"error"},[DOM.code({}, cell.errors[0])])
				]);
			}))
			]);
		}
		return DOM.div({className:'errors'},[
			DOM.h3({key:'errors'},"Errors"),
			DOM.p({},"No errors found.")
		]);
	},
});

//list of all stared items
var Starred = createClass({
	render: function() {
		return DOM.div({className:'starred'},[
			DOM.h3({key:'starred'},"Starred"),
		]);
	},
});

//list of collections
var Collections = createClass({
	render: function() {
		return DOM.div({className:'collections'},[
			DOM.h3({key:'collections'},"Collections"),
		]);
	},
});

//list of notebooks in the current collection
var Notebooks = createClass({
	render: function() {
		return DOM.div({className:'notebooks'},[
			DOM.h3({key:'notebooks'},"Notebooks"),
		]);
	},
});

var Sidebar = createClass({
	render: function() {
		var doc = this.props.doc;
		
		var p = this.props;
		var showSearch = !!p.search;
		var cname = 'sidebar';
		if (showSearch && p.show === 'summary')
			cname += ' with-search';

		var Show;
		switch (p.show) {
			case 'info':
				Show = Info;
				break;
			case 'history':
				Show = History;
				break;
			case 'starred':
				Show = Starred;
				break;
			case 'errors':
				Show = ErrorList;
				break;
			case 'collections':
				Show = Collections;
				break;
			case 'notebooks':
				Show = Notebooks;
				break;
			default:
				Show = Summary;
				break;
		}
		
		return DOM.div({id:this.props.id, className:cname},[
			DOM.div({className:"book-search"},[
				DOM.input({
					type:"text",
					placeholder:"Type to search",
					className:"form-control",
					//onChange: p.onSearchChange,
					onKeyup: p.onSearchChange,
					value: p.filter,
					}),
				]),
			Show({filter:p.filter, doc:doc, cells:p.cells, ast: p.ast}),
			]);
	},
});

module.exports = Sidebar;