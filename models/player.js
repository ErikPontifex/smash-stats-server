const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const playerSchema = new Schema({
    playerID: {type: Number, required: true},
    gamerTag: {type: String, required: false},
    prefix: {type: String, required: false},
    name: {type: String, required: false},
    twitterHandle: {type: String, required: false},
    twitchStream: {type: String, required: false},
    state: {type: String, required: false},
    region: {type: String, required: false},
    country: {type: String, required: false},
    images: [{}],
    rankings: [{}],
    setIDs: {type: [Number], required: true}

}, {collection: 'players'});

module.exports = mongoose.model('Player', playerSchema);