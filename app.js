'use strict';
/* Kaplan Filo - telefon uygulaması (PWA). Tek dosya, build gerektirmez. */

const SUPABASE_URL = 'https://ybtuxdfwhalopzogfcyt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rDTL66xDib1kZaBQTxbVhw_fFPagpM2';   // herkese açık anahtar (gizli değil)

const OTURUM_ANAHTAR = 'filo_oturum';
const KUYRUK_ANAHTAR = 'filo_kuyruk';
const ONBELLEK_ANAHTAR = 'filo_onbellek';
const GENEL_PLAKA = 'Plakasız / Genel';
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUN_ADLARI = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const TEVKIFAT = ['Yok', '2/10', '3/10', '4/10', '5/10', '7/10', '9/10', '10/10'];
const GIDER_YAPI = {
  'Bakım & Onarım': ['Lastik', 'Tamir & Mekanik', 'Elektrik', 'Makas & Şaseci', 'Fren', 'Egzoz', 'Kaporta & Boya', 'Yıkama&Yağlama', 'Reklam', 'Damper', 'Yedek Parça', 'Diğer'],
  'Yasal ve Resmi Ödemeler': ['MTV', 'Trafik Sigorta', 'Vize', 'Trafik Cezası', 'Diğer'],
  'Personel & Şoför Giderleri': ['Maaş', 'SGK Primi', 'Yol Harcırahı', 'Diğer']
};

/* ---------------- yardımcılar ---------------- */
class Hata extends Error {
  constructor(mesaj, tur) { super(mesaj); this.tur = tur || 'GENEL'; }
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function depoOku(k, v) { try { const x = localStorage.getItem(k); return x ? JSON.parse(x) : v; } catch (e) { return v; } }
function depoYaz(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* dolu olabilir */ } }
function depoSil(k) { try { localStorage.removeItem(k); } catch (e) { /* yoksay */ } }
function tl(n) {
  const x = Number(n) || 0;
  return (x < 0 ? '−' : '') + Math.abs(x).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
}
function tlKisa(n) {
  const x = Number(n) || 0;
  return (x < 0 ? '−' : '') + Math.abs(Math.round(x)).toLocaleString('tr-TR') + ' TL';
}
function iki(n) { return String(n).padStart(2, '0'); }
function bugunIso() { const d = new Date(); return d.getFullYear() + '-' + iki(d.getMonth() + 1) + '-' + iki(d.getDate()); }
function isoTr(iso) { const p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : String(iso || ''); }
function yilAy(y, m) { return y + '-' + iki(m); }
function yeniKimlik() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
function kdvHesapla(matrah, oran, tevkifat) {   // masaüstündeki fatura_hesapla ile aynı
  const kdv = Math.round(matrah * oran) / 100;
  let pay = 0;
  if (tevkifat && tevkifat !== 'Yok') pay = parseInt(String(tevkifat).split('/')[0], 10) || 0;
  const tv = Math.round(kdv * pay / 10 * 100) / 100;
  return { kdv: kdv, tevkifat: tv, toplam: Math.round((matrah + kdv - tv) * 100) / 100 };
}
function sayiOku(metin) {
  let t = String(metin == null ? '' : metin).trim().replace(/\s/g, '');
  if (!t) return NaN;
  if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
  return Number(t);
}

/* ---------------- oturum ---------------- */
let oturum = depoOku(OTURUM_ANAHTAR, null);

function oturumKaydet(j) {
  oturum = { access_token: j.access_token, refresh_token: j.refresh_token, bitis: Date.now() + (j.expires_in || 3600) * 1000 - 60000 };
  depoYaz(OTURUM_ANAHTAR, oturum);
}
async function authIstek(sorgu, govde) {
  let r;
  try {
    r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=' + sorgu, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(govde)
    });
  } catch (e) { throw new Hata('İnternete ulaşılamadı.', 'AG'); }
  let j = {};
  try { j = await r.json(); } catch (e) { /* boş */ }
  return { ok: r.ok, durum: r.status, j: j };
}
async function girisYap(eposta, sifre) {
  const r = await authIstek('password', { email: eposta, password: sifre });
  if (!r.ok || !r.j.access_token) throw new Hata(r.durum === 400 ? 'E-posta veya şifre yanlış.' : 'Giriş yapılamadı (' + r.durum + ').');
  oturumKaydet(r.j);
}
async function oturumYenile() {
  if (!oturum || !oturum.refresh_token) throw new Hata('Oturum yok.', 'OTURUM');
  const r = await authIstek('refresh_token', { refresh_token: oturum.refresh_token });
  if (!r.ok || !r.j.access_token) {
    oturum = null; depoSil(OTURUM_ANAHTAR);
    throw new Hata('Oturum süresi doldu, tekrar giriş yap.', 'OTURUM');
  }
  oturumKaydet(r.j);
}
async function gecerliToken() {
  if (!oturum) throw new Hata('Oturum yok.', 'OTURUM');
  if (Date.now() > oturum.bitis) await oturumYenile();
  return oturum.access_token;
}

/* ---------------- veri tabanı isteği ---------------- */
function sorguMetni(q) {
  if (!q) return '';
  const p = Object.keys(q).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(q[k]));
  return p.length ? '?' + p.join('&') : '';
}
async function api(yontem, tablo, sorgu, govde, prefer, yenidenDeneme) {
  const token = await gecerliToken();
  const basliklar = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  if (prefer) basliklar.Prefer = prefer;
  let r;
  try {
    r = await fetch(SUPABASE_URL + '/rest/v1/' + tablo + sorguMetni(sorgu), {
      method: yontem, headers: basliklar, body: govde ? JSON.stringify(govde) : undefined
    });
  } catch (e) { throw new Hata('İnternete ulaşılamadı.', 'AG'); }
  if (r.status === 401 && !yenidenDeneme) {
    await oturumYenile();
    return api(yontem, tablo, sorgu, govde, prefer, true);
  }
  if (!r.ok) {
    let t = '';
    try { t = await r.text(); } catch (e) { /* boş */ }
    throw new Hata('Sunucu hatası (' + r.status + '): ' + t.slice(0, 160), 'SUNUCU');
  }
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
async function hepsi(tablo, sorgu) {
  let sonuc = [];
  let bas = 0;
  for (;;) {
    const parca = await api('GET', tablo, Object.assign({ select: '*', limit: '1000', offset: String(bas) }, sorgu || {}));
    sonuc = sonuc.concat(parca || []);
    if (!parca || parca.length < 1000) return sonuc;
    bas += 1000;
  }
}

/* ---------------- kayıt kuyruğu (internet yokken) ---------------- */
let kuyruk = depoOku(KUYRUK_ANAHTAR, []);
let kuyrukCalisiyor = false;
function kuyrukYaz() { depoYaz(KUYRUK_ANAHTAR, kuyruk); }
async function gonder(is) {
  await api('POST', is.tablo, { on_conflict: is.cakisma }, is.satirlar, 'resolution=merge-duplicates,return=minimal');
}
async function kaydet(is) {   // 'tamam' | 'beklemede'
  try { await gonder(is); return 'tamam'; } catch (e) {
    if (e.tur === 'AG') { kuyruk.push(is); kuyrukYaz(); return 'beklemede'; }
    throw e;
  }
}
async function kuyrukBosalt() {
  if (kuyrukCalisiyor || !kuyruk.length) return;
  kuyrukCalisiyor = true;
  let reddedilen = 0;
  try {
    while (kuyruk.length) {
      try { await gonder(kuyruk[0]); } catch (e) {
        if (e.tur === 'AG' || e.tur === 'OTURUM') break;
        reddedilen++;   // sunucu kaydı kabul etmedi: tıkanmasın diye çıkar
      }
      kuyruk.shift(); kuyrukYaz();
    }
  } finally { kuyrukCalisiyor = false; }
  if (reddedilen) bildir(reddedilen + ' kayıt sunucu tarafından kabul edilmedi.', 'h');
}
function kuyrukta(tablo, anahtarFn) {
  return kuyruk.some((is) => is.tablo === tablo && is.satirlar.some(anahtarFn));
}

/* ---------------- uygulama durumu ---------------- */
const simdi = new Date();
const S = {
  sekme: 'puantaj',
  yuklendi: false,
  yukleniyor: false,
  pYil: simdi.getFullYear(), pAy: simdi.getMonth() + 1, plaka: null, secim: [],
  gYil: simdi.getFullYear(), gAy: simdi.getMonth() + 1,
  lYil: simdi.getFullYear(), lAy: simdi.getMonth() + 1, lFiltre: 'Tümü',
  kzYil: simdi.getFullYear(),
  hYil: simdi.getFullYear(), hAy: simdi.getMonth() + 1, hAcik: {}
};
let D = { plakalar: [], firmalar: [], soforler: [], giderler: [], gelirler: [], kz: [], puantaj: {}, bekleyen: 0, plakaBilgi: {}, hakedis: [], hakedisYok: false };

function onbellekYaz() {
  depoYaz(ONBELLEK_ANAHTAR, { plakalar: D.plakalar, firmalar: D.firmalar, soforler: D.soforler, giderler: D.giderler, gelirler: D.gelirler, kz: D.kz, puantaj: D.puantaj, bekleyen: D.bekleyen, plakaBilgi: D.plakaBilgi, hakedis: D.hakedis, hakedisYok: D.hakedisYok });
}
function pAnahtar() { return S.plaka + '|' + yilAy(S.pYil, S.pAy); }

async function puantajYukle() {
  const ya = yilAy(S.pYil, S.pAy);
  const satirlar = await hepsi('puantaj', { yil_ay: 'eq.' + ya });
  const grup = {};
  D.plakalar.forEach((p) => { grup[p] = {}; });
  (satirlar || []).forEach((r) => { (grup[r.plaka] || (grup[r.plaka] = {}))[r.gun] = r; });
  Object.keys(grup).forEach((p) => { D.puantaj[p + '|' + ya] = grup[p]; });
}
async function verileriYukle() {
  if (S.yukleniyor) return;
  S.yukleniyor = true;
  durumCiz();
  try {
    await kuyrukBosalt();
    const sonuc = await Promise.all([
      hepsi('plakalar', { order: 'plaka.asc' }), hepsi('firmalar', { order: 'ad.asc' }), hepsi('soforler', { order: 'ad.asc' }),
      hepsi('giderler', { order: 'tarih.desc' }), hepsi('gelirler', { order: 'tarih.desc' }),
      hepsi('kar_zarar_ozet', { order: 'yil.asc,ay.asc' }),
      api('GET', 'puantaj', { select: 'plaka', kaynak: 'eq.mobil', alindi: 'eq.false', limit: '1000' }),
      hepsi('hakedis', { order: 'yil_ay.asc,firma.asc,plaka.asc' }).then((r) => ({ ok: true, r: r }), (e) => ((e.tur === 'OTURUM' || e.tur === 'AG') ? Promise.reject(e) : { ok: false, r: [] }))
    ]);
    D.plakaBilgi = {}; sonuc[0].forEach((r) => { D.plakaBilgi[r.plaka] = { firma: r.firma || '', sofor: r.sofor || '' }; });
    D.hakedis = sonuc[7].r; D.hakedisYok = !sonuc[7].ok;
    D.plakalar = sonuc[0].map((r) => r.plaka); D.firmalar = sonuc[1].map((r) => r.ad); D.soforler = sonuc[2].map((r) => r.ad);
    D.giderler = sonuc[3]; D.gelirler = sonuc[4]; D.kz = sonuc[5];
    D.bekleyen = sonuc[6].length + D.giderler.filter(bekliyor).length + D.gelirler.filter(bekliyor).length;
    await puantajYukle();
    S.yuklendi = true;
    onbellekYaz();
  } catch (e) {
    if (e.tur === 'OTURUM') { girisGoster(); S.yukleniyor = false; return; }
    if (e.tur === 'AG') bildir('İnternet yok. Son kaydedilen veriler gösteriliyor.', 'u');
    else bildir(e.message, 'h');
  }
  S.yukleniyor = false;
  durumCiz();
  ekranCiz();
}
function bekliyor(r) { return r.kaynak === 'mobil' && r.alindi === false; }


const GUN_UZUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const KAT_RENK = { 'Bakım & Onarım': ['#FCE9D6', '#B4530A', '#EA7C15'], 'Yasal ve Resmi Ödemeler': ['#FBF1CC', '#8A6100', '#F2C14E'], 'Personel & Şoför Giderleri': ['#DCEBF7', '#1F5E8C', '#6BA8D6'] };
const KAT_IKON = {
  'Bakım & Onarım': 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.1-.6-.6-2.1z',
  'Yasal ve Resmi Ödemeler': 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  'Personel & Şoför Giderleri': 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0'
};
const AVATAR = [['#FCE9D6', '#B4530A'], ['#DCEBF7', '#1F5E8C'], ['#E3F4EA', '#14663A'], ['#F3E3F5', '#7A2F86'], ['#FBF1CC', '#8A6100'], ['#E7E5F8', '#4B45A3']];
function katRenk(k) { return KAT_RENK[k] || ['#EFEAE4', '#4A3F37', '#A89B90']; }
function ikonSvg(yol, boyut) {
  return '<svg width="' + (boyut || 22) + '" height="' + (boyut || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + yol + '"/></svg>';
}
function gunBasligi(iso) {
  const p = String(iso).slice(0, 10).split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  return p[2] + ' ' + AYLAR[p[1] - 1] + ' · ' + GUN_UZUN[d.getDay()];
}
function tarihGrupla(liste) {
  const g = {};
  liste.forEach((r) => { const k = String(r.tarih).slice(0, 10); (g[k] = g[k] || []).push(r); });
  return Object.keys(g).sort().reverse().map((k) => [k, g[k]]);
}

/* ---------------- bildirim ---------------- */
function bildir(metin, tur) {
  const alan = document.getElementById('toast-alani');
  const el = document.createElement('div');
  el.className = 'toast ' + (tur || '');
  el.setAttribute('role', 'status');
  el.textContent = metin;
  alan.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, tur === 'h' ? 6000 : 3500);
}

/* ---------------- üst çubuk ---------------- */
const BASLIKLAR = { puantaj: 'Puantaj', gider: 'Gider', gelir: 'Gelir', karzarar: 'Kâr / Zarar' };
function durumCiz() {
  const b = document.getElementById('durum');
  let stil, nokta, metin, donen = false;
  if (S.yukleniyor) { stil = 'background:rgba(255,255,255,.12);color:#E6DCD2'; nokta = '#CDBFB3'; metin = 'Yenileniyor…'; donen = true; }
  else if (kuyruk.length) { stil = 'background:rgba(242,193,78,.18);color:#F6D58A'; nokta = '#F2C14E'; metin = kuyruk.length + ' gönderilmedi'; }
  else if (D.bekleyen) { stil = 'background:rgba(242,193,78,.18);color:#F6D58A'; nokta = '#F2C14E'; metin = D.bekleyen + ' kayıt masaüstü bekliyor'; }
  else { stil = 'background:rgba(61,220,132,.16);color:#8FE0B3'; nokta = '#3DDC84'; metin = 'Güncel'; }
  b.setAttribute('style', stil);
  b.innerHTML = (donen ? '<svg class="donen" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-3-6.7"/></svg>'
    : '<span class="nokta" style="background:' + nokta + '"></span>') + '<span>' + esc(metin) + '</span>';
  const ana = S.sekme === 'hakedis' ? 'puantaj' : S.sekme;
  const alt = document.getElementById('alt-sekme');
  alt.classList.toggle('hidden', ana !== 'puantaj');
  alt.querySelectorAll('button').forEach((x) => { x.classList.toggle('acik', x.dataset.alt === S.sekme); x.setAttribute('aria-selected', x.dataset.alt === S.sekme); });
  document.querySelectorAll('nav button').forEach((n) => n.classList.toggle('aktif', n.dataset.sekme === ana));
}
/* ---------------- ekranlar ---------------- */
function ayCubuguHtml(yil, ay, onceki, sonraki) {
  const sol = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  const sag = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  return '<div class="ay-cubuk"><button type="button" data-act="' + onceki + '" aria-label="Önceki ay">' + sol + '</button>' +
    '<div class="ad">' + AYLAR[ay - 1] + '<small>' + yil + '</small></div>' +
    '<button type="button" data-act="' + sonraki + '" aria-label="Sonraki ay">' + sag + '</button></div>';
}
function bosDurumHtml(ikonYol, baslik, aciklama) {
  return '<div class="bos-durum"><div class="daire"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + ikonYol + '"/></svg></div>' +
    '<div class="b">' + esc(baslik) + '</div><div class="a">' + esc(aciklama) + '</div></div>';
}
function iskeletHtml() {
  return '<div class="iskelet"><div style="height:104px"></div><div style="height:56px"></div><div style="height:240px"></div></div>';
}
function ayDegistir(yil, ay, yon) {
  let a = ay + yon, y = yil;
  if (a < 1) { a = 12; y--; } else if (a > 12) { a = 1; y++; }
  return [y, a];
}

function puantajHtml() {
  if (!D.plakalar.length) return bosDurumHtml('M3 5h18v16H3zM3 10h18', 'Henüz plaka yok', 'Masaüstü programda "Telefonla Senkronize Et" düğmesine bas.');
  const ya = yilAy(S.pYil, S.pAy);
  const gunSayisi = new Date(S.pYil, S.pAy, 0).getDate();
  const ilk = (new Date(S.pYil, S.pAy - 1, 1).getDay() + 6) % 7;
  const bg = new Date();
  const bugunGunu = (bg.getFullYear() === S.pYil && bg.getMonth() + 1 === S.pAy) ? bg.getDate() : 0;
  let hucre = '';
  for (let i = 0; i < ilk; i++) hucre += '<button class="gun bos" type="button" tabindex="-1" aria-hidden="true"></button>';
  for (let d = 1; d <= gunSayisi; d++) {
    let c = 0, kayit = 0;
    D.plakalar.forEach((p) => { const r = (D.puantaj[p + '|' + ya] || {})[d]; if (r) { kayit++; if (r.durum === 'Ç') c++; } });
    const sinif = c ? 'c' : (kayit ? 't' : '');
    const hs = ((ilk + d - 1) % 7) >= 5 ? ' hs' : '';
    hucre += '<button class="gun ' + sinif + hs + (d === bugunGunu ? ' bugun' : '') + '" type="button" data-act="gun" data-n="' + d + '" aria-label="' + d + ' ' + AYLAR[S.pAy - 1] + ', ' + c + ' araç çalıştı">' +
      '<b>' + d + '</b><i class="say">' + (c ? c : '') + '</i></button>';
  }
  return ayCubuguHtml(S.pYil, S.pAy, 'p-onceki', 'p-sonraki') +
    '<div class="kart" style="display:flex;flex-direction:column;gap:12px">' +
    '<div class="takvim">' + GUN_ADLARI.map((g, i) => '<div class="gun-adi' + (i >= 5 ? ' hs' : '') + '">' + g + '</div>').join('') + '</div>' +
    '<div class="takvim">' + hucre + '</div>' +
    '<div class="not"><span><u style="background:#CFEBD9"></u>Gündeki sayı = o gün çalışan araç</span></div></div>' +
    '<div class="ipucu">Bir güne dokun, araçları seç, firmayı seçip hepsini tek seferde kaydet.<br>Aylar arasında sağa-sola kaydırarak da geçebilirsin.</div>' +
    '<div class="ipucu" style="font-size:11px;opacity:.6">Sürüm 5 · pencere ' + window.innerHeight + ' / ekran ' + screen.height + (window.navigator.standalone ? ' · uygulama' : ' · tarayıcı') + '</div>';
}
function hakedisHtml() {
  const ya = yilAy(S.hYil, S.hAy);
  const bar = ayCubuguHtml(S.hYil, S.hAy, 'h-onceki', 'h-sonraki');
  const ikon = 'M3 5h18v16H3zM3 10h18';
  if (D.hakedisYok) return bar + bosDurumHtml(ikon, 'Hakediş henüz hazır değil', "Supabase'te yeni SQL çalıştırılmalı ve masaüstü programı yeniden başlatılmalı.");
  const satirlar = D.hakedis.filter((r) => r.yil_ay === ya);
  if (!satirlar.length) return bar + bosDurumHtml(ikon, 'Bu ay için hakediş yok', 'Masaüstü senkronizasyonundan sonra burada görünür. Son 3 ay gönderilir.');
  const gruplar = {};
  satirlar.forEach((r) => { (gruplar[r.firma] || (gruplar[r.firma] = [])).push(r); });
  let genel = 0;
  const kartlar = Object.keys(gruplar).sort().map((f) => {
    const l = gruplar[f]; const top = l.reduce((a, r) => a + (Number(r.tutar) || 0), 0); genel += top;
    const arac = l.filter((r) => r.plaka !== 'Fatura (manuel)').length;
    const acik = !!S.hAcik[f];
    const detay = acik ? l.map((r) => {
      const manuel = r.plaka === 'Fatura (manuel)';
      const alt = manuel ? 'Elle girilen fatura' : [r.sofor, r.gun != null ? r.gun + ' gün' : null, r.fiyat != null ? tl(r.fiyat) + (r.donem ? ' / ' + String(r.donem).toLowerCase() : '') : null].filter(Boolean).join(' · ');
      return '<div class="arac-s"><div class="o"><b>' + esc(manuel ? 'Manuel fatura' : r.plaka) + '</b><span>' + esc(alt) + '</span></div>' +
        '<div class="t">' + (r.tutar == null ? '—' : tl(r.tutar)) + '</div></div>';
    }).join('') : '';
    return '<div class="kart firma-k"><button class="firma-b" type="button" data-act="h-ac" data-f="' + esc(f) + '" aria-expanded="' + acik + '">' +
      '<div class="o"><b>' + esc(f) + '</b><span>' + arac + ' araç' + (arac !== l.length ? ' + manuel' : '') + '</span></div><div class="t">' + tl(top) + '</div>' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A7D73" stroke-width="2.4" stroke-linecap="round" style="transform:rotate(' + (acik ? 180 : 0) + 'deg)"><path d="M6 9l6 6 6-6"/></svg></button>' + detay + '</div>';
  }).join('');
  return bar + '<div class="hero"><div class="ust-satir"><div class="e">' + AYLAR[S.hAy - 1] + ' ' + S.hYil + ' hakediş toplamı</div></div><div class="buyuk kisalt">' + tl(genel) + '</div></div>' + kartlar +
    '<div class="kart-k" style="font-size:13px;line-height:20px;color:#6B5F57;padding:16px 20px">Hakediş masaüstü programda hesaplanır; burada sadece gösterilir. Firmaya dokununca araç dökümü açılır.</div>';
}
function giderSatirHtml(g) {
  const bek = bekliyor(g);
  const kuyrukluMu = bek && kuyrukta('giderler', (s) => s.id === g.id);
  const r = katRenk(g.ana_baslik);
  return '<div class="satir"><div class="simge" style="background:' + r[0] + ';color:' + r[1] + '">' + ikonSvg(KAT_IKON[g.ana_baslik] || 'M20 12l-8 8-9-9V3h8z') + '</div>' +
    '<div class="orta"><div><div class="baslik-s kisalt">' + esc(g.alt_baslik) + '</div>' +
    '<div class="alt-s kisalt">' + esc((g.plaka || GENEL_PLAKA) + (g.aciklama ? ' · ' + g.aciklama : '')) + '</div></div>' +
    (bek ? '<div class="hap-grup"><span class="hap amber">' + (kuyrukluMu ? 'Gönderilmedi' : 'Masaüstü bekliyor') + '</span></div>' : '') + '</div>' +
    '<div class="sag"><div class="tutar">' + tl(g.tutar) + '</div></div></div>';
}
function giderHtml() {
  const on = yilAy(S.gYil, S.gAy);
  const liste = D.giderler.filter((g) => String(g.tarih).slice(0, 7) === on);
  const toplam = liste.reduce((a, g) => a + Number(g.tutar), 0);
  const kat = {};
  liste.forEach((g) => { kat[g.ana_baslik] = (kat[g.ana_baslik] || 0) + Number(g.tutar); });
  const katSira = Object.keys(kat).sort((a, b) => kat[b] - kat[a]);
  const hero = '<div class="hero"><div class="ust-satir"><div class="e">' + AYLAR[S.gAy - 1] + ' toplam gider</div><span class="hap">' + liste.length + ' kayıt</span></div>' +
    '<div class="buyuk kisalt">' + tl(toplam) + '</div>' +
    (katSira.length ? '<div class="yigin">' + katSira.map((k) => '<i style="width:' + Math.max(2, kat[k] / toplam * 100).toFixed(1) + '%;background:' + katRenk(k)[2] + '"></i>').join('') + '</div>' +
      '<div class="lejant">' + katSira.map((k) => '<div><u style="background:' + katRenk(k)[2] + '"></u>' + esc(k) + '<span>' + tlKisa(kat[k]) + '</span></div>').join('') + '</div>' : '') + '</div>';
  const gruplar = tarihGrupla(liste).map(([k, rows]) =>
    '<div class="grup-b"><span>' + gunBasligi(k) + '</span><span>' + tlKisa(rows.reduce((a, g) => a + Number(g.tutar), 0)) + '</span></div>' +
    '<div class="liste">' + rows.map(giderSatirHtml).join('') + '</div>').join('');
  return ayCubuguHtml(S.gYil, S.gAy, 'g-onceki', 'g-sonraki') + hero +
    (liste.length ? gruplar : bosDurumHtml('M7 7l10 10M17 9v8H9', 'Bu ay gider yok', 'Yeni bir gider eklemek için aşağıdaki düğmeye dokun.'));
}
function gelirSatirHtml(g) {
  const h = kdvHesapla(Number(g.matrah), Number(g.kdv_orani), g.tevkifat);
  const bek = bekliyor(g);
  const kuyrukluMu = bek && kuyrukta('gelirler', (s) => s.id === g.id);
  const tahsilSinif = g.tahsil_durumu === 'Bekliyor' ? 'amber' : 'yesil';
  const ad = String(g.firma || '?');
  let hash = 0; for (let i = 0; i < ad.length; i++) hash = (hash * 31 + ad.charCodeAt(i)) >>> 0;
  const av = AVATAR[hash % AVATAR.length];
  return '<div class="satir"><div class="simge" style="background:' + av[0] + ';color:' + av[1] + '">' + esc(ad.trim().charAt(0).toLocaleUpperCase('tr-TR')) + '</div>' +
    '<div class="orta"><div><div class="baslik-s kisalt">' + esc(g.firma) + '</div>' +
    '<div class="alt-s kisalt">' + esc('Matrah ' + tl(g.matrah) + ' · KDV %' + Number(g.kdv_orani) + (g.tevkifat !== 'Yok' ? ' · Tev. ' + g.tevkifat : '')) + '</div></div>' +
    '<div class="hap-grup"><span class="hap ' + tahsilSinif + '">' + esc(g.tahsil_durumu) + '</span>' +
    (bek ? '<span class="hap amber">' + (kuyrukluMu ? 'Gönderilmedi' : 'Masaüstü bekliyor') + '</span>' : '') + '</div></div>' +
    '<div class="sag"><div class="tutar">' + tl(h.toplam) + '</div><div class="etiket">tahsil edilecek</div></div></div>';
}
function gelirHtml() {
  const on = yilAy(S.lYil, S.lAy);
  const ay = D.gelirler.filter((g) => String(g.tarih).slice(0, 7) === on);
  const liste = ay.filter((g) => S.lFiltre === 'Tümü' || g.tahsil_durumu === S.lFiltre).sort((a, b) => String(b.tarih).localeCompare(String(a.tarih)));
  const kesilen = ay.reduce((a, g) => a + Number(g.matrah), 0);
  const topla = (rows) => rows.reduce((a, g) => a + kdvHesapla(Number(g.matrah), Number(g.kdv_orani), g.tevkifat).toplam, 0);
  const bekleyen = topla(D.gelirler.filter((g) => g.tahsil_durumu === 'Bekliyor'));
  const ayToplam = topla(ay), ayTahsil = topla(ay.filter((g) => g.tahsil_durumu === 'Tahsil Edildi'));
  const oran = ayToplam > 0 ? Math.round(ayTahsil / ayToplam * 100) : 0;
  const filtre = ['Tümü', 'Bekliyor', 'Tahsil Edildi'].map((f) => '<button class="cip' + (S.lFiltre === f ? ' acik' : '') + '" type="button" data-act="l-filtre" data-f="' + f + '">' + f + '</button>').join('');
  const hero = '<div class="hero"><div class="ust-satir"><div class="e">' + AYLAR[S.lAy - 1] + ' kesilen fatura (KDV hariç)</div><span class="hap">' + ay.length + ' fatura</span></div>' +
    '<div class="buyuk kisalt">' + tl(kesilen) + '</div>' +
    '<div><div style="display:flex;justify-content:space-between;font-size:12px;color:#CDBFB3;margin-bottom:8px"><span>Bu ay tahsil oranı</span><span>%' + oran + '</span></div><div class="ilerleme"><div style="width:' + oran + '%"></div></div></div>' +
    '<div class="ince"></div><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div class="e">Toplam bekleyen tahsilat</div><b style="font-size:16px;color:#F6D58A" class="kisalt">' + tl(bekleyen) + '</b></div></div>';
  return ayCubuguHtml(S.lYil, S.lAy, 'l-onceki', 'l-sonraki') + hero +
    '<div class="yatay">' + filtre + '</div>' +
    (liste.length ? '<div class="liste">' + liste.map(gelirSatirHtml).join('') + '</div>'
      : bosDurumHtml('M17 17L7 7M7 15V7h8', 'Bu ayda gelir yok', 'Kestiğin faturayı eklemek için aşağıdaki düğmeye dokun.'));
}
function karZararHtml() {
  const yillar = D.kz.map((r) => r.yil).filter((v, i, a) => a.indexOf(v) === i);
  if (!D.kz.length) return bosDurumHtml('M5 20V10M12 20V4M19 20v-7', 'Henüz özet yok', 'Masaüstü programda "Telefonla Senkronize Et" düğmesine bas; kâr/zarar özeti buraya gelir.');
  if (yillar.indexOf(S.kzYil) < 0) S.kzYil = yillar[yillar.length - 1];
  const satirlar = D.kz.filter((r) => r.yil === S.kzYil);
  const gel = satirlar.reduce((a, r) => a + Number(r.gelir), 0);
  const gid = satirlar.reduce((a, r) => a + Number(r.gider_kdv_haric), 0);
  const net = gel - gid;
  const kamyon = Number(satirlar[satirlar.length - 1].kamyon_sayisi) || 10;
  const netler = satirlar.map((r) => Number(r.gelir) - Number(r.gider_kdv_haric));
  const enBuyuk = Math.max(1, ...netler.map((n) => Math.abs(n)));
  const guncel = D.kz.reduce((a, r) => (r.guncelleme > a ? r.guncelleme : a), '');
  const guncelMetin = guncel ? new Date(guncel).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const yilSecici = yillar.length > 1 ? '<div class="yatay">' + yillar.map((y) => '<button class="cip' + (y === S.kzYil ? ' acik' : '') + '" type="button" data-act="kz-yil" data-y="' + y + '">' + y + '</button>').join('') + '</div>' : '';
  // 12 aylık sütun grafiği
  const poz = Math.max(0, ...netler), neg = Math.max(0, ...netler.map((n) => -n));
  const aralik = (poz + neg) || 1, yuk = 92, sifirY = 8 + poz / aralik * yuk;
  const netAy = {}; satirlar.forEach((r, i) => { netAy[r.ay] = netler[i]; });
  let sutun = '';
  for (let a = 1; a <= 12; a++) {
    const x = (a - 1) * 28 + 5, n = netAy[a];
    if (n !== undefined) {
      const h = Math.max(3, Math.abs(n) / aralik * yuk);
      sutun += '<rect x="' + x + '" y="' + (n >= 0 ? sifirY - h : sifirY) + '" width="18" height="' + h.toFixed(1) + '" rx="5" fill="' + (n < 0 ? '#C0392B' : '#2F9E62') + '"/>';
    } else sutun += '<rect x="' + x + '" y="' + (sifirY - 1.5) + '" width="18" height="3" rx="1.5" fill="#E3DCD4"/>';
    sutun += '<text x="' + (x + 9) + '" y="124" text-anchor="middle">' + AYLAR[a - 1].charAt(0) + '</text>';
  }
  const grafik = '<svg class="grafik" viewBox="0 0 336 130" role="img" aria-label="Aylık net kâr zarar grafiği">' +
    '<line x1="0" y1="' + sifirY + '" x2="336" y2="' + sifirY + '" stroke="#DDD3C8" stroke-dasharray="3 4"/>' + sutun + '</svg>';
  const aylik = satirlar.map((r) => {
    const n = Number(r.gelir) - Number(r.gider_kdv_haric);
    return '<div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px">' +
      '<div style="font-size:14px;font-weight:700">' + AYLAR[r.ay - 1] + '</div>' +
      '<div style="font-size:15px;font-weight:800;white-space:nowrap;color:' + (n < 0 ? '#9B2C1F' : '#14663A') + '">' + (n >= 0 ? '+' : '') + tlKisa(n) + '</div></div>' +
      '<div class="cubuk"><div style="width:' + Math.max(4, Math.round(Math.abs(n) / enBuyuk * 100)) + '%;background:' + (n < 0 ? '#C0392B' : '#2F9E62') + '"></div></div>' +
      '<div class="etiket kisalt">Gelir ' + tlKisa(r.gelir) + ' · Gider ' + tlKisa(r.gider_kdv_haric) + '</div></div>';
  }).join('');
  return yilSecici +
    '<div class="hero"><div class="ust-satir"><div class="e">' + S.kzYil + ' net kâr / zarar</div>' +
    '<span class="hap ' + (net < 0 ? 'kirmizi' : 'yesil') + '">' + (net < 0 ? 'Zarar' : 'Kâr') + '</span></div>' +
    '<div class="buyuk kisalt">' + tl(net) + '</div>' +
    '<div class="hero-izgara"><div style="min-width:0"><div class="e">Gelir (KDV hariç)</div><b class="kisalt">' + tlKisa(gel) + '</b></div>' +
    '<div style="min-width:0"><div class="e">Gider (KDV hariç)</div><b class="kisalt">' + tlKisa(gid) + '</b></div></div>' +
    '<div class="ince"></div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div class="e">Kamyon başı net (' + kamyon + ' kamyon)</div><b style="font-size:17px;white-space:nowrap">' + tlKisa(net / kamyon) + '</b></div></div>' +
    '<div class="kart" style="display:flex;flex-direction:column;gap:12px"><div style="font-size:16px;font-weight:800">Aylık görünüm</div>' + grafik + '</div>' +
    '<div class="kart" style="display:flex;flex-direction:column;gap:16px"><div style="font-size:16px;font-weight:800">Aylık net</div>' + aylik + '</div>' +
    '<div class="kart-k" style="font-size:13px;line-height:20px;color:#6B5F57;padding:16px 20px">Bu ekran sadece gösterim içindir. Rakamlar masaüstü programda hesaplanır ve senkronizasyondan sonra buraya gelir.' +
    (guncelMetin ? ' Son güncelleme: ' + esc(guncelMetin) + '.' : '') + ' Telefondan eklediğin kayıtlar, masaüstünde senkronize edilince kâr/zarara yansır.</div>';
}
function aksiyonCiz() {
  const alan = document.getElementById('aksiyon-alani');
  let h = '';
  if (false) {
  } else if (S.sekme === 'gider' || S.sekme === 'gelir') {
    h = '<button class="fab" type="button" data-act="' + (S.sekme === 'gider' ? 'gider-panel' : 'gelir-panel') + '">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' +
      '<span>' + (S.sekme === 'gider' ? 'Yeni gider' : 'Yeni gelir') + '</span></button>';
  }
  alan.innerHTML = h;
}

function ekranCiz() {
  const k = document.getElementById('icerik');
  durumCiz();
  if (!S.yuklendi) { k.innerHTML = iskeletHtml(); aksiyonCiz(); return; }
  const f = { puantaj: puantajHtml, hakedis: hakedisHtml, gider: giderHtml, gelir: gelirHtml, karzarar: karZararHtml }[S.sekme];
  k.innerHTML = f();
  aksiyonCiz();
}

/* ---------------- tıklamalar (ekran içi) ---------------- */
async function tikla(e) {
  const hedef = e.target.closest('[data-act]');
  if (!hedef) return;
  const a = hedef.dataset.act;
  if (a === 'gun') { gunPaneli(Number(hedef.dataset.n));
  } else if (a === 'p-onceki' || a === 'p-sonraki') {
    const r = ayDegistir(S.pYil, S.pAy, a === 'p-onceki' ? -1 : 1); S.pYil = r[0]; S.pAy = r[1]; ekranCiz(); await puantajYuklePasif();
  } else if (a === 'h-onceki' || a === 'h-sonraki') { const r = ayDegistir(S.hYil, S.hAy, a === 'h-onceki' ? -1 : 1); S.hYil = r[0]; S.hAy = r[1]; ekranCiz();
  } else if (a === 'h-ac') { S.hAcik[hedef.dataset.f] = !S.hAcik[hedef.dataset.f]; ekranCiz();
  } else if (a === 'g-onceki' || a === 'g-sonraki') { const r = ayDegistir(S.gYil, S.gAy, a === 'g-onceki' ? -1 : 1); S.gYil = r[0]; S.gAy = r[1]; ekranCiz(); }
  else if (a === 'l-onceki' || a === 'l-sonraki') { const r = ayDegistir(S.lYil, S.lAy, a === 'l-onceki' ? -1 : 1); S.lYil = r[0]; S.lAy = r[1]; ekranCiz(); }
  else if (a === 'l-filtre') { S.lFiltre = hedef.dataset.f; ekranCiz(); }
  else if (a === 'kz-yil') { S.kzYil = Number(hedef.dataset.y); ekranCiz(); }
  else if (a === 'gider-panel') giderPaneli();
  else if (a === 'gelir-panel') gelirPaneli();
}
async function puantajYuklePasif() {
  try { await puantajYukle(); onbellekYaz(); } catch (e) {
    if (e.tur === 'OTURUM') { girisGoster(); return; }
    if (e.tur !== 'AG') bildir(e.message, 'h');
  }
  ekranCiz();
}

/* ---------------- alttan açılan paneller ---------------- */
let panelKapat = null;
function panelAc(baslik, govdeHtml, kaydetMetni, olusturFn, kaydetFn) {
  const alan = document.getElementById('panel-alani');
  alan.innerHTML = '<div class="perde" id="perde"><div class="panel" role="dialog" aria-label="' + esc(baslik) + '">' +
    '<div class="tutamac"><div></div></div>' +
    '<div class="panel-ust"><h2>' + esc(baslik) + '</h2><button class="ikon-btn" type="button" id="p-kapat" aria-label="Kapat"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    '<div class="panel-govde" id="p-govde">' + govdeHtml + '</div>' +
    '<div class="panel-alt"><button class="ana-btn" type="button" id="p-kaydet">' + esc(kaydetMetni) + '</button></div></div></div>';
  const kapat = () => { alan.innerHTML = ''; panelKapat = null; };
  panelKapat = kapat;
  document.getElementById('p-kapat').addEventListener('click', kapat);
  document.getElementById('perde').addEventListener('click', (ev) => { if (ev.target.id === 'perde') kapat(); });
  const btn = document.getElementById('p-kaydet');
  olusturFn(document.getElementById('p-govde'));
  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true; btn.textContent = 'Kaydediliyor…';
    let basarili = false;
    try { basarili = await kaydetFn(); } catch (e) {
      if (e.tur === 'OTURUM') { kapat(); girisGoster(); return; }
      bildir(e.message, 'h');
    }
    if (basarili) kapat(); else { btn.disabled = false; btn.textContent = kaydetMetni; }
  });
}
function secenekler(liste, secili) {
  return liste.map((v) => '<option value="' + esc(v) + '"' + (v === secili ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
}
function segHtml(kimlik, secenekListe, secili, kolon) {
  return '<div class="seg" id="' + kimlik + '" style="grid-template-columns:repeat(' + kolon + ',minmax(0,1fr))">' +
    secenekListe.map((o) => '<button type="button" data-v="' + esc(o[0]) + '" class="' + (o[0] === secili ? 'acik' : '') + '">' + esc(o[1]) + '</button>').join('') + '</div>';
}
function segBagla(kok, kimlik, degisti) {
  const seg = kok.querySelector('#' + kimlik);
  seg.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    seg.querySelectorAll('button').forEach((x) => x.classList.toggle('acik', x === b));
    degisti(b.dataset.v);
  });
}
function hataGoster(kok, alanKimlik, mesaj) {
  const el = kok.querySelector('#' + alanKimlik);
  if (!el) return;
  el.classList.toggle('hata', !!mesaj);
  let m = kok.querySelector('#' + alanKimlik + '-hata');
  if (m) m.remove();
  if (mesaj) {
    m = document.createElement('div'); m.className = 'hata-m'; m.id = alanKimlik + '-hata'; m.setAttribute('role', 'alert'); m.textContent = mesaj;
    el.parentNode.appendChild(m);
  }
}

function gunPaneli(gun) {
  const ya = yilAy(S.pYil, S.pAy);
  const sonGun = new Date(S.pYil, S.pAy, 0).getDate();
  const form = { durum: 'Ç', firma: '', firmaElle: false, bitis: gun, secili: {} };
  const dur = (p, g) => { const r = (D.puantaj[p + '|' + ya] || {})[g]; return r ? r.durum : ''; };
  const rozet = (d) => d === 'Ç' ? '<span class="hap yesil">Ç</span>' : d === 'T' ? '<span class="hap amber">T</span>' : d === '0' ? '<span class="hap">0</span>' : '';
  const satirHtml = (p) => {
    const b = D.plakaBilgi[p] || {};
    return '<label class="pl-satir"><input type="checkbox" data-p="' + esc(p) + '"><div class="o"><b>' + esc(p) + '</b><span>' + esc([b.sofor, b.firma].filter(Boolean).join(' · ') || 'şoför/firma bilgisi yok') + '</span></div>' + rozet(dur(p, gun)) + '</label>';
  };
  const bitisSecenek = []; for (let g = gun; g <= sonGun; g++) bitisSecenek.push('<option value="' + g + '">' + g + ' ' + AYLAR[S.pAy - 1] + '</option>');
  const html = '<div class="alan"><div class="l">Durum</div>' + segHtml('p-durum', [['Ç', 'Çalıştı'], ['T', 'Tatil'], ['0', '0'], ['-', 'Sil']], 'Ç', 4) + '</div>' +
    '<div id="p-cal" class="alan"><label for="p-firma">Firma</label><select id="p-firma"><option value="">Seçiniz</option>' + secenekler(D.firmalar, '') + '</select></div>' +
    '<div class="alan"><label for="p-bitis">Bitiş günü (birden çok gün için)</label><select id="p-bitis">' + bitisSecenek.join('') + '</select></div>' +
    '<div class="alan" id="p-sayalan"><div class="l"><span id="p-say">0 araç seçili</span></div>' +
    '<div class="hizli"><button type="button" data-h="hepsi">Tümü</button><button type="button" data-h="dun">Dünkü çalışanlar</button><button type="button" data-h="yok">Temizle</button></div>' +
    '<div id="p-liste">' + D.plakalar.map(satirHtml).join('') + '</div></div>';
  panelAc(gun + ' ' + AYLAR[S.pAy - 1] + ' ' + S.pYil, html, 'Kaydet', (kok) => {
    const sec = () => Object.keys(form.secili).filter((p) => form.secili[p]);
    const guncelle = () => {
      kok.querySelector('#p-say').textContent = sec().length + ' araç seçili';
      kok.querySelectorAll('#p-liste input').forEach((i) => { i.checked = !!form.secili[i.dataset.p]; });
      if (!form.firmaElle && form.durum === 'Ç') {
        const say = {}; sec().forEach((p) => { const f = (D.plakaBilgi[p] || {}).firma; if (f) say[f] = (say[f] || 0) + 1; });
        const en = Object.keys(say).sort((a, b) => say[b] - say[a])[0] || '';
        if (D.firmalar.indexOf(en) >= 0) form.firma = en;
        kok.querySelector('#p-firma').value = form.firma;
      }
    };
    segBagla(kok, 'p-durum', (v) => { form.durum = v; kok.querySelector('#p-cal').classList.toggle('hidden', v !== 'Ç'); });
    kok.querySelector('#p-firma').addEventListener('change', (ev) => { form.firma = ev.target.value; form.firmaElle = true; hataGoster(kok, 'p-firma', ''); });
    kok.querySelector('#p-bitis').addEventListener('change', (ev) => { form.bitis = Number(ev.target.value); });
    kok.querySelector('#p-liste').addEventListener('change', (ev) => { const i = ev.target.closest('input'); if (i) { form.secili[i.dataset.p] = i.checked; hataGoster(kok, 'p-sayalan', ''); guncelle(); } });
    kok.querySelector('.hizli').addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      form.secili = {};
      if (b.dataset.h === 'hepsi') D.plakalar.forEach((p) => { form.secili[p] = true; });
      if (b.dataset.h === 'dun') {
        if (gun === 1) bildir('Ayın ilk gününde önceki gün bu ekranda yok.', 'u');
        else D.plakalar.forEach((p) => { if (dur(p, gun - 1) === 'Ç') form.secili[p] = true; });
      }
      guncelle();
    });
  }, async () => {
    const kok = document.getElementById('p-govde');
    const plakalar = Object.keys(form.secili).filter((p) => form.secili[p]);
    if (!plakalar.length) { hataGoster(kok, 'p-sayalan', 'En az bir araç seç.'); return false; }
    if (form.durum === 'Ç' && !form.firma) { hataGoster(kok, 'p-firma', 'Çalıştı için firma seçmelisin.'); return false; }
    const satirlar = [];
    for (let g = gun; g <= Math.max(gun, form.bitis); g++) plakalar.forEach((p) => {
      satirlar.push({ plaka: p, yil_ay: ya, gun: g, durum: form.durum,
        firma: form.durum === 'Ç' ? form.firma : null, sofor: form.durum === 'Ç' && (D.plakaBilgi[p] || {}).sofor ? D.plakaBilgi[p].sofor : null,
        kaynak: 'mobil', alindi: false });
    });
    const sonuc = await kaydet({ tablo: 'puantaj', satirlar: satirlar, cakisma: 'plaka,yil_ay,gun' });
    satirlar.forEach((r) => {
      const harita = D.puantaj[r.plaka + '|' + ya] || (D.puantaj[r.plaka + '|' + ya] = {});
      if (r.durum === '-') delete harita[r.gun]; else harita[r.gun] = r;
    });
    D.bekleyen += 1;
    onbellekYaz(); ekranCiz();
    bildir(sonuc === 'tamam' ? plakalar.length + ' araç kaydedildi.' : 'İnternet yok; kayıt cihazda bekliyor, bağlantı gelince gönderilecek.', sonuc === 'tamam' ? '' : 'u');
    return true;
  });
}

function giderPaneli() {
  const varsayilanAna = Object.keys(GIDER_YAPI)[0];
  const form = { ana: varsayilanAna, alt: GIDER_YAPI[varsayilanAna][0] };
  const plakalar = [GENEL_PLAKA].concat(D.plakalar);
  const html =
    '<div class="alan"><label for="g-tutar">Tutar (TL)</label><input id="g-tutar" type="text" inputmode="decimal" placeholder="0,00" autocomplete="off"></div>' +
    '<div class="izgara2" style="gap:16px"><div class="alan"><label for="g-tarih">Tarih</label><input id="g-tarih" type="date" value="' + bugunIso() + '"></div>' +
    '<div class="alan"><label for="g-plaka">Plaka</label><select id="g-plaka">' + secenekler(plakalar, S.plaka || GENEL_PLAKA) + '</select></div></div>' +
    '<div class="alan"><label for="g-ana">Ana başlık</label><select id="g-ana">' + secenekler(Object.keys(GIDER_YAPI), form.ana) + '</select></div>' +
    '<div class="alan"><label for="g-alt">Alt başlık</label><select id="g-alt">' + secenekler(GIDER_YAPI[form.ana], form.alt) + '</select></div>' +
    '<div class="alan"><label for="g-acik">Açıklama (isteğe bağlı)</label><input id="g-acik" type="text" maxlength="80" placeholder="Örn. ön lastik değişimi" autocomplete="off"></div>';
  panelAc('Yeni gider', html, 'Kaydet', (kok) => {
    kok.querySelector('#g-ana').addEventListener('change', (ev) => {
      form.ana = ev.target.value; form.alt = GIDER_YAPI[form.ana][0];
      kok.querySelector('#g-alt').innerHTML = secenekler(GIDER_YAPI[form.ana], form.alt);
    });
    kok.querySelector('#g-alt').addEventListener('change', (ev) => { form.alt = ev.target.value; });
    kok.querySelector('#g-tutar').addEventListener('input', () => hataGoster(kok, 'g-tutar', ''));
  }, async () => {
    const kok = document.getElementById('p-govde');
    const tutar = sayiOku(kok.querySelector('#g-tutar').value);
    const tarih = kok.querySelector('#g-tarih').value;
    if (!(tutar > 0)) { hataGoster(kok, 'g-tutar', 'Tutarı 0’dan büyük bir sayı olarak gir.'); return false; }
    if (!tarih) { hataGoster(kok, 'g-tarih', 'Tarihi seç.'); return false; }
    const plaka = kok.querySelector('#g-plaka').value;
    const satir = {
      id: yeniKimlik(), plaka: plaka, ana_baslik: form.ana, alt_baslik: form.alt,
      aciklama: kok.querySelector('#g-acik').value.trim() || null, tutar: Math.round(tutar * 100) / 100, tarih: tarih,
      kaynak: 'mobil', alindi: false
    };
    const sonuc = await kaydet({ tablo: 'giderler', satirlar: [satir], cakisma: 'id' });
    D.giderler.unshift(satir); D.bekleyen += 1;
    const p = tarih.split('-'); S.gYil = Number(p[0]); S.gAy = Number(p[1]);
    onbellekYaz(); ekranCiz();
    bildir(sonuc === 'tamam' ? 'Gider kaydedildi.' : 'İnternet yok; kayıt cihazda bekliyor, bağlantı gelince gönderilecek.', sonuc === 'tamam' ? '' : 'u');
    return true;
  });
}

function gelirPaneli() {
  const form = { kdv: 20, tahsil: 'Bekliyor' };
  const html =
    '<div class="alan"><label for="l-firma">Firma</label><select id="l-firma">' + secenekler(D.firmalar, D.firmalar[0]) + '</select></div>' +
    '<div class="alan"><label for="l-matrah">Matrah, KDV hariç (TL)</label><input id="l-matrah" type="text" inputmode="decimal" placeholder="0,00" autocomplete="off"></div>' +
    '<div class="izgara2" style="gap:16px"><div class="alan"><label for="l-tarih">Fatura tarihi</label><input id="l-tarih" type="date" value="' + bugunIso() + '"></div>' +
    '<div class="alan"><label for="l-tevk">Tevkifat</label><select id="l-tevk">' + secenekler(TEVKIFAT, 'Yok') + '</select></div></div>' +
    '<div class="alan"><div class="l">KDV oranı</div>' + segHtml('l-kdv', [['0', '%0'], ['10', '%10'], ['20', '%20']], '20', 3) + '</div>' +
    '<div class="alan"><div class="l">Tahsilat</div>' + segHtml('l-tahsil', [['Bekliyor', 'Bekliyor'], ['Tahsil Edildi', 'Tahsil Edildi']], 'Bekliyor', 2) + '</div>' +
    '<div class="ozet"><div><span>KDV</span><b id="o-kdv">0,00 TL</b></div><div><span>Tevkifat</span><b id="o-tevk">0,00 TL</b></div><hr><div class="top"><span>Tahsil edilecek</span><span id="o-top">0,00 TL</span></div></div>';
  panelAc('Yeni gelir', html, 'Kaydet', (kok) => {
    const hesapla = () => {
      const m = sayiOku(kok.querySelector('#l-matrah').value) || 0;
      const h = kdvHesapla(m > 0 ? m : 0, form.kdv, kok.querySelector('#l-tevk').value);
      kok.querySelector('#o-kdv').textContent = tl(h.kdv);
      kok.querySelector('#o-tevk').textContent = tl(h.tevkifat);
      kok.querySelector('#o-top').textContent = tl(h.toplam);
    };
    kok.querySelector('#l-matrah').addEventListener('input', () => { hataGoster(kok, 'l-matrah', ''); hesapla(); });
    kok.querySelector('#l-tevk').addEventListener('change', hesapla);
    segBagla(kok, 'l-kdv', (v) => { form.kdv = Number(v); hesapla(); });
    segBagla(kok, 'l-tahsil', (v) => { form.tahsil = v; });
  }, async () => {
    const kok = document.getElementById('p-govde');
    const matrah = sayiOku(kok.querySelector('#l-matrah').value);
    const tarih = kok.querySelector('#l-tarih').value;
    const firma = kok.querySelector('#l-firma').value;
    if (!firma) { hataGoster(kok, 'l-firma', 'Firma seç.'); return false; }
    if (!(matrah > 0)) { hataGoster(kok, 'l-matrah', 'Matrahı 0’dan büyük bir sayı olarak gir.'); return false; }
    if (!tarih) { hataGoster(kok, 'l-tarih', 'Tarihi seç.'); return false; }
    const satir = {
      id: yeniKimlik(), firma: firma, matrah: Math.round(matrah * 100) / 100, tarih: tarih, donem: tarih.slice(0, 7),
      kdv_orani: form.kdv, tevkifat: kok.querySelector('#l-tevk').value, tahsil_durumu: form.tahsil,
      kaynak: 'mobil', alindi: false
    };
    const sonuc = await kaydet({ tablo: 'gelirler', satirlar: [satir], cakisma: 'id' });
    D.gelirler.unshift(satir); D.bekleyen += 1;
    const p = tarih.split('-'); S.lYil = Number(p[0]); S.lAy = Number(p[1]); S.lFiltre = 'Tümü';
    onbellekYaz(); ekranCiz();
    bildir(sonuc === 'tamam' ? 'Gelir kaydedildi.' : 'İnternet yok; kayıt cihazda bekliyor, bağlantı gelince gönderilecek.', sonuc === 'tamam' ? '' : 'u');
    return true;
  });
}

/* ---------------- giriş ekranı ve başlangıç ---------------- */
function girisGoster() {
  document.getElementById('uygulama').classList.add('hidden');
  document.getElementById('giris').classList.remove('hidden');
}
function uygulamaGoster() {
  document.getElementById('giris').classList.add('hidden');
  document.getElementById('uygulama').classList.remove('hidden');
}
function baslat() {
  const onb = depoOku(ONBELLEK_ANAHTAR, null);
  if (onb) {
    D = Object.assign(D, onb);
    if (D.plakalar.length) { S.yuklendi = true; }
  }
  uygulamaGoster();
  ekranCiz();
  verileriYukle();
}

document.getElementById('icerik').addEventListener('click', tikla);
document.getElementById('aksiyon-alani').addEventListener('click', tikla);
document.getElementById('durum').addEventListener('click', () => { if (!S.yukleniyor) verileriYukle(); });
function gecisOynat() {
  const k = document.getElementById('icerik');
  k.classList.remove('gecis'); void k.offsetWidth; k.classList.add('gecis');
  clearTimeout(gecisOynat.z); gecisOynat.z = setTimeout(() => k.classList.remove('gecis'), 600);
}
document.getElementById('alt-sekme').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b || S.sekme === b.dataset.alt) return;
  S.sekme = b.dataset.alt; ekranCiz(); document.getElementById('icerik').scrollTop = 0; gecisOynat();
});
document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => {
  if (S.sekme === b.dataset.sekme) { document.getElementById('icerik').scrollTo({ top: 0, behavior: 'smooth' }); return; }
  S.sekme = b.dataset.sekme; ekranCiz();
  document.getElementById('icerik').scrollTop = 0;
  gecisOynat();
}));

/* aşağı çekerek yenile + sağa/sola kaydırarak ay değiştir */
(function dokunmaHareketleri() {
  const k = document.getElementById('icerik'), ptr = document.getElementById('ptr');
  let x0 = 0, y0 = 0, sure = false, yatayBolge = false, cekme = 0, kaydir = false;
  const ptrYerle = () => { ptr.style.top = (document.querySelector('.ust').offsetHeight + (document.getElementById('alt-sekme').classList.contains('hidden') ? 0 : 58) + 10) + 'px'; };
  k.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; cekme = 0; kaydir = false;
    yatayBolge = !!e.target.closest('.yatay');
    sure = k.scrollTop <= 0;
    ptrYerle();
  }, { passive: true });
  k.addEventListener('touchmove', (e) => {
    const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
    if (sure && dy > 0 && Math.abs(dy) > Math.abs(dx) && k.scrollTop <= 0 && !S.yukleniyor) {
      cekme = Math.min(dy, 120) * 0.6;
      ptr.style.opacity = Math.min(1, cekme / 50);
      ptr.style.transform = 'translateY(' + cekme + 'px)';
      ptr.querySelector('svg').style.transform = 'rotate(' + (cekme * 5) + 'deg)';
    } else if (!yatayBolge && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) { kaydir = dx < 0 ? 'sonraki' : 'onceki'; }
  }, { passive: true });
  k.addEventListener('touchend', () => {
    if (cekme >= 45 && !S.yukleniyor) {
      ptr.classList.add('don'); ptr.style.transform = 'translateY(40px)';
      Promise.resolve(verileriYukle()).finally(() => setTimeout(() => { ptr.classList.remove('don'); ptr.style.opacity = 0; ptr.style.transform = ''; }, 300));
    } else { ptr.style.opacity = 0; ptr.style.transform = ''; }
    if (kaydir) { const b = k.querySelector('[data-act$="' + kaydir + '"]'); if (b) b.click(); }
    cekme = 0; kaydir = false;
  }, { passive: true });
})();
document.getElementById('cikis').addEventListener('click', () => {
  if (kuyruk.length && !confirm('Gönderilmemiş ' + kuyruk.length + ' kayıt var. Çıkarsan bu kayıtlar kaybolur. Yine de çıkılsın mı?')) return;
  oturum = null; depoSil(OTURUM_ANAHTAR); depoSil(ONBELLEK_ANAHTAR); depoSil(KUYRUK_ANAHTAR);
  kuyruk = []; D = { plakalar: [], firmalar: [], soforler: [], giderler: [], gelirler: [], kz: [], puantaj: {}, bekleyen: 0, plakaBilgi: {}, hakedis: [], hakedisYok: false };
  S.yuklendi = false;
  girisGoster();
});
document.getElementById('giris-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = document.getElementById('g-btn');
  const hata = document.getElementById('g-hata');
  hata.classList.add('hidden');
  btn.disabled = true; btn.textContent = 'Giriş yapılıyor…';
  try {
    await girisYap(document.getElementById('g-eposta').value.trim(), document.getElementById('g-sifre').value);
    document.getElementById('g-sifre').value = '';
    baslat();
  } catch (e) {
    hata.textContent = e.message; hata.classList.remove('hidden');
  }
  btn.disabled = false; btn.textContent = 'Giriş yap';
});
window.addEventListener('online', () => { kuyrukBosalt().then(() => { durumCiz(); ekranCiz(); }); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && oturum && S.yuklendi && !S.yukleniyor) verileriYukle(); });

if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').catch(() => { /* çevrimdışı önbellek olmadan da çalışır */ }); }
if (oturum) baslat(); else girisGoster();
