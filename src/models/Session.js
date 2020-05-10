const EventEmitter = require('events').EventEmitter;
const axios = require('axios');

const User = require('../models/User');

const eventEmitter = new EventEmitter();
module.exports.eventEmitter = eventEmitter;

const global_gamestate = { };

const lobbies = { };

module.exports.createLobby = ( data ) => {

    lobbies[ data.session_id ] = { player1: data.user_id };

};

module.exports.joinLobby = ( data ) => {

    lobbies[ data.session_id ] = { ...lobbies[ data.session_id ], player2: data.user_id };

    const { player1, player2 } = lobbies[ data.session_id ];

    registerGameSession( data.session_id, player1, player2 )
        .then( () => eventEmitter.emit('LOBBY_READY', global_gamestate[ data.session_id ] ) );

    delete lobbies[ data.session_id ];

};

/*
 * Supported scenes:
 *   - ORDERING_PARTY
 *   - AWAITING_READY_UP
 */
const registerGameSession = async ( session_id, player1, player2 ) => {

    let player1Party = await User.retrieveParty( player1 );

    let player2Party = await User.retrieveParty( player2 );

    module.exports.session_id = session_id;

    global_gamestate[ session_id ] = {

        scene: 'ORDERING_PARTY',

        players: {

            [ player1 ]: {

                party: player1Party.data,

                ordered: false,

                ready: false
            },

            [ player2 ]: {

                party: player2Party.data,

                ordered: false,

                ready: false
            }

        }
    };

    // add an 'alive' property to each pokemon
    const gamestate = global_gamestate[ session_id ];

    Object.keys(gamestate.players).map( player => {

        gamestate.players[ player ].party.map( pokemon => pokemon.alive = true);
    });

    console.log( session_id );

    return session_id;

};


module.exports.retrieveGameState = session_id => {

    return global_gamestate[ session_id ] ? global_gamestate[ session_id ] : null;
};


// arrange party to player's preference at beginning of battle
const reorderParty = ( session_id, user_id ) => {

    const gamestate = global_gamestate[ session_id ];

    gamestate.players[ user_id ].party = global_gamestate[ session_id ].players[ user_id ][ 'party_order' ];

    Object.keys(gamestate.players).map( player => {

        gamestate.players[ player ].party.map( pokemon => pokemon.alive = true);
    });

};


// moves selected pokemon to front of players's party
const swapPokemonInParty = ( session_id, user_id, pokemon_id ) => {

    let party = global_gamestate[ session_id ].players[ user_id ].party.filter( pokemon => pokemon.alive );

    const pokemon = party.find( pokemon => pokemon.pokedex_id === pokemon_id );

    party.splice(0, 0, party.splice( party.indexOf( pokemon ), 1)[0]);

    global_gamestate[ session_id ].players[ user_id ].party = party;
};


// validate player action based on current game scene
module.exports.attemptSceneTransition = ( session_id, user_id, data ) => {

    const gamestate = global_gamestate[ session_id ];

    // If attempted action necessitates additional data such as party order, store it separately in state for now
    if ( data ) {

        if ( data.hasOwnProperty( 'order' ) ) {

            gamestate.players[ user_id ] = { ...gamestate.players[ user_id ], party_order: data.order };
        }

        if ( data.hasOwnProperty( 'swap' ) ) {

            gamestate.players[ user_id ].swap = data.swap;
        }
    }

    let valid = false;

    switch ( gamestate.scene ) {

        case 'ORDERING_PARTY' :

            gamestate.players[ user_id ].ordered = true;

            // If both players have ordered their parties, attempted transition is valid
            if ( Object.values( gamestate.players )
                .filter( player => player.ordered )
                .length > 1 ) {

                valid = true;
            }
            break;

        case 'AWAITING_READY_UP' :

            gamestate.players[ user_id ].ready = true;

            // If both players are ready, attempted transition is valid; Reset ready flags for next turn
            if ( Object.values( gamestate.players )
                .filter( player => player.ready )
                .length > 1 ) {

                valid = true;

                Object.keys(gamestate.players)
                    .map( key => {
                        gamestate.players[ key ].ready = false;
                    });
            }
            break;

    }

    // Upon validation, carry out logic specific to current scene, then transition scenes
    const transitionScenes = async () => {

        const hasNoPokemonLeft = user_id => gamestate.players[ user_id ].party
            .filter( pokemon => pokemon.alive ).length === 0;

        const [ player1_id, player2_id ] = Object.keys( gamestate.players );

        if ( hasNoPokemonLeft( player1_id ) || hasNoPokemonLeft( player2_id ) ) {

            gamestate.scene = 'GAME_OVER';

            eventEmitter.emit('GAME_OVER', gamestate);

        }

        // swap pokemon if that's what either player chose to do
        if ( gamestate.players[ player1_id ].hasOwnProperty('swap') ) {

            const player1 = gamestate.players[ player1_id ];

            swapPokemonInParty( session_id, player1_id, player1.swap );

            delete player1.swap;

        }

        if ( gamestate.players[ player2_id ].hasOwnProperty('swap') ) {

            const player2 = gamestate.players[ player2_id ];

            swapPokemonInParty( session_id, player2_id, player2.swap );

            delete player2.swap;
        }

        if ( gamestate.scene === 'ORDERING_PARTY' ) {

            Object.keys( gamestate.players ).map( key => {

                reorderParty( session_id, key );
            } );

            gamestate.scene = 'AWAITING_READY_UP';

            eventEmitter.emit('ALL_PLAYERS_ORDERED', gamestate);

        } else if ( gamestate.scene === 'AWAITING_READY_UP' ) {

            const [ player1_id, player2_id ] = Object.keys( gamestate.players );

            // Retrieve next-up pokemon from both players' parties
            const player1_pokemon = gamestate.players[ player1_id ].party
                .find( pokemon => pokemon.alive );

             const player2_pokemon = gamestate.players[ player2_id ].party
                .find( pokemon => pokemon.alive );

            // Simulate battle
            const battleSimResponse = await axios
                .post( 'https://us-central1-pokemon-412.cloudfunctions.net/simulate-battle',
                    {
                        // Could pass entire pokemon objects here, but might as well only send what is needed to simulate battle
                        // Include user_id with pokemon, which will be helpful when interpreting the response
                        // Pokemon in response would essentially be anonymous otherwise
                        pokemon1: { user_id: player1_id, pokedex_id: player1_pokemon.pokedex_id, stats: player1_pokemon.stats, types: player1_pokemon.types },

                        pokemon2: { user_id: player2_id, pokedex_id: player2_pokemon.pokedex_id, stats: player2_pokemon.stats, types: player2_pokemon.types },
                    });

            const losingPokemon = battleSimResponse.data['loser'];

            // Update loser's party based on outcome of battle
            const losingPokemonIndex = gamestate.players[ losingPokemon.user_id ].party.map( pokemon => pokemon.pokedex_id ).indexOf( losingPokemon.pokedex_id );

            gamestate.players[ losingPokemon.user_id ].party[ losingPokemonIndex ].alive = false;

            // Notify clients that update is completed so that their local gamestate can be updated to reflect outcome of battle
            eventEmitter.emit( 'BATTLE_COMPLETE', gamestate );

        }
    };

    if ( valid ) {

        // noinspection JSIgnoredPromiseFromCall
        transitionScenes();

    }

    return valid;
};
