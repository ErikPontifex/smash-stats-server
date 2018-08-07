const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const setSchema = new Schema({
    setID: {type: Number, required: true},
    player1ID: {type: Number},
    player1Tag: {type: String},
    player2ID: {type: Number},
    player2Tag: {type: String},
    player1Score: {type: Number},
    player2Score: {type: Number},
    winnerID: {type: Number},
    loserID: {type: Number},
    fullRoundText: {type: String},
    phaseName: {type: String},
    tournamentName: {type: String},
    time: {type: Number},
    games: [{}],

    
}, {collection: 'sets'});

const Set = mongoose.model('Set', setSchema);

module.exports = Set;