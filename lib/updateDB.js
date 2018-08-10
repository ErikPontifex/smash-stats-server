var jsonfile = require('jsonfile');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var Promise = require('bluebird');
var async = require('async');
var schedule = require('node-schedule');
var mongoose = require('mongoose');

var createTournament = require('./createTournament.js').createTournament;
var createPlayer = require('./createPlayer.js').createPlayer;
var getAllSearchResults = require('./getSearchResults.js').getAllSearchResults;

var Player = require('../models/player.js');
var SetModel = require('../models/set.js');
var Tournament = require('../models/tournament.js');

function union(set1, set2) {
    return new Set([...set1, ...set2]);
}

function getPlayerIds(tournament) {
    var playerIDs = new Set();

    tournament.sets.forEach(set => {
        playerIDs.add(set['player1ID']);
        playerIDs.add(set['player2ID']);
    });

    return playerIDs;
}

function getSetIds(tournament) {
    var setIDs = [];
    if(tournament !== undefined){
        tournament.sets.forEach(set => {
            setIDs.push(set['setID']);
        });
    }

    return setIDs;
}

function checkDBForTournament(slug){
    return new Promise(function (resolve, reject) {
        console.log('searching for tournament ' + slug);
        Tournament.findOne({slug: slug}, function(err, result){
            console.log('finished searching for tournament ' + slug);
            if (err) reject(err);
            if (result === null) resolve(true);
            else resolve(false);
        });
    });
}

function checkDBForPlayer(playerID){
    return new Promise(function(resolve, reject){
        Player.findOne({playerID: playerID}, function(err, result){
            if (err) reject(err);
            if (result === null) resolve(true);
            else resolve(false);
        });                        
    });

}

function getSetOfPlayerIDs(tournaments) {
    var playerIDs = new Set();
    tournaments.forEach(tournament => {
        playerIDs = union(playerIDs, getPlayerIds(tournament));
        console.log('playerIDs: ' + playerIDs);
    });
    return playerIDs;
}

function createTournamentPromise(slug) {
    return new Promise(function(resolve, reject){
        createTournament(slug)
        .then(function(tournament){
            resolve(tournament);
        })
        .catch(function(err){
            reject(err);
        });
    });
}

function createPlayerPromise(playerID) {
    return new Promise(function(resolve, reject){
        console.log('creating player ' + playerID);
        createPlayer(playerID)
        .then(function(player){
            console.log('created player ' + playerID);
            resolve(player);
        })
        .catch(function(err){
            console.log('error creating player ' + playerID);
            reject(err);
        });
    });
}

async function updateDB() {
    if (process.env.NODE_ENV === 'production') {
        var dbconfig = require('../dbconfig.js').config.db;
        var mongoDB = `mongodb://${dbconfig.username}:${dbconfig.password}@${dbconfig.server}/${dbconfig.db}?replicaSet=${dbconfig.replica_set}`;
      } else if (process.env.NODE_ENV === 'development'){
        var dbconfig = require('../dbconfig.development').config.db;
        var mongoDB = `mongodb://${dbconfig.server}/${dbconfig.db}`;
      }
    
    mongoose.connect(mongoDB, { useNewUrlParser: true });
    mongoose.Promise = global.Promise;

    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'MongoDB connection error:'));

    async.waterfall(
        [
            // Search smash.gg for all past melee tournaments
            // Return a json object containing all of the tournaments' slugs
            function(callback) {
                getAllSearchResults()
                .then(function(slugs){
                    console.log(slugs);
                    callback(null, slugs);
                })
                .catch(function(err){
                    throw err;
                })
            },
            // Check tournament collection for slugs
            // Filter out a slug if the tournament is belongs to is already in the db
            // Returns the list of tournaments that need to be added to the db
            function(slugs, callback) {
                // let page = 65;
                // slugs = slugs.slice(page * 100, (page + 1)*100);
                // slugs = slugs.slice(0, 10);
                Promise.filter(slugs, async function (slug) {
                    return await checkDBForTournament(slug);
                }).then(function(slugs){
                    console.log('number of tournaments to be created: ' + slugs.length);
                    // console.time('created tournaments');
                    callback(null, slugs);
                }).catch(function(err){
                    throw err;
                });
            },
            // Create tournament objects for all tournaments that need to be added
            // Return an array of tournament objects
            function(slugs, callback) {
                // console.log(slugs);
                Promise.map(slugs, function(slug){
                            return createTournamentPromise(slug)
                        }, {concurrency: 5})
                        .then(function(tournaments){
                            console.log(tournaments.length);
                            callback(null, tournaments);
                        }).catch(function(err){
                            throw err;
                        });
            },  
            // Get a set of all unique playerIDs that entered the list of tournaments
            // Filter out any players that have already been added to the DB
            // Returns a list of playerIDs for players that need to be created
            function(tournaments, callback) {
                var playerIDs = getSetOfPlayerIDs(tournaments);
                console.log('players: ' + playerIDs.size);

                Promise.filter(playerIDs, async function(playerID){
                    return await checkDBForPlayer(playerID);
                })
                .then(function(playerIDs){
                    console.log(playerIDs.length);
                    callback(null, playerIDs, tournaments);
                })
                .catch(function(err){
                    throw err;
                });

            },
            // Create player objects for all players that need to be added
            // Return an array of player objects
            function(playerIDs, tournaments, callback){
                Promise.map(playerIDs, function(playerID){
                            return createPlayerPromise(playerID);
                        }, {concurrency: 50})                                    
                        .then(function(players){
                            console.log(players.length);
                            callback(null, players, tournaments);
                        })
                        .catch(function(err){
                            throw err;
                        });
            },
            // Insert players into DB
            // Players must be added before we update sets
            function(players, tournaments, updateSets) {
                console.log(tournaments.length);
                console.log(players.length);

                var sets = [];
                    
                tournaments.forEach(tournament => {
                    sets.push(...tournament['sets']);
                    tournament['setIDs'] = getSetIds(tournament);
                    delete tournament.sets;
                });
                
                console.log('number of sets to add: ' + sets.length);

                if (players.length > 0){
                    console.log('inserting players');
                    Player.insertMany(Array.from(players), function(err){
                        if (err) throw(err);
                        console.log('inserted players');
                        updateSets(null, sets, tournaments);
                    });
                } else {
                    updateSets(null, sets, tournaments);
                }
            },
            // Add setIDs to participating players 
            function(sets, tournaments, insertSets) {
                Promise.map(sets, function(set){
                    return new Promise(function (resolve, reject){
                        console.log('updating set ' + set['setID']);
                        Player.updateMany({$or:[
                            {playerID: set['player1ID']},
                            {playerID: set['player2ID']}]}, 
                            {$push:{setIDs: set['setID']}}, 
                            function (err) {
                                if (err) reject(err);
                                console.log('updated set ' + set['setID']);
                                resolve();
                            });
                        });
                    }).then(function(){
                        insertSets(null, sets, tournaments);
                    }).catch(function(err){
                        throw err;
                    });
            },
            // Insert Sets into DB
            function(sets, tournaments, insertTournaments){
                console.log('inserting sets');
                if (sets.length > 0) {
                    SetModel.insertMany(sets, function(err){
                        if (err) throw err;
                        console.log('done inserting');
                        insertTournaments(null, tournaments);
                    });
                } else {
                    insertTournaments(null, tournaments);
                }
            }, 
            // Insert tournaments into DB
            function(tournaments, finish){
                console.log('inserting tournaments');
                if (tournaments.length > 0) {
                    Tournament.insertMany(tournaments, function(err){
                        console.log('inserted tournaments');
                        if (err) throw (err);
                        finish();
                    });
                } else {
                    finish();
                }
            }
        ],
        function(err){
            if (err) {
                console.log(err);
            }
            console.log('finished updating');

            db.close();
        }
    );

}

// updateDB();

module.exports.updateDB = updateDB;

