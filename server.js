var app = require('./app');

const port = process.env.QUBE_PORT || 3000;
const host = process.env.QUBE_HOST || '0.0.0.0'

var server = app.listen(port, host, function() {
    console.log('Listening on port %d', server.address().port);
});