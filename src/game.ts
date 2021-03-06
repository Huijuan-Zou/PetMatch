                interface SupportedLanguages {
                    en: string, zh: string,
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
                    export let animationEnded = false;
                    export let animationEndedTimeout: ng.IPromise<any> = null;
                    export let state: IState = null;
                    export let board: Board = null;
                    export let startDelta: BoardDelta = null;
                    export let ele: HTMLElement = null;

                  export function getCurScore(){
                    let afterscoresum = 0;
                    let beforePlayer0 = 0;
                    let beforePlayer1 = 0;
                    let afterPlayer0 = 0;
                    let afterPlayer1 = 0;
                    if (currentUpdateUI.move.stateAfterMove){
                      afterPlayer0 = currentUpdateUI.move.stateAfterMove.scores[0];
                      afterPlayer1 = currentUpdateUI.move.stateAfterMove.scores[1];
                      afterscoresum = afterPlayer0 + afterPlayer1;
                    }
                    let beforescoresum = 0;
                    if (currentUpdateUI.stateBeforeMove){
                      beforePlayer0 = currentUpdateUI.stateBeforeMove.scores[0];
                      beforePlayer1 = currentUpdateUI.stateBeforeMove.scores[1];
                      beforescoresum = beforePlayer0 + beforePlayer1;
                    }
                    let b = false;
                    if (afterPlayer0 - beforePlayer0 > 0){
                      b = currentUpdateUI.yourPlayerIndex === 0;
                      log.info("scoreby0", currentUpdateUI.yourPlayerIndex);
                    }
                    else if (afterPlayer1 - beforePlayer1 > 0){
                      b = currentUpdateUI.yourPlayerIndex === 1;
                      log.info("scoreby1", currentUpdateUI.yourPlayerIndex);
                    }
                    return afterscoresum-beforescoresum;
                  }

                    export function getMyScore(): any{//return accumulated scores
                        return state.scores[currentUpdateUI.move.turnIndexAfterMove];
                    }

                    export function shouldShowScore() {
                        return !animationEnded && (getMyScore() !== 0 || getOpponentCompletedSteps() == 0) && getMyCompletedSteps() !== 0;
                    }
                    
                    export function getOpponentScore(): any{//return accumulated scores
                        return state.scores[1 - currentUpdateUI.move.turnIndexAfterMove];
                    }

                    export function getTotSteps(): number {//return max steps allowed
                        return PARAMS.TOTALSTEPS;
                    } 

                    export function getMyCompletedSteps (): any {//return steps been completed
                        return state.completedSteps[1- currentUpdateUI.move.turnIndexAfterMove];
                    }

                    export function getOpponentCompletedSteps (): any {//return steps been completed
                        return state.completedSteps[currentUpdateUI.move.turnIndexAfterMove];
                    }
                    
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
                        checkMoveOk: gameLogic.checkMoveOkN,
                        updateUI: updateUI,
                        gotMessageFromPlatform: null,
                        });
                        dragAndDropService.addDragListener("gameBoard", handleDragEvent);
                    }

                    function getTranslation() : Translations {
                        return { 

                        };
                    }
                    export function handleDragEvent(type : string, cx : number, cy : number) {
                        //if the user drags cell to outside of the game area, the function will take middle point of the nearest cell        
                        let cellSize: CellSize = getCellSize();//cell size changes when you switch device or resize window             
                        let x : number = Math.min(Math.max(cx - gameArea.offsetLeft, cellSize.width / 2), gameArea.clientWidth - cellSize.width / 2);//convert absolute position to relative position (relative to parent element)
                        let y : number = Math.min(Math.max(cy - gameArea.offsetTop, cellSize.height / 2), gameArea.clientHeight - cellSize.height / 2);//the inner max() takes care if cursor moves to the left or below gameArea. the outer min takes care if cursor moves to the right or top of gameArea
                        
                        //calculate delta based on mouse position
                        let delta : BoardDelta = {
                            row : Math.floor(PARAMS.ROWS * (y-0.1*gameArea.clientHeight) / (gameArea.clientHeight * 0.9)),
                            col : Math.floor(PARAMS.COLS * x / gameArea.clientWidth)
                        };
                        //log.log(delta);

                        let pos = {
                            top : y - cellSize.height * 0.5,
                            left : x - cellSize.width * 0.5
                        };
                        
                        let startPos : any;

                        if (type == "touchstart"){
                            startDelta = delta;
                            startPos = getTopLeft(delta.row,delta.col,cellSize);
                            ele = document.getElementById("img_container_" + startDelta.row + "_" + startDelta.col);
                            let style: any = ele.style;
                            style['z-index'] = 20;
                            if (startDelta) {
                                setPos(pos, cellSize);
                            }
                            return;
                        }

                        if (type == "touchmove") {
                            if (pos && startDelta) setPos(pos, cellSize);
                            return;
                        }
                        
                        if (type == "touchend" && startDelta) {
                            let fromDelta = {
                                row : startDelta.row,
                                col : startDelta.col
                            };
                            let toDelta = {
                                row : delta.row,
                                col : delta.col
                            };
                            let nextMove : IMove = null;
                            if (dragOk(fromDelta, toDelta)) {
                                try {
                                    nextMove = gameLogic.createMove(state, fromDelta, toDelta, currentUpdateUI.move.turnIndexAfterMove);
                                        } catch (e) {
                                            log.info(["Move is illegal:", e]);
                                            endDragAndDrop();
                                            return;
                                        }
                                        makeMove(nextMove);
                            }
                        }
                        if (type === "touchend" || type === "touchcancel" || type === "touchleave") {
                            endDragAndDrop();
                        }
                    }

                    function getCellSize() : CellSize {//calculate cell size, which varies on different devices.
                        return {
                            width : gameArea.clientWidth / PARAMS.COLS,//gameArea.clientWidth is the width of the html body.
                            height : (gameArea.clientHeight)*0.9 / PARAMS.ROWS
                        };
                    }
                    
                   /**
                   * Set the TopLeft of the element.
                   */
                  function setPos(pos: TopLeft, cellSize: CellSize): void {
                    let startPos = getTopLeft(startDelta.row, startDelta.col, cellSize);
                    let deltaX: number = pos.left - startPos.left;
                    let deltaY: number = pos.top - startPos.top;
                    let transform = "translate(" + deltaX + "px," + deltaY + "px) scale(1.2)";
                    let style: any = ele.style;
                    log.log("pos.top:" + pos.top + "; startPos.top:" + startPos.top)
                    style['transform'] = transform;
                    style['-webkit-transform'] = transform;
                    style['will-change'] = "transform"; // https://developer.mozilla.org/en-US/docs/Web/CSS/will-change
                }

                 /**
                  * Get the position of the cell.
                  * @param row row number of cell
                  * @param col col number of cell
                  * @param cellSize cell size of each cell in gameBoard
                  **/
                  function getTopLeft(row: number, col: number, cellSize: CellSize): TopLeft {
                    let top: number = row * cellSize.height + gameArea.clientHeight*0.1;//10% of gameArea height is used for score board
                    let left: number = col * cellSize.width;
                    let pos: TopLeft = {top: top, left: left};
                    return pos;
                  }

                  function animationEndedCallback() {
                    log.info("Animation ended");
                    maybeSendComputerMove();
                    animationEnded = true;
                  }
                  
                  function clearAnimationTimeout() {
                    if (animationEndedTimeout) {
                      $timeout.cancel(animationEndedTimeout);
                      animationEndedTimeout = null;
                    }
                  }  

                    export function updateUI(params: IUpdateUI): void {
                    log.info("Game got updateUI :", params);
                    animationEnded = false;
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
                       let move = aiService.findComputerMove(currentUpdateUI.move);
                       log.info("Computer move: ", move);
                       makeMove(move);
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
                        startDelta = null;
                    }

                    function endDragAndDrop() : void {
                        startDelta = null;
                        if (ele) ele.removeAttribute("style");
                        ele = null;
                    }

                    export function getMoveDownClass(row: number, col: number): string {//find out how many steps a ball,if needed, should move down
                        let res = 0;
                        if (state.changedDelta){//if there is at least one modified cell
                        for (let i = 0; i < state.changedDelta.length; i++) {//for each modified cell
                            if (state.changedDelta[i].row >= row && state.changedDelta[i].col === col) {//only need to move if the modified cell is below you (bigger row # and same col #)
                                res++;//sum up how many cells below you have been modified; this is the number of steps you need to move down.
                            }
                        }
                        }
                        // log.info("test it out", row, col, res, state.changedDelta);
                        if (res !== 0 && state.changedDelta)//you [(raw,col) passed to this function] cam move down only if: 1. there is modified cells below you and 2. animation has not been marked as finished.
                        return 'movedown'+res;//return how many steps you need to move down
                        return '';//you don't need to move'
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

                    export function isPassAndPlay() {
                        return currentUpdateUI.playMode === 'passAndPlay';
                    }

                    export function yourPlayerIndex() {
                        return currentUpdateUI.yourPlayerIndex;
                    }

                    export function opponentIndex() {
                        return 1-currentUpdateUI.yourPlayerIndex;
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

                  export function isMyTurn() {
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