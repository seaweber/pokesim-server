const express = require('express');
const router = express.Router();

const Session = require('../models/Session');

module.exports = function indexRouter( io ) {

    /* GET gamestate object */
    router.get( '/retrieve-gamestate', ( req, res ) => {

        const gamestate = Session.retrieveGameState( req.query.session_id );

        res.json( gamestate );
    });

    io.on( 'connection', socket => {

        console.log('SOCKET CONNECTED');

        socket.on('action', action => {

            switch (action.type) {

                case 'send-pick-order':
                    sendPartyOrder(socket, action.data);
                    break;

                case 'ready-up':
                    readyUp(socket, action.data);
                    break;

                case 'swap-pokemon':
                    console.log('BIG SWAP LETS GO');
                    swapPokemon(socket, action.data);
                    break;

                case 'create-lobby':
                    Session.createLobby(action.data);
                    break;

                case 'join-lobby':
                    console.log(action.data);
                    Session.joinLobby(action.data);
                    break;
            }
        });

    });


    Session.eventEmitter.on('LOBBY_READY',
        ( gamestate ) => io.sockets.emit( 'action', { type: 'lobby-ready', state: gamestate } ) );

    Session.eventEmitter.on('ALL_PLAYERS_ORDERED',
        ( gamestate ) => io.sockets.emit( 'action', { type: 'all-players-ordered', state: gamestate } ) );

    Session.eventEmitter.on('BATTLE_COMPLETE',
        ( gamestate ) =>  io.sockets.emit( 'action', { type: 'battle-complete', state: gamestate } ) );

    Session.eventEmitter.on('GAME_OVER',
        ( gamestate ) =>  io.sockets.emit( 'action', { type: 'game-over', state: gamestate } ) );


    const sendPartyOrder = ( socket, data ) => {

        const { session_id, user_id, party_order } = data;

        const gamestate = Session.retrieveGameState( session_id );

        if ( gamestate.scene !== 'ORDERING_PARTY' ) {

            socket.emit( 'INVALID_ACTION' );

        } else Session.attemptSceneTransition( session_id, user_id, { order: party_order } );

    };


    const readyUp = ( socket, data ) => {

        const { session_id, user_id } = data;

        const gamestate = Session.retrieveGameState( session_id );

        if ( gamestate.scene !== 'AWAITING_READY_UP' ) {

            socket.emit( 'INVALID_ACTION' );

        } else Session.attemptSceneTransition( session_id, user_id );

    };


    const swapPokemon = ( socket, data ) => {

        const { session_id, user_id, pokemon_id } = data;

        const gamestate = Session.retrieveGameState( session_id );

        if ( gamestate.scene !== 'AWAITING_READY_UP' ) {

            socket.emit( 'INVALID_ACTION' );

        } else Session.attemptSceneTransition( session_id, user_id, { swap: pokemon_id } );

    };


    return router;
};
