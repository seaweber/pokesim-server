const axios = require('axios');

module.exports.retrieveParty = user_id => {

    return axios.get( `https://us-central1-pokemon-412.cloudfunctions.net/retrieve-party?user_id=${ user_id }` );
};
