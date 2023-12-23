import {makeNextExpCalculator, calcTriangularNum} from "./math/scf.mjs"
import {makeIMObj, progressIMObj} from "./math/physics.mjs"




export const gameState = {
  mode: "title",
};


const calcNextExp = makeNextExpCalculator(10, 1.2);
const checkLvUp = (lvupHook) => {
  const oldLv = gameState.player.lv;
  while (gameState.player.nextExp <= gameState.player.exp) {
    gameState.player.lv++;
    gameState.player.exp -= gameState.player.nextExp;
    gameState.player.nextExp = calcNextExp(gameState.player.lv);
    const gainedHp = gameState.player.lv; // TODO: 要調整
    gameState.player.hp[1] += gainedHp;
    gameState.player.hp[0] += gainedHp; // TODO: これはなしでもよいが…
  }
  if (oldLv != gameState.player.lv) { lvupHook() }
};
//const gainExp = (gainedExp) => {
//  gameState.player.exp += gainedExp;
//  let isUpLevel;
//  checkLvUp(() => {
//    isUpLevel = 1;
//  });
//  updateStatusWindow();
//  return isUpLevel;
//};


const resetPlayer = () => {
  gameState.player = {
    numberOfGuests: 0,
    numberOfGuestsMax: 10,
    enemyHP: null, // 敵出現後に数値をセットする
    //
    hp: [5, 5],
    lv: 0,
    exp: 0,
    nextExp: calcNextExp(0),
  };
};


const resetPositionalData = () => {
  gameState.moveFactorX = 0;
  gameState.moveFactorZ = 0;

  gameState.rotIMObj ||= makeIMObj(3);
  gameState.rotIMObj.decelRates[0] = 0.995;
  gameState.rotIMObj.decelRates[1] = 0.995;
  gameState.rotIMObj.decelRates[2] = 0.995;
  gameState.rotIMObj.decelStopLimits = 0.0000001;

  gameState.sgCameraDelta = 0;
};




export const resetGameData = () => {
  resetPlayer();

  if (!gameState.rotIMObj) { resetPositionalData() }

  gameState.nextSpawnTimerMsec = 1000;

  gameState.lisperX = 0;
  gameState.blastX = 0;
  gameState.boxX = null;

  gameState.bossAbsX = null;
  gameState.bossAbsY = null;

  gameState.phase = 1;
};


resetGameData();


