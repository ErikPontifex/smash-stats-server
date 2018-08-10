var Player = require('../models/player');
var Set = require('../models/set');
var mongoose = require('mongoose');

exports.player = function(req, res) {
    console.log("getting request from url " + req.url);
    let id = req.params.id ? Number(req.params.id) : 1000;

    if (isNaN(id)) { id = 1000; }
    Player.findOne({playerID: id}, function(err, player){
        if (err) throw err;
        if (player) {
            res.send(player)
        } else {
            res.send('player not found');
        }
    }).catch(function(err){
        console.log('error getting player information for player ' + req.params.id);
        console.log(err);
    });
};

exports.player_sets = function(req, res) {
    let id = Number(req.params.id);
    Player.findOne({playerID: id}, function(err, player){
        if (err) throw err;
        if (player) {
            console.log('getting sets for player ' + id);
            Set.find({setID: {$in: player['setIDs']}}, function(err, sets){
                if (err) throw err;
                res.send(sets);
            });
        } else {
            res.send('player not found')
        }
    }).catch(function(err){
        console.log('error getting sets for player ' + req.params.id);
        console.log(err);
    });
};

exports.player_search = function(req, res) {
    console.log('ABOUT TO SEARCH FOR PLAYERS');
    let term = req.params.term ? req.params.term : '';
    Player.find({gamerTag:{ $regex: "^" + term, $options: "i"}})
            .limit(200)
            .select({gamerTag:1, playerID: 1, name: 1})
            .sort({gamerTag: 1})
            .exec(function(err, docs){
                    if (err) throw err;
                    console.log('returned results for ' + term);
                    res.send(docs);
                });
};

exports.null_search = function(req, res) {
    res.send('{}');
}

exports.player_tag = function(req, res) {
    res.send('Not implemented');
};