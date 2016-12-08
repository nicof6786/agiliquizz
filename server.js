var express = require('express');
var app = express();

app.use('/agiliquizz/static', express.static(__dirname + '/static'));

app.get('/agiliquizz/*', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.get('*', function (req, res) {
    res.redirect('/agiliquizz/');
});

app.listen(8086);