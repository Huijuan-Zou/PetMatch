;
var game;
(function (game) {
    var gameArea = null;
    var PARAMS = gameLogic.PARAMS;
    game.currentUpdateUI = null;
    game.didMakeMove = false; // You can only make one move per updateUI
    game.animationEndedTimeout = null;
    game.state = null;
    game.board = null;
    game.dragAndDropStartPos = null;
    game.dragAndDropElement = null;
    function getTranslations() {
        return {};
    }
    function init() {
        registerServiceWorker();
        gameArea = document.getElementById("gameArea");
        if (!gameArea)
            throw new Error("Can't find gameArea!");
        translate.setTranslations(getTranslations());
        translate.setLanguage('en');
        resizeGameAreaService.setWidthToHeight(1);
        moveService.setGame({
            minNumberOfPlayers: 2,
            maxNumberOfPlayers: 2,
            checkMoveOk: gameLogic.checkMoveOk,
            updateUI: updateUI,
            gotMessageFromPlatform: null,
        });
        dragAndDropService.addDragListener("gameArea", handleDragEvent); //'gameArea' here refers to the reference variable not the string literal representing the element id.
    }
    game.init = init; //addDragListener() applies a event monitor to 'gameArea', once mouse hovers over 'gameArea', the monitor collects mouse information (type of event, position of curse) to handleEvent that is implemented by users.
    function handleDragEvent(type, cx, cy) {
        log.log("type", type);
        log.log("cx " + cx);
        log.log("cy : " + cy);
        //if the user drags cell to outside of the game area, the function will take middle point of the nearest cell        
        var cellSize = getCellSize(); //cell size changes when you switch device or resize window             
        var x = Math.min(Math.max(cx - gameArea.offsetLeft, cellSize.width / 2), gameArea.clientWidth - cellSize.width / 2); //convert absolute position to relative position (relative to parent element)
        var y = Math.min(Math.max(cy - gameArea.offsetTop, cellSize.height / 2), gameArea.clientHeight - cellSize.height / 2); //the inner max() takes care if cursor moves to the left or below gameArea. the outer min takes care if cursor moves to the right or top of gameArea
        log.log("x position : " + x);
        log.log("y position : " + y);
        var dragAndDropPos = {
            top: y - cellSize.height * 0.605,
            left: x - cellSize.width * 0.605
        };
        var dragAndDropStart;
        //dragging around
        if (type == "touchmove") {
            if (dragAndDropPos)
                setDragAndDropElementPos(dragAndDropPos, cellSize);
            return;
        }
        //get the index of cell based on current pos (cx, cy). identify cell based on mouse position
        var delta = {
            row: Math.floor(PARAMS.ROWS * y / gameArea.clientHeight),
            col: Math.floor(PARAMS.COLS * x / gameArea.clientWidth)
        };
        log.log(delta);
        if (type == "touchstart") {
            game.dragAndDropStartPos = delta; //save start cell, because a new delta will be calculated once pressed mouse is moved.
            dragAndDropStart = dragAndDropPos;
            game.dragAndDropElement = document.getElementById("img_container_" + game.dragAndDropStartPos.row + "_" + game.dragAndDropStartPos.col);
            var style = game.dragAndDropElement.style;
            style['z-index'] = 20;
            setDragAndDropElementPos(dragAndDropPos, cellSize);
            return;
        }
        if (type == "touchend" && game.dragAndDropStartPos) {
            var fromDelta = {
                row: game.dragAndDropStartPos.row,
                col: game.dragAndDropStartPos.col
            };
            var toDelta = {
                row: delta.row,
                col: delta.col
            };
            var nextMove = null;
            if (dragOk(fromDelta, toDelta)) {
                game.state.fromDelta = fromDelta;
                game.state.toDelta = toDelta;
                var boardTemp = angular.copy(game.state.board);
                var changedBoardCount = gameLogic.updateBoard(boardTemp, fromDelta, toDelta);
                try {
                    nextMove = gameLogic.createMove(game.state, changedBoardCount, game.currentUpdateUI.move.turnIndexAfterMove);
                }
                catch (e) {
                    log.info(["Move is illegal:", e]);
                    endDragAndDrop(); //move back to original position
                    return;
                }
                makeMove(nextMove); //make legal move
            }
        }
        if (type === "touchend" || type === "touchcancel" || type === "touchleave") {
            endDragAndDrop();
        }
    }
    game.handleDragEvent = handleDragEvent; //end handleDragEvent()
    function getCellSize() {
        return {
            width: gameArea.clientWidth / PARAMS.COLS,
            height: gameArea.clientHeight / PARAMS.ROWS
        };
    }
    /**
   * Set the TopLeft of the element.
   */
    function setDragAndDropElementPos(pos, cellSize) {
        var style = game.dragAndDropElement.style;
        var top = cellSize.height / 10;
        var left = cellSize.width / 10;
        var originalSize = getCellPos(game.dragAndDropStartPos.row, game.dragAndDropStartPos.col, cellSize);
        var deltaX = (pos.left - originalSize.left + left);
        var deltaY = (pos.top - originalSize.top + top);
        // make it 20% bigger (as if it's closer to the person dragging).
        var transform = "translate(" + deltaX + "px," + deltaY + "px) scale(1.2)";
        style['transform'] = transform;
        style['-webkit-transform'] = transform;
        style['will-change'] = "transform"; // https://developer.mozilla.org/en-US/docs/Web/CSS/will-change
    }
    /**
   * Get the position of the cell.
   */
    function getCellPos(row, col, cellSize) {
        var top = row * cellSize.height;
        var left = col * cellSize.width;
        var pos = { top: top, left: left };
        return pos;
    }
    function animationEndedCallback() {
        log.info("Animation ended");
        maybeSendComputerMove();
    }
    function clearAnimationTimeout() {
        if (game.animationEndedTimeout) {
            $timeout.cancel(game.animationEndedTimeout);
            game.animationEndedTimeout = null;
        }
    }
    function updateUI(params) {
        log.info("Game got updateUI :", params);
        game.didMakeMove = false; // Only one move per updateUI
        game.currentUpdateUI = params;
        clearAnimationTimeout();
        clearDragAndDrop();
        game.state = params.move.stateAfterMove;
        if (isFirstMove()) {
            game.state = gameLogic.getInitialState();
            if (isMyTurn())
                makeMove(gameLogic.createInitialMove());
        }
        else {
            // We calculate the AI move only after the animation finishes,
            // because if we call aiService now
            // then the animation will be paused until the javascript finishes.
            game.animationEndedTimeout = $timeout(animationEndedCallback, 500);
        }
    }
    game.updateUI = updateUI;
    function maybeSendComputerMove() {
        if (!isComputerTurn())
            return;
        //let move = aiService.findComputerMove(currentUpdateUI.move);
        //log.info("Computer move: ", move);
        // makeMove(move);
    }
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            var n = navigator;
            log.log('Calling serviceWorker.register');
            n.serviceWorker.register('service-worker.js').then(function (registration) {
                log.log('ServiceWorker registration successful with scope: ', registration.scope);
            }).catch(function (err) {
                log.log('ServiceWorker registration failed: ', err);
            });
        }
    }
    /**
     * @ params fromDelta position of from cell
     * @ params toDelta position of to cell
     * @ return a boolean value indicating whether it is legal to drag.
     **/
    function dragOk(fromDelta, toDelta) {
        if (!isHumanTurn()) {
            return false;
        }
        return true;
    }
    function clearDragAndDrop() {
        game.dragAndDropStartPos = null;
    }
    function endDragAndDrop() {
        game.dragAndDropStartPos = null;
        if (game.dragAndDropElement)
            game.dragAndDropElement.removeAttribute("style");
        game.dragAndDropElement = null;
    }
    function makeMove(move) {
        if (game.didMakeMove) {
            return;
        }
        game.didMakeMove = true;
        moveService.makeMove(move);
    }
    function isFirstMove() {
        return !game.currentUpdateUI.move.stateAfterMove;
    }
    function yourPlayerIndex() {
        return game.currentUpdateUI.yourPlayerIndex;
    }
    function isComputer() {
        return game.currentUpdateUI.playersInfo[game.currentUpdateUI.yourPlayerIndex].playerId === '';
    }
    function isComputerTurn() {
        return isMyTurn() && isComputer();
    }
    function isHumanTurn() {
        return isMyTurn() && !isComputer();
    }
    function isMyTurn() {
        return !game.didMakeMove &&
            game.currentUpdateUI.move.turnIndexAfterMove >= 0 &&
            game.currentUpdateUI.yourPlayerIndex === game.currentUpdateUI.move.turnIndexAfterMove; // it's my turn
    }
    function isPieceA(row, col) {
        return game.state.board[row][col] === 'A';
    }
    game.isPieceA = isPieceA;
    function isPieceB(row, col) {
        return game.state.board[row][col] === 'B';
    }
    game.isPieceB = isPieceB;
    function isPieceC(row, col) {
        return game.state.board[row][col] === 'C';
    }
    game.isPieceC = isPieceC;
    function isPieceD(row, col) {
        return game.state.board[row][col] === 'D';
    }
    game.isPieceD = isPieceD;
})(game || (game = {}));
angular.module('myApp', ['gameServices'])
    .run(function () {
    $rootScope['game'] = game; //create a subscope in rootscope and name it 'game', asign it with the herein defined 'game'module
    game.init(); //does this get run before rendering the view? i.e. can dom display values created by this ini()?
});
//# sourceMappingURL=game.js.map