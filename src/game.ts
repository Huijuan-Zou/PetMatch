interface SupportedLanguages {
    en: string, iw: string,
    pt: string, zh: string,
    el: string, fr: string,
    hi: string, es: string,
};

interface Translations {
    [index : string] : SupportedLanguages;
}

interface CellSize {
    width : number;
    height : number;
}

interface TopLeft {
  top: number;
  left: number;
}



module game {
    let gameArea : HTMLElement = null;
    let PARAMS : any = gameLogic.PARAMS;
    export let currentUpdateUI: IUpdateUI = null;
    export let didMakeMove: boolean = false; // You can only make one move per updateUI
    export let animationEndedTimeout: ng.IPromise<any> = null;
    export let state: IState = null;
    export let board: Board = null;
    export let dragAndDropStartPos: BoardDelta = null;
    export let dragAndDropElement: HTMLElement = null;
    
    function getTranslations(): Translations {
        return {};
    }

    export function init() {
        registerServiceWorker();
        gameArea = document.getElementById("gameArea");
        if (!gameArea) throw new Error("Can't find gameArea!");

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
        dragAndDropService.addDragListener("gameArea", handleDragEvent);//'gameArea' here refers to the reference variable not the string literal representing the element id.
    }//addDragListener() applies a event monitor to 'gameArea', once mouse hovers over 'gameArea', the monitor collects mouse information (type of event, position of curse) to handleEvent that is implemented by users.

    export function handleDragEvent(type : string, cx : number, cy : number) {
        log.log("type", type);
        log.log("cx " + cx);
        log.log("cy : " + cy);
        
        //if the user drags cell to outside of the game area, the function will take middle point of the nearest cell        
        let cellSize: CellSize = getCellSize();//cell size changes when you switch device or resize window             
        let x : number = Math.min(Math.max(cx - gameArea.offsetLeft, cellSize.width / 2), gameArea.clientWidth - cellSize.width / 2);//convert absolute position to relative position (relative to parent element)
        let y : number = Math.min(Math.max(cy - gameArea.offsetTop, cellSize.height / 2), gameArea.clientHeight - cellSize.height / 2);//the inner max() takes care if cursor moves to the left or below gameArea. the outer min takes care if cursor moves to the right or top of gameArea
        log.log("x position : " + x);
        log.log("y position : " + y);
        let dragAndDropPos = {
            top : y - cellSize.height * 0.605,
            left : x - cellSize.width * 0.605
        };
        let dragAndDropStart : any;

        //dragging around
        if (type == "touchmove") {
            if (dragAndDropPos) setDragAndDropElementPos(dragAndDropPos, cellSize);
            return;
        }
        //get the index of cell based on current pos (cx, cy). identify cell based on mouse position
        let delta : BoardDelta = {
            row : Math.floor(PARAMS.ROWS * y / gameArea.clientHeight),
            col : Math.floor(PARAMS.COLS * x / gameArea.clientWidth)
        };
        log.log(delta);
        if (type == "touchstart"){//if mouse pressed down
            dragAndDropStartPos = delta;//save start cell, because a new delta will be calculated once pressed mouse is moved.
            dragAndDropStart = dragAndDropPos;
            dragAndDropElement = document.getElementById("img_container_" + dragAndDropStartPos.row + "_" + dragAndDropStartPos.col);
            let style: any = dragAndDropElement.style;
            style['z-index'] = 20;
            setDragAndDropElementPos(dragAndDropPos, cellSize);
            return;
        }
        
        if (type == "touchend" && dragAndDropStartPos) {//if mouse released from a drag
            let fromDelta = {
                row : dragAndDropStartPos.row,
                col : dragAndDropStartPos.col
            };
            let toDelta = {
                row : delta.row,//new delta is calculated based on new cursor position
                col : delta.col
            };
            let nextMove : IMove = null;
            if (dragOk(fromDelta, toDelta)) {//if human turn
                state.fromDelta = fromDelta;
                state.toDelta = toDelta;
                let boardTemp = angular.copy(state.board);
                let changedBoardCount : BoardCount = gameLogic.updateBoard(boardTemp, fromDelta, toDelta);
                try {//calculate next move, if ilegal then report error.
                    nextMove = gameLogic.createMove(state, changedBoardCount, currentUpdateUI.move.turnIndexAfterMove);
                } catch (e) {
                    log.info(["Move is illegal:", e]);
                    endDragAndDrop();//move back to original position
                    return;
                }
                makeMove(nextMove);//make legal move
            }
        }
        if (type === "touchend" || type === "touchcancel" || type === "touchleave") {
            endDragAndDrop();
        }
    }//end handleDragEvent()

    function getCellSize() : CellSize {//calculate cell size, which varies on different devices.
        return {
            width : gameArea.clientWidth / PARAMS.COLS,//gameArea.clientWidth is the width of the html body.
            height : gameArea.clientHeight / PARAMS.ROWS
        };
    }
    
    /**
   * Set the TopLeft of the element.
   */
  function setDragAndDropElementPos(pos: TopLeft, cellSize: CellSize): void {
    let style: any = dragAndDropElement.style;
    let top: number = cellSize.height / 10;
    let left: number = cellSize.width / 10;
    let originalSize = getCellPos(dragAndDropStartPos.row, dragAndDropStartPos.col, cellSize);
    let deltaX: number = (pos.left - originalSize.left + left);
    let deltaY: number = (pos.top - originalSize.top + top);
    // make it 20% bigger (as if it's closer to the person dragging).
    let transform = "translate(" + deltaX + "px," + deltaY + "px) scale(1.2)";
    style['transform'] = transform;
    style['-webkit-transform'] = transform;
    style['will-change'] = "transform"; // https://developer.mozilla.org/en-US/docs/Web/CSS/will-change
  }

    /**
   * Get the position of the cell.
   */
  function getCellPos(row: number, col: number, cellSize: CellSize): TopLeft {
    let top: number = row * cellSize.height;
    let left: number = col * cellSize.width;
    let pos: TopLeft = {top: top, left: left};
    return pos;
  }

  function animationEndedCallback() {
    log.info("Animation ended");
    maybeSendComputerMove();
  }
  function clearAnimationTimeout() {
    if (animationEndedTimeout) {
      $timeout.cancel(animationEndedTimeout);
      animationEndedTimeout = null;
    }
  }  

    export function updateUI(params: IUpdateUI): void {
    log.info("Game got updateUI :", params);
    didMakeMove = false; // Only one move per updateUI
    currentUpdateUI = params;
    clearAnimationTimeout();
    clearDragAndDrop();
    state = params.move.stateAfterMove;
    if (isFirstMove()) {
      state = gameLogic.getInitialState();
      if (isMyTurn()) makeMove(gameLogic.createInitialMove());
    } else {
      // We calculate the AI move only after the animation finishes,
      // because if we call aiService now
      // then the animation will be paused until the javascript finishes.
      animationEndedTimeout = $timeout(animationEndedCallback, 500);
    }
  }

   function maybeSendComputerMove() {
       if (!isComputerTurn()) return;
       //let move = aiService.findComputerMove(currentUpdateUI.move);
       //log.info("Computer move: ", move);
      // makeMove(move);
    }

    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            let n: any = navigator;
            log.log('Calling serviceWorker.register');
            n.serviceWorker.register('service-worker.js').then(function(registration: any) {
                log.log('ServiceWorker registration successful with scope: ',    registration.scope);
            }).catch(function(err: any) {
                log.log('ServiceWorker registration failed: ', err);
            });
        }
    }

    /**
     * @ params fromDelta position of from cell
     * @ params toDelta position of to cell
     * @ return a boolean value indicating whether it is legal to drag.
     **/
    function dragOk(fromDelta : BoardDelta, toDelta : BoardDelta) : boolean {
        if (!isHumanTurn()) {
            return false;
        }
        return true;
    }

    function clearDragAndDrop() {
        dragAndDropStartPos = null;
    }

    function endDragAndDrop() : void {
        dragAndDropStartPos = null;
        if (dragAndDropElement) dragAndDropElement.removeAttribute("style");
        dragAndDropElement = null;
    }
    
    function makeMove(move: IMove) {
        if (didMakeMove) { // Only one move per updateUI
            return;
        }
        didMakeMove = true;
        moveService.makeMove(move);
    }

    function isFirstMove() {
        return !currentUpdateUI.move.stateAfterMove;
    }

    function yourPlayerIndex() {
        return currentUpdateUI.yourPlayerIndex;
    }

    function isComputer() {
        return currentUpdateUI.playersInfo[currentUpdateUI.yourPlayerIndex].playerId === '';
    }

    function isComputerTurn() {
        return isMyTurn() && isComputer();
    }

    function isHumanTurn() {
        return isMyTurn() && !isComputer();
    }

    function isMyTurn() {
        return !didMakeMove && // you can only make one move per updateUI.
        currentUpdateUI.move.turnIndexAfterMove >= 0 && // game is ongoing
        currentUpdateUI.yourPlayerIndex === currentUpdateUI.move.turnIndexAfterMove; // it's my turn
    }

    export function isPieceA(row: number, col: number): boolean {
        return state.board[row][col] === 'A';
    }

    export function isPieceB(row: number, col: number): boolean {
        return state.board[row][col] === 'B';
    }

    export function isPieceC(row: number, col: number): boolean {
        return state.board[row][col] === 'C';
    }

    export function isPieceD(row: number, col: number): boolean {
        return state.board[row][col] === 'D';
    }
}

angular.module('myApp', ['gameServices'])
  .run(function () {
    $rootScope['game'] = game;//create a subscope in rootscope and name it 'game', asign it with the herein defined 'game'module
    game.init();//does this get run before rendering the view? i.e. can dom display values created by this ini()?
  });