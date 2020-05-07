const app = require('./src/app');

const Session = require('./src/models/Session');

const server = app.listen( 8080, async () => {

    console.log( `Express is running on port ${ server.address().port }` );

});
