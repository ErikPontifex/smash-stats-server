const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tournamentSchema = new Schema({
    slug: {type: String},
    tournamentID: {type: Number},
    name: {type: String},
    startAt: {type: Number},
    endAt: {type: Number},
    city: {type: String},
    addrState: {type: String},
    countryCode: {type: String},
    venueName: {type: String},
    venueAddress: {type: String},
    images: [{}],
    events: [{}],
    phases: [{}],
    groups: [{}],
    setIDs: {type: [Number]}

}, {collection: 'tournaments'});

const Tournament = mongoose.model('tournament', tournamentSchema);

module.exports = Tournament;