describe("In petMatch", function () {
    var OK = true;
    var ILLEGAL = false;
    var PLAYER0_TURN = 0;
    var PLAYER1_TURN = 1;
    var NO_ONE_TURN = -1;
    var NO_ONE_WINS = null;
    var PLAYER0_WIN_ENDSCORES = [1, 0];
    var PLAYER1_WIN_ENDSCORES = [0, 1];
    var TIE_ENDSCORES = [0, 0];
    var SHOULDSHUFFLE = false;
    var BOARDSAME = [['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A'],
        ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A'],
        ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A'],
        ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A'],
        ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A'],
        ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A'],
        ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A'],
        ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A'],
        ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A']];
    var BOARDSHOULDSHUFFLE = [['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A'],
        ['B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B'],
        ['C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C'],
        ['D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D'],
        ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A'],
        ['B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B'],
        ['C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C'],
        ['D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D'],
        ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A']];
    function expectMove(isOk, shouldShuffle, turnIndexBeforeMove, boardBeforeMove, scoresBeforeMove, completedStepsBeforeMove, fromDelta, toDelta, boardAfterMove, turnIndexAfterMove, scoresAfterMove, completedStepsAfterMove, boardCountAfterMove, endMatchScores) {
        var stateTransition = {
            turnIndexBeforeMove: turnIndexBeforeMove,
            stateBeforeMove: boardBeforeMove ? { board: boardBeforeMove, fromDelta: fromDelta, toDelta: toDelta,
                scores: scoresBeforeMove, completedSteps: completedStepsBeforeMove, boardCount: boardCountAfterMove } : null,
            move: {
                turnIndexAfterMove: turnIndexAfterMove,
                endMatchScores: endMatchScores,
                stateAfterMove: { board: boardAfterMove, fromDelta: fromDelta, toDelta: toDelta,
                    scores: scoresAfterMove, completedSteps: completedStepsAfterMove, boardCount: boardCountAfterMove }
            },
            numberOfPlayers: null
        };
        if (shouldShuffle) {
            while (gameLogic.shouldShuffle(boardBeforeMove)) {
                stateTransition.stateBeforeMove.board = gameLogic.shuffle();
            }
        }
        if (isOk) {
            stateTransition.move.stateAfterMove.boardCount = gameLogic.updateBoard(boardBeforeMove, fromDelta, toDelta);
            stateTransition.move.stateAfterMove.board = stateTransition.move.stateAfterMove.boardCount.board;
            gameLogic.checkMoveOk(stateTransition);
        }
        else {
            // We expect an exception to be thrown :)
            var didThrowException = false;
            try {
                gameLogic.updateBoard(boardBeforeMove, fromDelta, toDelta);
                try {
                    gameLogic.checkMoveOk(stateTransition);
                }
                catch (e) {
                    didThrowException = true;
                }
            }
            catch (e) {
                didThrowException = true;
            }
            if (!didThrowException) {
                throw new Error("We expect an illegal move, but checkMoveOk didn't throw any exception!");
            }
        }
    }
    it("Making a move that forms a match of 3 or over 3 is legal", function () {
        expectMove(OK, SHOULDSHUFFLE, PLAYER0_TURN, gameLogic.getInitialBoard(), [0, 0], [0, 0], { row: 0, col: 1 }, { row: 1, col: 1 }, null, PLAYER1_TURN, [30, 0], [1, 0], null, NO_ONE_WINS);
    });
    it("Making a move that cannot form a match of 3 or over 3 is illegal", function () {
        expectMove(!OK, SHOULDSHUFFLE, PLAYER0_TURN, gameLogic.getInitialBoard(), [0, 0], [0, 0], { row: 0, col: 0 }, { row: 0, col: 1 }, null, PLAYER1_TURN, [0, 0], [1, 0], null, NO_ONE_WINS);
    });
    it("Making a move that forms a match of 3 or over 3 is legal && board with same pet", function () {
        expectMove(OK, SHOULDSHUFFLE, PLAYER0_TURN, BOARDSAME, [0, 0], [0, 0], { row: 0, col: 1 }, { row: 1, col: 1 }, null, PLAYER1_TURN, [250, 0], [1, 0], null, NO_ONE_WINS);
    });
    //still has some error to fix
    it("Making a move that forms a match of 3 or over 3 is legal && should shuffle", function () {
        expectMove(!OK, true, PLAYER0_TURN, BOARDSHOULDSHUFFLE, [0, 0], [0, 0], { row: 0, col: 1 }, { row: 1, col: 1 }, null, PLAYER1_TURN, [250, 0], [1, 0], null, NO_ONE_WINS);
    });
    it("Making a move that leads to tie is legal", function () {
        expectMove(OK, SHOULDSHUFFLE, PLAYER0_TURN, gameLogic.getInitialBoard(), [0, 30], [14, 15], { row: 0, col: 1 }, { row: 1, col: 1 }, null, NO_ONE_TURN, [30, 30], [15, 15], null, TIE_ENDSCORES);
    });
    it("Making a move that leads to a winner is legal", function () {
        expectMove(OK, SHOULDSHUFFLE, PLAYER0_TURN, gameLogic.getInitialBoard(), [30, 30], [14, 15], { row: 0, col: 1 }, { row: 1, col: 1 }, null, NO_ONE_TURN, [60, 30], [15, 15], null, PLAYER0_WIN_ENDSCORES);
    });
    it("Making a move when game is over is illegal", function () {
        expectMove(!OK, SHOULDSHUFFLE, PLAYER0_TURN, gameLogic.getInitialBoard(), [0, 30], [15, 15], { row: 0, col: 1 }, { row: 1, col: 1 }, null, NO_ONE_TURN, [30, 30], [16, 15], null, TIE_ENDSCORES);
    });
});
//# sourceMappingURL=gameLogic_test.js.map