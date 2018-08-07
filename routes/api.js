var express = require('express');
var router = express.Router();

// Require controller modules.
var player_controller = require('../controllers/playerController');

router.get('/', function(req, res){
    res.send('working');
});

router.get('/searchPlayers/', player_controller.null_search);
router.get('/searchPlayers/:term', player_controller.player_search);
router.get('/player/:id', player_controller.player);

router.get('/player/:id/getAllSets', player_controller.player_sets);
// router.get('/player', player_controller.player_tag);

module.exports = router;