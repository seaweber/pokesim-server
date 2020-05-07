const express = require('express');
const router = express.Router();

const Session = require('../models/Session');

module.exports = function indexRouter( io ) {

    /* GET gamestate object */
    router.get( '/retrieve-gamestate', ( req, res ) => {

        const gamestate = Session.retrieveGameState( req.query.session_id );

        res.json( gamestate );
    });

    /* GET session_id for debug purposes */
    router.get( '/session_id', ( req, res ) => {

        res.json( { id: Session.session_id } );
    });

    io.on( 'connection', socket => {

        console.log('SOCKET CONNECTED');

        socket.on( 'sanity-check', () => {
            socket.emit('not-crazy');
        } );

        socket.on( 'submit-action', data => submitAction( socket, data ) );

    } );

    /*
     * Submit game action
     *
     * Supported actions:
     *   - SEND_PICK_ORDER
     *   - READY_UP
     *   - SWAP_POKEMON
     */
    const submitAction = ( socket, data ) => {

        const { session_id, user_id, action } = data;

        const gamestate = Session.retrieveGameState( session_id );

        let response;

        switch ( action ) {

            case 'SEND_PICK_ORDER' :

                if ( gamestate.scene !== 'ORDERING_PARTY' ) {

                    socket.emit( 'INVALID_ACTION' );

                } else {

                    Session.attemptSceneTransition( session_id, user_id, { party_order: data.party_order } );

                    Session.eventEmitter.on('ALL_PLAYERS_ORDERED',
                        ( user_id ) => {
                            console.log(`User_ID: ${ user_id }`);
                            socket.emit('ALL_PLAYERS_ORDERED', { gamestate: gamestate } );
                        } )
                }

                break;

            case 'READY_UP' :

                if ( gamestate.scene !== 'AWAITING_READY_UP' ) {

                    socket.emit( 'INVALID_ACTION' );

                } else {

                    Session.readyUpPlayer( session_id, user_id );

                    Session.eventEmitter.on('BATTLE_COMPLETE',
                        () => socket.emit( 'BATTLE_COMPLETE', { gamestate: gamestate } ) );

                }
                break;

            case 'SWAP_POKEMON' :

                if ( gamestate.scene !== 'AWAITING_READY_UP' ) {

                    socket.emit( 'INVALID_ACTION' );

                } else {

                    Session.swapPokemonInParty( session_id, user_id, data.pokemon_id );

                    response = { valid: true, gamestate: gamestate };

                    Session.eventEmitter.on('BATTLE_COMPLETE',
                        () => socket.emit( 'BATTLE_COMPLETE', { gamestate: gamestate } ) );

                }

                break;

            default : socket.emit( 'INVALID_ACTION' );
        }

    };

    // router.post( '/submit-action', ( req, res ) => {
    //
    //     const { session_id, user_id, action } = req.body;
    //
    //     const gamestate = Session.retrieveGameState( session_id );
    //
    //     let response;
    //
    //     switch ( action ) {
    //
    //         case 'SEND_PICK_ORDER' :
    //
    //             if ( gamestate.scene !== 'ORDERING_PARTY' ) {
    //
    //                 response = { valid: false };
    //
    //                 res.json( response );
    //
    //             } else {
    //
    //                 Session.attemptSceneTransition( session_id, user_id, { party_order: req.body.party_order } );
    //                 //reorderParty( session_id, user_id, req.body.party_order );
    //
    //                 Session.eventEmitter.on('ALL_PLAYERS_ORDERED',
    //                     ( user_id ) => {
    //                         console.log(`User_ID: ${ user_id }`);
    //                         res.json( { valid: true, gamestate: gamestate } );
    //                     } )
    //             }
    //
    //             break;
    //
    //         case 'READY_UP' :
    //
    //             if ( gamestate.scene !== 'AWAITING_READY_UP' ) {
    //
    //                 response = { valid: false };
    //
    //                 res.json( response );
    //
    //             } else {
    //
    //                 Session.readyUpPlayer( session_id, user_id );
    //
    //                 Session.eventEmitter.on('BATTLE_COMPLETE',
    //                     () => res.json( { valid: true, gamestate: gamestate } ) );
    //
    //             }
    //             break;
    //
    //         case 'SWAP_POKEMON' :
    //
    //             if ( gamestate.scene !== 'AWAITING_READY_UP' ) {
    //
    //                 response = { valid: false };
    //
    //                 res.json( response );
    //
    //             } else {
    //
    //                 Session.swapPokemonInParty( session_id, user_id, req.body.pokemon_id );
    //
    //                 response = { valid: true, gamestate: gamestate };
    //
    //                 Session.eventEmitter.on('BATTLE_COMPLETE', () => res.json( response ));
    //
    //             }
    //
    //             break;
    //
    //         default : response = { valid: false };
    //     }
    //
    // });


    return router;
};
