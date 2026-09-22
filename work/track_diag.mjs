import { Track } from '../game/src/track.js';
const [dk, seed] = [process.argv[2] || 'hard', Number(process.argv[3] || 20260921)];
const t = new Track(seed, dk);
const orig = t._commit.bind(t);
let lastInfo = null;
const feat = t._feature.bind(t);
t._feature = function () {
  const before = this.squeezes;
  const up = this.field.U;
  const lev = this._uc(this._x, this._z) - this._floor;
  const e = Math.atan2(Math.sin(this._h - this._leg), Math.cos(this._h - this._leg));
  const s0 = this._s, legLeft = this._legLeft;
  feat();
  if (this.squeezes > before) {
    const f = this.features[this.features.length - 1];
    console.log(`squeeze at s=${s0.toFixed(0)} type=${f.type} dir=${f.dir} R=${(f.R||0).toFixed(0)} lev=${lev.toFixed(1)} e=${e.toFixed(2)} legLeft=${legLeft.toFixed(0)}`);
    const prev = this.features.slice(-6, -1).map((g) => `${g.type}${g.dir>0?'L':g.dir<0?'R':''}@${g.s0.toFixed(0)}`).join(' ');
    console.log('   previous:', prev);
  }
};
t.ensure(8000);
console.log('squeezes', t.squeezes);
