var rp = require('request-promise');

async function createPlayer(playerID) {
    var player = new Player(playerID);
    await Inititalize(player).catch(async function(err){
        if (err.statusCode === 404) console.log('player not found: ' + playerID);
        else if (err.statusCode === 500) {
        }
        else if (err) throw(err);
    });
    return player;

}

class Player {
    constructor(playerID){
        this.playerID = playerID;
    }
}

async function Inititalize(player){
    var url = `https://api.smash.gg/player/${player.playerID}`;

    try {
        var data = await rp({uri: url, json: true, family: 4});
        var playerData = data['entities']['player'];
        
        // name info

        player.gamerTag = playerData['gamerTag'];
        player.prefix = playerData['prefix'];
        player.name = playerData['name'];

        // social media info
        
        player.twitterHandle = playerData['twitterHandle'];
        player.twitchStream = playerData['twitchStream'];

        // location info
        
        player.state = playerData['state'];
        player.region = playerData['region'];
        player.country = playerData['country'];

        player.images = playerData['images'];
        player.rankings = playerData['rankings']; // Get Rankings

        // console.log('here');

        // player.attendedTournaments = initializeAttendedTournaments(data);

        player.setIDs = [];

    } catch(e) {
        throw (e);
    }
}

function initializeAttendedTournaments(data) {
    var tournaments = [];

    var attended = data['entities']['attendee'];

    attended.forEach(raw => {
        // console.log(raw['id']);

        var tournament = {
            tournamentName: getTournamentNameByID(data['entities']['tournament'], raw['tournamentId']),
            tournamentID: raw['tournamentId'],
            attendedEvents: []

        };

        var events = raw['events']

        events.forEach(event => {
            tournament.attendedEvents.push({
                eventID: event['id'],
                name: event['name'],
                videogameId: event['videogameId'],
                slug: event['slug']
            });
        });

        tournaments.push(tournament);

    });

    return tournaments;
}

function getTournamentNameByID(tournaments, tournamentID) {
    for (let i = 0; i < tournaments.length; i++) {
        var tournament = tournaments[i];

        if(tournament['id'] === tournamentID) {
            return tournament['name'];
        }
        
    }
}

// async function use() {
//     var mango = await createPlayer(1000);
//     console.log('returned');
//     console.log(mango);

// }

// use();

module.exports.createPlayer = createPlayer;