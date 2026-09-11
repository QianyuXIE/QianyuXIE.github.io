const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Chess}=require('chess.js');
const data=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../chess-position.json'),'utf8'));
const game=new Chess();game.loadPgn(data.pgn);
assert.equal(game.history().length,30);
if(data.fen)assert.equal(game.fen(),data.fen);
console.log(game.fen());console.log(game.ascii());
console.log('PASS: 30 legal plies; Najdorf middlegame, not a claimed historical game or book excerpt.');
