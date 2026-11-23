/* Kaplan Filo - açılış ekranı ("gece yolu"): masaüstü programındaki açılışın telefon uyarlaması.
   Koyu zemin, ufka uzanan turuncu ışıklı çizgiler, beyaz logo plakası, ardından uygulama. Ekrana dokununca hızlanır. */
(function () {
  var kap = document.getElementById('splash');
  var cv = document.getElementById('splash-canvas');
  if (!kap || !cv || !cv.getContext) { if (kap) kap.parentNode.removeChild(kap); return; }

  var ACC = [234, 124, 21], ZEMIN = [17, 11, 8], ACIK = [236, 238, 242];
  var rgba = function (c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };
  var karistir = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };

  var ctx = cv.getContext('2d');
  var W = 0, H = 0, dpr = 1;
  function boyutla() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  boyutla();
  window.addEventListener('resize', boyutla);

  var logo = new Image();
  var logoHazir = false;
  logo.onload = function () { logoHazir = true; };
  logo.src = 'logo.png';

  var azalt = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BELIR = azalt ? 0.2 : 0.7, YUKLEME = azalt ? 0.4 : 1.9, TUR = 1.3;
  var t0 = performance.now(), asama = 'belir', tYuk = 0, hizli = false, bitti = false, p = 0;

  function plaka(alfa, cx, cy, pw, ph) {
    var kes = ph * 0.157;
    var x0 = cx - pw / 2, x1 = cx + pw / 2, y0 = cy - ph / 2, y1 = cy + ph / 2;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.beginPath();
    ctx.moveTo(x0 + kes, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y1 - kes); ctx.lineTo(x1 - kes, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y0 + kes);
    ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.restore();
    // köşe ayraçları
    var o = 9, u = 26;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.strokeStyle = rgba(ACC, 1); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0 - o, y0 + kes + u); ctx.lineTo(x0 - o, y0 + kes - 4); ctx.lineTo(x0 + kes - 4, y0 - o); ctx.lineTo(x0 + kes + u, y0 - o);
    ctx.moveTo(x1 + o, y1 - kes - u); ctx.lineTo(x1 + o, y1 - kes + 4); ctx.lineTo(x1 - kes + 4, y1 + o); ctx.lineTo(x1 - kes - u, y1 + o);
    ctx.stroke();
    ctx.restore();
    // logo
    ctx.save();
    ctx.globalAlpha = alfa;
    if (logoHazir) {
      var oran = Math.min(pw * 0.78 / logo.width, ph * 0.72 / logo.height);
      var lw = logo.width * oran, lh = logo.height * oran;
      ctx.drawImage(logo, cx - lw / 2, cy - lh / 2, lw, lh);
    } else {
      ctx.fillStyle = '#101014'; ctx.font = '800 ' + Math.round(ph * 0.3) + 'px -apple-system,Segoe UI,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('KAPLAN BETON', cx, cy);
    }
    ctx.restore();
  }

  function zemin(t, yuk) {
    var HZ = H * 0.6, vx = W / 2;
    ctx.fillStyle = rgba(ZEMIN, 1); ctx.fillRect(0, 0, W, H);
    // zeminin ufka uzanan çizgileri
    var yay = W / 4.3;
    var g = ctx.createLinearGradient(0, HZ, 0, H);
    g.addColorStop(0, rgba(ACC, 0.05)); g.addColorStop(1, rgba(ACC, 0.9));
    ctx.save();
    ctx.beginPath(); ctx.rect(0, HZ, W, H - HZ); ctx.clip();
    ctx.strokeStyle = g; ctx.lineWidth = 1.2; ctx.shadowColor = rgba(ACC, 0.9); ctx.shadowBlur = 8;
    for (var i = -14; i <= 14; i++) {
      ctx.beginPath(); ctx.moveTo(vx + i * (yay / 15), HZ); ctx.lineTo(vx + i * yay, H + 40); ctx.stroke();
    }
    // bize doğru akan yatay çizgiler
    var n = 11, kayma = (t / TUR) % 1;
    for (var j = 0; j <= n; j++) {
      var u = Math.pow((j + kayma) / n, 2.4);
      var y = HZ + (H - HZ + 30) * u;
      ctx.globalAlpha = Math.min(1, 0.08 + u * 1.1);
      ctx.lineWidth = 0.8 + 1.6 * u;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
    // ufuk ışığı: yüklendikçe ortadan kenarlara yayılır
    if (yuk > 0) {
      var yarim = (W / 2 + 20) * yuk;
      var ac = karistir(ACC, [255, 255, 255], 0.35);
      ctx.save();
      ctx.beginPath(); ctx.rect(vx - yarim, HZ - 60, yarim * 2, 120); ctx.clip();
      ctx.shadowColor = rgba(ac, 1); ctx.shadowBlur = 26; ctx.fillStyle = rgba(ac, 1);
      ctx.fillRect(0, HZ - 1, W, 2.5);
      ctx.shadowBlur = 8; ctx.fillRect(0, HZ - 1, W, 2.5);
      ctx.restore();
    }
  }

  function bitir() {
    if (bitti) return;
    bitti = true;
    kap.classList.add('kapan');
    setTimeout(function () { if (kap.parentNode) kap.parentNode.removeChild(kap); }, 450);
  }

  function kare(simdi) {
    if (bitti) return;
    var t = (simdi - t0) / 1000;
    var plakaAlfa = 1, yazi = '';
    if (asama === 'belir') {
      var x = Math.min(1, t / BELIR); plakaAlfa = x * x * (3 - 2 * x); p = 0;
      if (t >= BELIR) { asama = 'yukle'; tYuk = simdi; }
    } else if (asama === 'yukle') {
      var sure = (hizli ? 0.4 : YUKLEME) * 1000;
      var xx = Math.min(1, (simdi - tYuk) / sure);
      p = 1 - Math.pow(1 - xx, 2);
      yazi = 'Uygulama hazırlanıyor';
      if (xx >= 0.35) yazi = 'Veriler yükleniyor';
      if (xx >= 0.7) yazi = 'Son rötuşlar yapılıyor';
      yazi += '   %' + Math.round(p * 100);
      if (xx >= 1) { asama = 'hazir'; p = 1; setTimeout(bitir, 150); }
    } else { p = 1; }

    zemin(t, p);
    var pw = Math.min(W * 0.82, 400), ph = pw * 0.31, cx = W / 2, cy = H * 0.3;
    plaka(plakaAlfa, cx, cy, pw, ph);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (asama !== 'belir') {
      ctx.fillStyle = rgba(ACIK, 1); ctx.font = '500 ' + Math.max(15, Math.round(W * 0.045)) + 'px -apple-system,Segoe UI,sans-serif';
      ctx.fillText('Filo ve operasyon yönetimi', cx, cy + ph / 2 + 46);
    }
    if (yazi) {
      ctx.fillStyle = rgba(ACIK, 0.8); ctx.font = '500 13px -apple-system,Segoe UI,sans-serif';
      ctx.fillText(yazi, cx, H * 0.6 + 34);
    }
    ctx.restore();
    requestAnimationFrame(kare);
  }

  var hizlandir = function () { hizli = true; };
  kap.addEventListener('pointerdown', hizlandir);
  requestAnimationFrame(kare);
  // ne olursa olsun en geç 6 sn sonra kapanır (örn. animasyon donarsa)
  setTimeout(bitir, 6000);
})();
