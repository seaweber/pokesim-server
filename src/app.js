require('dotenv').config();

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const session = require('express-session');
//const MongoStore = require('connect-mongo')(session);
const passport = require('passport');
//const mongo = require('./services/db');

const Session = require('./models/Session');

// general setup
const app = express();

const server = require( 'http' ).createServer( app );

const io = require( 'socket.io' )( server );

// declare routers
const indexRouter = require('./routes/indexRouter')( io );

// database setup
// async function startDB() {
//     await mongo.init();
// }

// session setup
// app.use(session({
//     // store: new MongoStore({
//     //     url: process.env.CONNECTION_URI
//     // }),
//     secret: process.env.SECRET,
//     resave: true,
//     saveUnintialized: true,
//     // 2 weeks
//     cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 * 2 }
// }));

//startDB();

// passport setup
app.use(passport.initialize());
app.use(passport.session());

app.use( ( req,res,next ) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    if( req.isAuthenticated() ) res.locals.isAuthenticated = req.isAuthenticated();
    next();
});

// view engine setup
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'hbs');

// add middleware
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use( (req, res, next) => {
    next(createError(404));
});

// error handler
// app.use( (err, req, res, next) => {
//
//     // set locals, only providing error in development
//     res.locals.message = err.message;
//     res.locals.error = req.app.get('env') === 'development' ? err : {};
//
//     // render the error page
//     res.status(err.status || 500);
//     res.send(JSON.stringify(err));
// });

module.exports = server;
