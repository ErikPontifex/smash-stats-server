var rp = require('request-promise');
var jsonfile = require('jsonfile');
var Promise = require('bluebird');

// Return array of past melee tournament slugs

async function getAllSearchResults() {

    // Get number of pages to search

    var url = `https://smash.gg/api/-/gg_api./public/tournaments/schedule;filter=%7B%22upcoming%22%3Afalse%2C%22videogameIds%22%3A%221%22%2C%22past%22%3Atrue%7D;page=1;per_page=1?returnMeta=true`;
    
    console.log('making request for number of pages');
    var data = await rp({url:url, json: true});
    console.log('request returned');
    console.log('number of tournaments is ' + data['total_count']);

    var results = jsonfile.readFileSync(`${__dirname}/tournamentSlugs.json`);

    // console.log(results);

    if (results['total_count'] === data['total_count']) {
        // Search results don't need to be updated
        console.log("Search results don't need to be updated");
        return results['slugs'];
    }

    var pages = Math.ceil(data['total_count']/100);

    pages = Array.from(new Array(pages),(val,index)=>index+1);

    console.log(pages);

    var slugs = [];

    await Promise.map(pages, function(page){
        console.log('getting page ' + page);
        url = `https://smash.gg/api/-/gg_api./public/tournaments/schedule;filter=%7B%22upcoming%22%3Afalse%2C%22videogameIds%22%3A%221%22%2C%22past%22%3Atrue%7D;page=${page};per_page=100?returnMeta=true`;
        return rp({url: url, json: true});
    })
    .then(function(searchResults){
        searchResults.forEach(page => {

            var tournaments = page['items']['entities']['tournament'];
            
            // Add slugs to slug array
            tournaments.forEach(tournament => {
                slugs.push(tournament['slug']);
            });
            
        });

        jsonfile.writeFile(`${__dirname}/tournamentSlugs.json`, {total_count: slugs.length, slugs: slugs} , function(err) {
            if (err) console.log(err);
        });
    
        return slugs;

    })
    .catch(function(err){
        throw (err);
    });

    console.log('slugs are ' + slugs);

    return slugs;

}


module.exports.getAllSearchResults = getAllSearchResults;