import { Chess } from 'chess.js';
import initial from '../../chess-position.json';

// Original study notes and illustrative lines, not pages copied from a book.
export const openings = [
  { id:'sicilian', title:'西西里防御', english:'Sicilian Defence · Najdorf', eco:'B90',
    note:'白方争取王翼空间，黑方从后翼反击。异侧易位后，观察两翼兵线推进的速度。',
    pgn:initial.pgn },
  { id:'italian', title:'意大利开局', english:'Italian Game', eco:'C50',
    note:'先出马和象，再稳固中心。白象注视 f7，短易位让王尽早安全。',
    pgn:'1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O' },
  { id:'ruy-lopez', title:'西班牙开局', english:'Ruy Lopez', eco:'C60',
    note:'白象对 c6 马施压，间接争夺 e5。保留中心张力，注意象的退路与后翼空间。',
    pgn:'1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3' },
  { id:'french', title:'法兰西防御', english:'French Defence · Advance', eco:'C02',
    note:'锁定的中心决定进攻方向。黑方用 c5 冲击 d4，白方寻找王翼空间。',
    pgn:'1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Qb6 6. a3' },
  { id:'queens-gambit', title:'拒后翼弃兵', english:"Queen’s Gambit Declined", eco:'D30',
    note:'用 d 兵和 c 兵争夺中心。黑方保持坚实结构，同时考虑如何解放 c8 象。',
    pgn:'1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 Nbd7' },
  { id:'kings-indian', title:'古印度防御', english:"King’s Indian Defence", eco:'E60',
    note:'黑方先出子并易位，允许白方建立兵中心，再用 e5 挑战它。',
    pgn:'1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O' },
  { id:'caro-kann', title:'卡罗–卡恩防御', english:'Caro–Kann Defence', eco:'B12',
    note:'c6 支持 d5，黑方先把浅格象发展到兵链外。观察白方空间优势和黑方结构的平衡。',
    pgn:'1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 c5 6. O-O Nc6' }
];

export function createStudy() {
  const game = new Chess();
  let opening = openings[0], line = [], ply = 0, exploring = false;
  function position(nextPly) {
    game.reset();
    ply = Math.max(0, Math.min(line.length, nextPly));
    for (const san of line.slice(0, ply)) game.move(san);
    exploring = false;
  }
  function load(index, atEnd = true) {
    opening = openings[index];
    const source = new Chess(); source.loadPgn(opening.pgn);
    line = source.history(); position(atEnd ? line.length : 0);
  }
  load(0);
  return {
    game,
    get opening() { return opening; }, get line() { return [...line]; },
    get ply() { return ply; }, get exploring() { return exploring; },
    load, step(delta) { position(ply + delta); }, reset() { position(line.length); },
    start() { position(0); },
    move(from, to, promotion = 'q') {
      try { const moved = game.move({from, to, promotion}); exploring = true; return moved; }
      catch { return null; }
    },
    undo() {
      if (!exploring) { position(ply - 1); return; }
      game.undo();
      // Resume the recorded line once the visitor has undone their variation.
      const history = game.history();
      if (history.every((san, i) => san === line[i])) {
        ply = history.length; exploring = false;
      }
    }
  };
}
