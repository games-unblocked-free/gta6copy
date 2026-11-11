// ui.js - loading bar, HUD, minimap, F3 debug panel. All DOM, no assets needed.
export class UI {
  constructor() {
    const root = document.getElementById('ui');
    root.innerHTML = `<style>
#load{position:fixed;inset:0;background:#0b1020;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:9}
#bar{width:320px;height:10px;background:#222;border-radius:5px;overflow:hidden}#fill{height:100%;width:0;background:#ff4fa3}
.hud{position:fixed;font-weight:700;text-shadow:0 1px 3px #000}
#cash{top:12px;right:16px;font-size:24px;color:#8aff8a}#stars{top:44px;right:16px;font-size:26px;color:#ffd84a}
#obj{top:12px;left:50%;transform:translateX(-50%);font-size:14px;max-width:70vw;text-align:center}
#bars{left:16px;bottom:12px;width:180px}.b{height:8px;margin:3px 0;background:#0008}.b i{display:block;height:100%}
#wep{right:16px;bottom:12px;text-align:right}#mm{left:16px;bottom:50px;border-radius:50%;border:2px solid #fff8;background:#0008}
#dbg{position:fixed;left:8px;top:8px;margin:0;padding:8px;background:#000b;font:11px/1.3 monospace;max-height:80vh;overflow:auto;display:none}
</style>
<div id="load"><h1>LEONA CITY</h1><div id="bar"><div id="fill"></div></div><small id="ltxt">loading...</small></div>
<div class="hud" id="cash"></div><div class="hud" id="stars"></div><div class="hud" id="obj"></div>
<div class="hud" id="bars"><div class="b"><i id="hp" style="background:#e33"></i></div><div class="b"><i id="ar" style="background:#39f"></i></div></div>
<div class="hud" id="wep"></div><canvas id="mm" width="180" height="180"></canvas><pre id="dbg"></pre>`;
    this.$ = id => document.getElementById(id);
    this.mm = this.$('mm').getContext('2d'); this.report = [];
  }
  loading(p, txt) { this.$('fill').style.width = (p * 100) + '%'; this.$('ltxt').textContent = txt || ''; }
  hideLoading() { this.$('load').remove(); }
  toggleDebug() { const d = this.$('dbg'); d.style.display = d.style.display === 'block' ? 'none' : 'block'; }
  // s: {cash,wanted,hp,armor,weapon,ammo,speed,objective}
  hud(s) {
    this.$('cash').textContent = '$' + s.cash.toLocaleString();
    this.$('stars').textContent = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
    this.$('hp').style.width = s.hp + '%'; this.$('ar').style.width = s.armor + '%';
    this.$('wep').textContent = (s.weapon ? `${s.weapon} ${s.ammo}` : '') + (s.speed != null ? `  ${Math.round(s.speed)} km/h` : '');
    this.$('obj').textContent = s.objective || '';
  }
  debug(d) {
    const el = this.$('dbg'); if (el.style.display !== 'block') return;
    const n = this.report.filter(r => r.status === 'loaded').length;
    el.textContent = `fps ${d.fps}\npos ${d.pos}\nwanted ${d.wanted}  time ${d.tod}\nassets: ${n} loaded / ${this.report.length - n} placeholder\n\n` +
      this.report.map(r => `${r.status === 'loaded' ? 'OK ' : 'PH '} ${r.type}/${r.asset}`).join('\n');
  }
  // world minimap: rotates with player yaw, blips = [{x,z,color}]
  minimap(world, pos, yaw, blips) {
    const c = this.mm, S = 0.25;
    c.save(); c.clearRect(0, 0, 180, 180); c.beginPath(); c.arc(90, 90, 90, 0, 6.3); c.clip();
    c.translate(90, 90); c.rotate(yaw); c.translate(-pos.x * S, -pos.z * S);
    c.strokeStyle = '#999'; c.lineWidth = 14 * S;
    world.xs.forEach(x => { c.beginPath(); c.moveTo(x * S, -700 * S); c.lineTo(x * S, 700 * S); c.stroke(); });
    world.zs.forEach(z => { c.beginPath(); c.moveTo(-700 * S, z * S); c.lineTo(400 * S, z * S); c.stroke(); });
    const dot = (x, z, col, r) => { c.fillStyle = col; c.fillRect(x * S - r, z * S - r, r * 2, r * 2); };
    world.banks.forEach(b => dot(b.x, b.z, '#ffd84a', 5));
    blips.forEach(b => dot(b.x, b.z, b.color, 3));
    c.restore();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(90, 80); c.lineTo(84, 98); c.lineTo(96, 98); c.fill();
  }
}
