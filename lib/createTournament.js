var rp = require('request-promise');
var jsonfile = require('jsonfile');
var Promise = require('bluebird');

async function createTournament(slug) {
    var tournament = new Tournament(slug);
    // console.log('Creating tournament ' + slug);

    try {
        await Initialize(tournament);    
    } catch (err) {
        throw (err);
    }

    console.log('returning tournament ' + slug);
    return tournament;
}

class Tournament {
    constructor(slug) {
        this.slug = slug;
    }

    getSetIds() {
        var setIDs = [];
        this.sets.forEach(set => {
            setIDs.push(set['setID']);
        });
        return setIDs;
    }

    getPlayerIds() {
        var playerIDs = new Set();

        this.sets.forEach(set => {
            playerIDs.add(set['player1Id']);
            playerIDs.add(set['player2Id']);
        });

        return Array.from(playerIDs);
    }
}

function getParticipants(body){
    
    let seeds = body['entities']['seeds'];

    if (seeds === undefined) return [];

    var participants = [];
    seeds.forEach(seed => {
        
        var ID = seed['entrantId'];

        for (var entrantId in seed['mutations']['entrants']) {
            if (entrantId == ID) {
                
                var entrant = seed['mutations']['entrants'][entrantId];
                var participantID = entrant['participantIds'][0];

                participants.push({
                    entrantID: ID,
                    gamerTag: entrant['name'],
                    playerID: entrant['playerIds'][participantID]
                });

            }
        }
        
    });

    // console.log(participants);

    return participants;
}

function findPlayerId(participants, entrantId) {

    for (let i = 0; i < participants.length; i++) {
        const participant = participants[i];
        if (participant['entrantID'] === entrantId) {
            return participant['playerID'];
        }        
    }

    return 0;
}

function findPlayerTag(participants, playerId) {
    var tag = '';
    participants.forEach(participant => {
        // console.log(participant['playerId'] + ' vs ' + playerId);
        if (participant['entrantID'] === playerId) {

            // console.log('match');

            tag = participant['gamerTag'];
        }
    });

    return tag;
}

async function Initialize(tournament){
    var url = `https://api.smash.gg/${tournament.slug}?expand[]=event&expand[]=phase&expand[]=groups`;

    // console.log('making request for tournament ' + tournament.slug);

    try {
        // Get tournament data from smash gg api
        var data = await rp({
            uri: url,
            json: true,
            family: 4
        });

        var tournamentData = data['entities']['tournament'];

        // name info

        tournament.tournamentID = tournamentData['id'];
        tournament.name = tournamentData['name'];
        // tournament.slug = slug;
        tournament.shortSlug = tournamentData['shortSlug'];

        // time info

        tournament.timezone = tournamentData['timezone'];
        tournament.startAt = tournamentData['startAt'],
        tournament.endAt = tournamentData['endAt'],

        // location info

        tournament.city = tournamentData['city'],
        tournament.addrState = tournamentData['addrState'],
        tournament.countryCode = tournamentData['countryCode'],
        tournament.venueName = tournamentData['venueName'],
        tournament.venueAddress = tournamentData['venueAddress'],

        // tournament info

        tournament.details = tournamentData['details'],
        tournament.images = tournamentData['images']

        // events (melee singles only)
        // eventually: support every game

        tournament.events = initializeEvents(data);

        // phases

        tournament.phases = initializePhases(data);

        // groups

        tournament.groups = initializeGroups(data);

        // setIDs

        tournament.sets = await initializeSets(data)

    } catch (e){
        throw e;
    }

}

function initializeEvents(data) {
    // console.log('intializing events');
    var allEvents = data['entities']['event'];

    var events = [];

    allEvents.forEach(rawEvent => {
        if(rawEvent['videogameId'] === 1 && (rawEvent['playersPerEntry'] === 1 || rawEvent['type'] === 1)) {
            events.push({
                eventID: rawEvent['id'],
                tournamentID: rawEvent['tournamentId'],
                name: rawEvent['name'],
                slug: rawEvent['slug'],
                gameName: rawEvent['gameName']
            });
        }
        
    });

    return events;

}

function initializePhases(data) {
    // console.log('intializing phases');
    var eventIDs = getEventIDs(data);

    // console.log('event IDs: ')
    // console.log(eventIDs)
    var allPhases = data['entities']['phase'];
    // console.log('All phases: ');
    // console.log(allPhases);

    var phases = [];

    allPhases.forEach(rawPhase => {
        // console.log('phaseID: ' + rawPhase['id'])
        // console.log('eventID: ' + rawPhase['eventId'])
        if(eventIDs.includes(rawPhase['eventId'])) {
            // console.log('match');
            phases.push({
                phaseID: rawPhase['id'],
                eventID: rawPhase['eventId'],
                name: rawPhase['name']
            });

        }
    });

    return phases;
}

function initializeGroups(data) {
    // console.log('intializing groups');
    var phaseIDs = getPhaseIDs(data);
    var allGroups = data['entities']['groups'];

    var groups = [];

    if (allGroups !== undefined) {
        allGroups.forEach(rawGroup => {
            if(phaseIDs.includes(rawGroup['phaseId'])){
                groups.push({
                    groupID: rawGroup['id'],
                    phaseID: rawGroup['phaseId'],
                    name: rawGroup['displayIdentifier']
                });
            }
        });
    }
    return groups;
}

async function initializeSets(data) {
    // console.log('intializing sets');
    var groupIDs = getGroupIDs(data);

    // console.log('group IDs: ' + groupIDs);
    // console.log('groups: ' + groupIDs.length);

    var allSets = [];

    await Promise.map(groupIDs, function(groupID){
        // console.log('making request for group ' + groupID);
        return rp({
            uri: `https://api.smash.gg/phase_group/${groupID}?expand[]=sets&expand[]=standings&expand[]=seeds`,
            json: true
        });
    }, {concurrency: 10})
    .then(function(groups){
        // console.log('returned with groups: ' + groups.length);
        groups.forEach(group => {
            // console.log('checking out group ' + group['entities']['groups']['id']);

            var participants = getParticipants(group);
            // console.log('got participants')
            var sets = group['entities']['sets'];

            // console.log(group);
            
            if (sets !== undefined) {
                sets.forEach(set => {
                    if (set['entrant1Id'] !== null &&
                        set['entrant2Id'] !== null  &&
                        !((set['entrant1Score'] === 0 
                        && set['entrant2Score'] === -1) ||
                        (set['entrant1Score'] === -1 &&
                        set['entrant2Score'] === 0)) &&
                        set['winnerId'] !== null &&
                        set['loserId'] !== null/*&&
                        set['entrant1Score'] !== null &&
                set['entrant2Score'] !== null */) {
    
                            allSets.push({
                                setID: set['id'],
                                player1ID: findPlayerId(participants, set['entrant1Id']),
                                player1Tag: findPlayerTag(participants, set['entrant1Id']),
                                player2ID: findPlayerId(participants, set['entrant2Id']),
                                player2Tag: findPlayerTag(participants, set['entrant2Id']),
                                player1Score: set['entrant1Score'],
                                player2Score: set['entrant2Score'],
                                winnerID: findPlayerId(participants, set['winnerId']),
                                loserID: findPlayerId(participants, set['loserId']),
                                fullRoundText: set['fullRoundText'],
                                games: set['games'],
                                eventID: set['eventId'],
                                phaseGroupID: set['phaseGroupId'],
                                tournamentID: data['entities']['tournament']['id'],
                                tournamentName: data['entities']['tournament']['name'],
                                time: set['completedAt'],
                                phaseName: getPhaseName(data, group['entities']['groups']['phaseId'])
    
                            });
                        }
                });
            }
        });

    });

    return allSets;
}

function getPhaseName(data, phaseID) {
    let phases = data['entities']['phase'];
    for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        if (phase['id'] === phaseID) {
            return phase['name'];
        }
        
    }
}

function getEventIDs(data) {
    var eventIDs = [];
    var allEvents = data['entities']['event'];

    allEvents.forEach(rawEvent => {
        if(rawEvent['videogameId'] === 1 && (rawEvent['playersPerEntry'] === 1 || rawEvent['type'] === 1)) {
            eventIDs.push(rawEvent['id']);
        }
    });

    return eventIDs;
}

function getPhaseIDs(data) {
    var eventIDs = getEventIDs(data);
    var allPhases = data['entities']['phase'];

    var phaseIDs = [];

    allPhases.forEach(phase => {
        if(eventIDs.includes(phase['eventId'])){
            phaseIDs.push(phase['id']);
        }

    });

    return phaseIDs;

}

function getGroupIDs(data) {
    var phaseIDs = getPhaseIDs(data);
    var allGroups = data['entities']['groups'];

    var groupIDs = [];

    if (allGroups !== undefined) {
        allGroups.forEach(group => {
            if(phaseIDs.includes(group['phaseId'])){
                groupIDs.push(group['id']);
            }
    
        });
    }


    return groupIDs;
    
}

module.exports.createTournament = createTournament;