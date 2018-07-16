const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const expressWinston = require('express-winston');
const csrf = require('csurf');
const session = require('express-session');
const cookieParser = require('cookie-parser');
require('winston-daily-rotate-file');
require('dotenv').config();

// mongodb config
const dbConfig = require('./config/dbconfig');

// require routes
const users = require('./routes/users');

// Initializing express app
const app = express();

// Adds helmet middleware
app.use(helmet());

//Etag disable
app.set('etag', false);

//Body Parser Configuration
app.use(bodyParser.json({ // to support JSON-encoded bodies
  limit: '1mb'
}));

app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
  limit: '1mb',
  extended: true
}));

// Mongoose connection
mongoose.Promise = global.Promise;
mongoose.connect(dbConfig.url, { useNewUrlParser: true })
  .then(() => {
    winston.info('database connected successfully');
  })
  .catch((err) => {
    winston.error(err);
  });

mongoose.connection.on('error', (err) => {
  winston.error(err);
  winston.info('%s MongoDB connection error. Please make sure MongoDB is running.');
  process.exit();
});

// Using CORS
app.use(cors());

//Rate Limit for API
app.enable('trust proxy');  // only if you're behind a reverse proxy (Heroku, Bluemix, AWS if you use an ELB, custom Nginx setup, etc

const limiter = new rateLimit({
  windowMs: 60 * 1000, // 1 minutes
  max: 50, // limit each IP to 100 requests per windowMs
  delayMs: 0 // disable delaying - full speed until the max limit is reached
});

//  apply to all requests
app.use(limiter);

// winston Configuration
expressWinston.requestWhitelist.push('body');
expressWinston.responseWhitelist.push('body');
expressWinston.bodyBlacklist.push('backupkey', 'password', 'pin', 'mPass', 'keyObject');
app.use(expressWinston.logger({
  transports: [
    new (winston.transports.DailyRotateFile)({
      dirname: './logs',
      filename: 'access-%DATE%.log',
      datePattern: 'YYYY-MM-DD-HH',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '1d'
    })]
}));

// express-seeeions config
app.use(session({
  secret: 'My super session secret',
  cookie: {
    httpOnly: true,
    secure: true,
  },
  resave: false,
  saveUninitialized: false,
}));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// csurf config
app.use(csrf({ cookie: true }));

// Router Initialization
app.use('/api', users);

module.exports = app;

// Server Initialization
app.listen(process.env.PORT, process.env.HOST, () => {
  winston.info(`Server started on ${new Date()}`);
  winston.info(`server is running at http://${process.env.HOST}:${process.env.PORT}`);
});