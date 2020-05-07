const express = require('express');
const router = express.Router();

const Session = require('../models/Session');

module.exports = function indexRouter( io ) {


    /* GET gamestate object */
    router.get( '/retrieve-gamestate', ( req, res ) => {

        const gamestate = Session.retrieveGameState( req.query.session_id );

        res.json( gamestate );
    });

    let gamestate;

    io.on( 'connection', socket => {

        console.log('SOCKET CONNECTED');

        gamestate = Session.retrieveGameState( socket.handshake.query.session_id );

        socket.on('action', action => {

            switch ( action.type ) {

                case 'send-pick-order':
                    sendPartyOrder( socket, action.data );
                    break;

                case 'ready-up':
                    readyUp( socket, action.data );
                    break;

                case 'swap-pokemon':
                    swapPokemon( socket, action.data );
                    break;

                case 'create-lobby':
                    console.log('CREATE LOBBY');
                    console.log(action.data);
                    Session.createLobby( action.data );
                    break;

                case 'join-lobby':
                    console.log('JOIN LOBBY');
                    console.log(action.data);
                    Session.joinLobby( action.data );
                    break;
            }
        });

        // socket.on( 'sanity-check', () => socket.emit('not-crazy') );
        //
        // socket.on( 'send-pick-order', data => sendPartyOrder( socket, data ) );
        //
        // socket.on( 'ready-up', data => readyUp( socket, data ) );
        //
        // socket.on( 'swap-pokemon', data => swapPokemon( socket, data ) );
        //
        // socket.on( 'create-lobby', data => {
        //     Session.createLobby( data );
        //     console.log('LOBBY CREATED');
        // } );
        //
        // socket.on( 'join-lobby', data => {
        //     Session.joinLobby( data );
        //     console.log('LOBBY JOINED');
        // } );

    } );


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

        if ( gamestate.scene !== 'ORDERING_PARTY' ) {

            socket.emit( 'INVALID_ACTION' );

        } else Session.attemptSceneTransition( session_id, user_id, { order: party_order } );

    };


    const readyUp = ( socket, data ) => {

        const { session_id, user_id } = data;

        if ( gamestate.scene !== 'AWAITING_READY_UP' ) {

            socket.emit( 'INVALID_ACTION' );

        } else Session.attemptSceneTransition( session_id, user_id );

    };


    const swapPokemon = ( socket, data ) => {

        const { session_id, user_id, pokemon_id } = data;

        if ( gamestate.scene !== 'AWAITING_READY_UP' ) {

            socket.emit( 'INVALID_ACTION' );

        } else Session.attemptSceneTransition( session_id, user_id, { swap: pokemon_id } );

    };


    return router;
};
