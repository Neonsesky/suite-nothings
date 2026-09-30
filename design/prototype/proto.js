/*
 * Suite Nothings prototype — data, icon sprite, mark, and per-page behaviour.
 * Vanilla JS, no build step. Loaded by index.html, stay.html and map.html.
 */
(function () {
  'use strict';

  /* ---------------- Icon sprite (paths copied from src/components/icons/index.tsx) ---------------- */
  var ICON_SYMBOLS = {
    stays: '<g transform="rotate(-20 12 13)"><path d="M9.1 9.1a3.6 3.6 0 1 1 5.8 0"/><rect x="7.5" y="8.5" width="9" height="13.5" rx="4.5"/><circle cx="12" cy="11.6" r="1"/><path d="M10 16.8h4"/></g>',
    map: '<path d="M9 4.5 3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8z"/><path d="M9 4.5v12.7M15 6.8v12.7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    journey: '<path d="M5 19.5c3.5-.4 3.2-4.7 6.8-5.5 2.6-.6 5.2.6 6.4-2.4" stroke-dasharray="2.2 2.6"/><circle cx="4.5" cy="19.5" r="1.5"/><path d="M18.5 2.8a3 3 0 0 1 3 3c0 2.2-3 4.9-3 4.9s-3-2.7-3-4.9a3 3 0 0 1 3-3z"/>',
    us: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.5-3.4 2.6-5.3 5.5-5.3s5 1.9 5.5 5.3"/><circle cx="16.5" cy="9.2" r="2.6"/><path d="M16.2 14.3c2.5 0 4 1.6 4.4 4.7"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m19.5 19.5-4.2-4.2"/>',
    close: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
    back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    chevron: '<path d="m9.5 6 6 6-6 6"/>',
    arrowRight: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    camera: '<path d="M3.5 9A2 2 0 0 1 5.5 7h2.2l1.6-2.3h5.4L16.3 7h2.2a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.3"/>',
    star: '<path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.5-5-2.7-5 2.7.9-5.5-4-4 5.6-.8z"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    share: '<path d="M12 14.5v-11M8 7.2l4-3.7 4 3.7"/><path d="M8.5 10.5H7.3a1.8 1.8 0 0 0-1.8 1.8v6.4a1.8 1.8 0 0 0 1.8 1.8h9.4a1.8 1.8 0 0 0 1.8-1.8v-6.4a1.8 1.8 0 0 0-1.8-1.8h-1.2"/>',
    locate: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" stroke-width="2.6"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    home: '<path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/><path d="M12 17.3s-3-1.8-3-3.8a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2-3 3.8-3 3.8z"/>',
    key: '<circle cx="8" cy="15.5" r="4"/><path d="m10.9 12.6 8.6-8.6M16.5 7l2.5 2.5M14 9.5l2 2"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12"/><path d="M10 11v5.5M14 11v5.5"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    minus: '<path d="M5 12h14"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.3 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.3-3.4-8.5s1.1-6.1 3.4-8.5z"/>',
    car: '<path d="M5.5 16.5H4.3a.8.8 0 0 1-.8-.8v-2.9a2 2 0 0 1 1.3-1.9l2.2-.8 1.9-3.2A2 2 0 0 1 10.6 6h4.1a2 2 0 0 1 1.6.8l2.5 3.4 1.2.4a2 2 0 0 1 1.5 1.9v3.2a.8.8 0 0 1-.8.8h-1.2M9.5 16.5h5"/><path d="M7 10.5h13"/><circle cx="7.5" cy="16.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/>',
    plane: '<path d="M20.6 3.4c.8.8.3 2.2-.7 3.2l-3.4 3.4 2.2 8.8-1.5 1.5-3.9-7-3.3 3.3.4 2.8-1.2 1.2-1.8-3.5-3.5-1.8 1.2-1.2 2.8.4 3.3-3.3-7-3.9L6 5.8l8.8 2.2 3.4-3.4c1-1 2.4-1.5 3.2-.7z"/>',
    bed: '<path d="M3.5 18.5V6M3.5 15h17v3.5M20.5 15v-3a2.5 2.5 0 0 0-2.5-2.5h-7V15"/><circle cx="7.3" cy="11.5" r="1.8"/>',
    sparkle: '<path d="M11 3.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5z"/><path d="M18.5 15.5v4M16.5 17.5h4"/>',
    sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
    moon: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
    settings: '<circle cx="12" cy="12" r="2.8"/><path d="M10.4 3.5h3.2l.5 2.4 1.6.9 2.3-.8 1.6 2.8-1.8 1.6v1.2l1.8 1.6-1.6 2.8-2.3-.8-1.6.9-.5 2.4h-3.2l-.5-2.4-1.6-.9-2.3.8-1.6-2.8 1.8-1.6v-1.2L4.4 8.8 6 6l2.3.8 1.6-.9z"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" stroke-width="2.8"/>'
  };

  function buildSprite() {
    var out = '<svg class="icon-sprite" aria-hidden="true"><defs>';
    Object.keys(ICON_SYMBOLS).forEach(function (name) {
      out += '<symbol id="i-' + name + '" viewBox="0 0 24 24">' + ICON_SYMBOLS[name] + '</symbol>';
    });
    out += '</defs></svg>';
    return out;
  }

  function icon(name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }
  window.SNIcon = icon;

  /* ---------------- Mark (copied from public/favicon.svg, ink strokes swap to white via .mark-ink) ---------------- */
  function markSvg(size) {
    size = size || 32;
    return (
      '<svg class="mark" width="' + size + '" height="' + size + '" viewBox="0 0 64 64" aria-hidden="true">' +
      '<g transform="translate(36.6 33.4) scale(0.9) rotate(-33)">' +
      '<circle class="mark-ink" cx="-26.2" cy="2.2" r="9" fill="none" stroke="#1A1A1A" stroke-width="2.6"/>' +
      '<path class="mark-ink" d="M-24.5 0C-24.5-4.6-19.8-8.2-12.5-10.4C-7.4-11.9-2.2-12.6 3-12.6C16.2-12.6 25.5-7.4 25.5 0C25.5 7.4 16.2 12.6 3 12.6C-2.2 12.6-7.4 11.9-12.5 10.4C-19.8 8.2-24.5 4.6-24.5 0Z" fill="#FFC83D" stroke="#1A1A1A" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<circle cx="-17.4" cy="0" r="2.9" fill="#FFFFFF" stroke="#1A1A1A" stroke-width="1.8" class="mark-ink"/>' +
      '<g class="mark-ink" fill="none" stroke="#1A1A1A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M-3.1-5.2C-6.4-4.6-8.9-1.9-8.9 1.6"/>' +
      '<path d="M-5.9 5.5A3 3 0 1 0-5.9-0.5A3 3 0 1 0-5.9 5.5Z"/>' +
      '<path d="M0.7-3.6L3.4-5.5V5.5"/>' +
      '<path d="M11.9-5.5A3 3 0 1 0 11.9 0.5A3 3 0 1 0 11.9-5.5Z"/>' +
      '<path d="M14.9-2.5C14.9 1.4 12.8 4.4 9.2 5.4"/>' +
      '</g></g></svg>'
    );
  }
  window.SNMark = markSvg;

  /* ---------------- StayArt palettes ---------------- */
  var PALETTES = [
    { a: '#ffe3a0', b: '#ff9d7a', c: '#5fa8cf', sun: '#fff3c9', city: '#3b3550' },
    { a: '#ffd889', b: '#fc8f6b', c: '#4f95c7', sun: '#fff0bd', city: '#332e46' },
    { a: '#ffedb0', b: '#ffb199', c: '#7bc2d9', sun: '#fff8dd', city: '#463f5c' },
    { a: '#ffdca3', b: '#f2836f', c: '#3e8fb0', sun: '#fff3cf', city: '#2c2a3d' },
    { a: '#ffe9b8', b: '#ff8f6d', c: '#6bb3c9', sun: '#fffbe6', city: '#3a3450' },
    { a: '#ffd58f', b: '#fa7b63', c: '#4a9bb8', sun: '#ffeec2', city: '#342f47' }
  ];
  function stayartStyle(i) {
    var p = PALETTES[i % PALETTES.length];
    return 'style="--sa-a:' + p.a + ';--sa-b:' + p.b + ';--sa-c:' + p.c + ';--sa-sun:' + p.sun + ';--sa-city:' + p.city + '"';
  }

  /* ---------------- Demo data ---------------- */
  var HOME_CITY = 'Dubai';
  var STAYS = [
    { id: 'golden-tulip-al-barsha-1', hotel: 'Golden Tulip Al Barsha', area: 'Al Barsha', city: 'Dubai', cityKey: 'dubai', country: 'United Arab Emirates', date: '2026-06-19', checkIn: '14:00', checkOut: '18:00', visitType: ['Day use'], visitNumber: 1, ratingNirsh: 4, ratingShady: 4, favourite: false, note: 'Our first check-in. We picked it because it was five minutes from home and neither of us could wait.', bestMoment: "The lobby smelled like orange blossom and we still don't know why.", moods: ['blissful', 'giggly'], pickedBy: 'Nirsh' },
    { id: 'rove-downtown-1', hotel: 'Rove Downtown', area: 'Downtown', city: 'Dubai', cityKey: 'dubai', country: 'United Arab Emirates', date: '2026-07-02', checkIn: '12:00', checkOut: '20:00', visitType: ['Day use', 'Pool day'], visitNumber: 1, ratingNirsh: 5, ratingShady: 4, favourite: false, note: "Rooftop pool with the Burj right there. We didn't leave until closing.", bestMoment: 'Watching the fountain show from the pool deck.', moods: ['fizzy', 'lazy'], pickedBy: 'Shady' },
    { id: 'address-dubai-marina-1', hotel: 'Address Dubai Marina', area: 'Dubai Marina', city: 'Dubai', cityKey: 'dubai', country: 'United Arab Emirates', date: '2026-07-10', checkIn: '13:00', checkOut: '19:00', visitType: ['Spa', 'Brunch'], visitNumber: 1, ratingNirsh: 5, ratingShady: 5, favourite: false, note: 'The spa day we promised ourselves after a brutal month.', bestMoment: 'Falling asleep mid-massage, both of us, at the same time.', moods: ['cosy', 'blissful'], pickedBy: 'Nirsh' },
    { id: 'ja-ocean-view-1', hotel: 'JA Ocean View Hotel', area: 'JBR', city: 'Dubai', cityKey: 'dubai', country: 'United Arab Emirates', date: '2026-07-20', checkIn: '11:00', checkOut: '19:00', visitType: ['Pool day', 'Staycation'], visitNumber: 1, ratingNirsh: 4, ratingShady: 5, favourite: false, note: 'Beach club day, then a slow JBR walk after sunset.', bestMoment: 'The walk on the beach after the sun went down.', moods: ['romantic', 'fizzy'], pickedBy: 'Shady' },
    { id: 'atlantis-the-palm-1', hotel: 'Atlantis The Palm', area: 'Palm Jumeirah', city: 'Dubai', cityKey: 'dubai', country: 'United Arab Emirates', date: '2026-08-03', checkIn: '10:00', checkOut: '20:00', visitType: ['Staycation', 'Pool day'], visitNumber: 1, ratingNirsh: 5, ratingShady: 5, favourite: true, note: 'Aquaventure all day, dinner with a view of the Palm at night. Still the one we talk about.', bestMoment: 'The slide through the shark tank, twice, because Shady insisted.', moods: ['fizzy', 'adventurous'], pickedBy: 'Shady' },
    { id: 'rove-downtown-2', hotel: 'Rove Downtown', area: 'Downtown', city: 'Dubai', cityKey: 'dubai', country: 'United Arab Emirates', date: '2026-08-14', checkIn: '12:00', checkOut: '22:00', visitType: ['Date night'], visitNumber: 2, ratingNirsh: 5, ratingShady: 5, favourite: false, note: 'Back for round two. We already know which room to ask for.', bestMoment: 'Ordering the exact same room service as last time, on purpose.', moods: ['cosy', 'romantic'], pickedBy: 'Nirsh' },
    { id: 'sheraton-sharjah-1', hotel: 'Sheraton Sharjah Beach Resort', area: 'Corniche', city: 'Sharjah', cityKey: 'sharjah', country: 'United Arab Emirates', date: '2026-08-21', checkIn: '11:00', checkOut: '18:00', visitType: ['Pool day', 'Brunch'], visitNumber: 1, ratingNirsh: 4, ratingShady: 4, favourite: false, note: 'A whole beach practically to ourselves on a weekday.', bestMoment: 'Being the only two people at the pool bar.', moods: ['lazy', 'cosy'], pickedBy: 'Shady' },
    { id: 'emirates-palace-mandarin-1', hotel: 'Emirates Palace Mandarin Oriental', area: 'Corniche', city: 'Abu Dhabi', cityKey: 'abudhabi', country: 'United Arab Emirates', date: '2026-08-28', checkIn: '12:00', checkOut: '20:00', visitType: ['Brunch', 'Staycation'], visitNumber: 1, ratingNirsh: 5, ratingShady: null, favourite: false, note: 'Gold everywhere. We felt criminally underdressed and loved it anyway.', bestMoment: 'The domed ceiling in the lobby at golden hour.', moods: ['fancy'], pickedBy: 'Nirsh' },
    { id: 'waldorf-astoria-rak-1', hotel: 'Waldorf Astoria Ras Al Khaimah', area: 'Al Marjan Island', city: 'Ras Al Khaimah', cityKey: 'other', country: 'United Arab Emirates', date: '2026-09-05', checkIn: '11:00', checkOut: '19:00', visitType: ['Staycation', 'Pool day'], visitNumber: 1, ratingNirsh: 5, ratingShady: 4, favourite: false, note: 'Two hours from home and it felt like a different country.', bestMoment: 'Private beach cabana, absolutely no phones.', moods: ['romantic', 'lazy'], pickedBy: 'Shady' },
    { id: 'shangri-la-muscat-1', hotel: 'Shangri-La Barr Al Jissah', area: 'Bandar Jissah', city: 'Muscat', cityKey: 'abroad', country: 'Oman', date: '2026-09-12', checkIn: '10:00', checkOut: '20:00', visitType: ['Staycation', 'Spa'], visitNumber: 1, ratingNirsh: 5, ratingShady: 5, favourite: false, note: 'First stamp on the passport since this started. Cliffs, a private cove, us.', bestMoment: 'Kayaking into the cove and having it entirely to ourselves.', moods: ['adventurous', 'blissful'], pickedBy: 'Nirsh' },
    { id: 'four-seasons-bahrain-1', hotel: 'Four Seasons Hotel Bahrain Bay', area: 'Bahrain Bay', city: 'Manama', cityKey: 'abroad', country: 'Bahrain', date: '2026-09-19', checkIn: '13:00', checkOut: '21:00', visitType: ['Date night', 'Spa'], visitNumber: 1, ratingNirsh: 5, ratingShady: 5, favourite: false, note: 'Checked in on the 19th without planning it. Felt like the app knew.', bestMoment: 'Cocktails on the infinity pool deck as the skyline lit up.', moods: ['romantic', 'fizzy'], pickedBy: 'Shady' },
    { id: 'rove-downtown-3', hotel: 'Rove Downtown', area: 'Downtown', city: 'Dubai', cityKey: 'dubai', country: 'United Arab Emirates', date: '2026-09-28', checkIn: '14:00', checkOut: '18:00', visitType: ['Day use', 'Work from hotel'], visitNumber: 3, ratingNirsh: 5, ratingShady: 5, favourite: false, note: "Third time here. We have a regular now, and it's ours.", bestMoment: 'The barista at the lobby cafe remembered our order.', moods: ['cosy', 'giggly'], pickedBy: 'Nirsh' }
  ];
  window.SN_STAYS = STAYS;
  window.SN_HOME_CITY = HOME_CITY;

  function badgeFor(stay) {
    if (stay.favourite) return { text: '♥ 1', love: true };
    if (stay.visitNumber >= 3) return { text: 'Our regular', love: false };
    if (stay.visitNumber === 2) return { text: 'Visit 2', love: false };
    return { text: 'First', love: false };
  }

  function fmtDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }
  window.SNfmtDate = fmtDate;

  function hoursBetween(ci, co) {
    var a = ci.split(':').map(Number), b = co.split(':').map(Number);
    return (b[0] * 60 + b[1] - (a[0] * 60 + a[1])) / 60;
  }

  function computeStats() {
    var hotels = {}, cities = {}, countries = {}, hours = 0;
    STAYS.forEach(function (s) {
      hotels[s.hotel] = true;
      cities[s.city] = true;
      countries[s.country] = true;
      hours += hoursBetween(s.checkIn, s.checkOut);
    });
    return {
      hotels: Object.keys(hotels).length,
      visits: STAYS.length,
      hours: Math.round(hours),
      cities: Object.keys(cities).length,
      countries: Object.keys(countries).length
    };
  }
  window.SNstats = computeStats;

  /* ---------------- Split-flap ---------------- */
  function renderFlaps(container, value, opts) {
    opts = opts || {};
    var str = String(value);
    container.innerHTML = str
      .split('')
      .map(function (ch) {
        return '<span class="flap' + (opts.flip ? ' is-flipping' : '') + '">' + ch + '</span>';
      })
      .join('');
  }
  window.SNrenderFlaps = renderFlaps;

  /* ---------------- Together-since counter ---------------- */
  var TOGETHER_SINCE = new Date('2026-06-19T23:46:00+04:00').getTime();
  function updateTogetherCounters() {
    var now = Date.now();
    var diff = Math.max(0, now - TOGETHER_SINCE);
    var mins = Math.floor(diff / 60000);
    var d = Math.floor(mins / 1440);
    var h = Math.floor((mins % 1440) / 60);
    var m = mins % 60;
    var text = d + ' days, ' + h + ' h, ' + m + ' min together';
    document.querySelectorAll('[data-together-counter]').forEach(function (el) {
      el.textContent = text;
    });
  }

  /* ---------------- Header transparency on scroll ---------------- */
  function initHeroHeader() {
    var header = document.querySelector('[data-hero-header]');
    var hero = document.querySelector('.hero');
    if (!header || !hero) return;
    function update() {
      var threshold = hero.offsetHeight - 80;
      if (window.scrollY > threshold) {
        header.classList.remove('is-transparent');
        header.classList.add('is-solid');
      } else {
        header.classList.add('is-transparent');
        header.classList.remove('is-solid');
      }
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* ---------------- Mobile top install strip / cream banner dismiss ---------------- */
  function initDismissables() {
    document.querySelectorAll('[data-dismiss]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = document.querySelector(btn.getAttribute('data-dismiss'));
        if (target) target.style.display = 'none';
      });
    });
  }

  /* ---------------- City tabs ---------------- */
  function initTabs() {
    var tabs = document.querySelectorAll('[data-tab]');
    if (!tabs.length) return;
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        var key = tab.getAttribute('data-tab');
        document.querySelectorAll('[data-city]').forEach(function (card) {
          var show = key === 'all' || card.getAttribute('data-city') === key;
          card.style.display = show ? '' : 'none';
        });
      });
    });
  }

  /* ---------------- Card rendering ---------------- */
  function cardHtml(stay, index) {
    var badge = badgeFor(stay);
    var ratingHtml;
    if (stay.ratingShady == null) {
      ratingHtml = '<span class="stay-card-rating is-waiting">Waiting for Shady’s rating</span>';
    } else {
      var avg = ((stay.ratingNirsh + stay.ratingShady) / 2).toFixed(1).replace(/\.0$/, '');
      ratingHtml = '<span class="stay-card-rating">★ ' + avg + '</span>';
    }
    return (
      '<a class="stay-card" href="stay.html?id=' + stay.id + '" data-city="' + stay.cityKey + '">' +
      '<div class="stay-card-photo"><div class="stayart" ' + stayartStyle(index) + '></div>' +
      '<span class="card-badge">' + badge.text.replace('1', badge.love ? '1' : '1') + '</span>' +
      '<button class="card-heart' + (stay.favourite ? ' is-fave' : '') + '" aria-label="Favourite" onclick="event.preventDefault();this.classList.toggle(\'is-fave\')">' + icon('heart') + '</button>' +
      '</div>' +
      '<div class="stay-card-body">' +
      '<div class="stay-card-name-row"><span class="stay-card-name">' + stay.hotel + '</span>' + ratingHtml + '</div>' +
      '<div class="stay-card-area">' + stay.area + ', ' + stay.city + '</div>' +
      '<div class="stay-card-foot"><div class="stay-card-date-group"><span class="stay-card-date">' + fmtDate(stay.date) + '</span>' +
      '<span class="pill-ink' + (badge.love ? ' is-love' : '') + '">' + badge.text + '</span></div>' +
      '<span class="timestamp-chip">' + stay.checkIn + ' → ' + stay.checkOut + '</span></div>' +
      '</div></a>'
    );
  }

  function initCards() {
    var rails = document.querySelectorAll('[data-card-rail]');
    if (!rails.length) return;
    rails.forEach(function (rail) {
      var limit = rail.getAttribute('data-limit');
      var list = limit ? STAYS.slice(-Number(limit)).reverse() : STAYS.slice().reverse();
      rail.innerHTML = list.map(function (s) { return cardHtml(s, STAYS.indexOf(s)); }).join('');
    });
  }

  /* ---------------- Home page init ---------------- */
  function initHome() {
    if (!document.body.classList.contains('page-home')) return;
    var stats = computeStats();
    var flapWrap = document.querySelector('[data-splitflap-count]');
    if (flapWrap) renderFlaps(flapWrap, stats.hotels);
    var caption = document.querySelector('[data-splitflap-caption]');
    if (caption) caption.textContent = stats.hotels + ' hotels together';

    var statMap = { hotels: stats.hotels, visits: stats.visits, hours: stats.hours, cities: stats.cities, countries: stats.countries };
    document.querySelectorAll('[data-stat]').forEach(function (el) {
      el.textContent = statMap[el.getAttribute('data-stat')];
    });

    initCards();
    initTabs();

    // FAQ dynamic answers
    var nirshRatings = STAYS.map(function (s) { return s.ratingNirsh; }).filter(function (v) { return v != null; });
    var shadyRatings = STAYS.map(function (s) { return s.ratingShady; }).filter(function (v) { return v != null; });
    var avg = function (arr) { return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length; };
    var nAvg = avg(nirshRatings).toFixed(1);
    var sAvg = avg(shadyRatings).toFixed(1);
    var leader = Number(nAvg) >= Number(sAvg) ? ['Nirsh', nAvg, 'Shady', sAvg] : ['Shady', sAvg, 'Nirsh', nAvg];
    var first = STAYS[0];
    var last = STAYS[STAYS.length - 1];
    var regularCounts = {};
    STAYS.forEach(function (s) { regularCounts[s.hotel] = (regularCounts[s.hotel] || 0) + 1; });
    var regularHotel = Object.keys(regularCounts).reduce(function (a, b) { return regularCounts[a] >= regularCounts[b] ? a : b; });

    var answers = {
      'faq-first': first.hotel + ' in ' + first.city + ', on ' + fmtDate(first.date) + '.',
      'faq-regular': regularHotel + ', ' + regularCounts[regularHotel] + ' times and counting.',
      'faq-farthest': 'Four Seasons Hotel Bahrain Bay in Manama, 480 km from home.',
      'faq-longest': 'No overnight stays yet.',
      'faq-hours': stats.hours + ' hours, and counting.',
      'faq-picks': leader[0] + '’s picks average ' + leader[1] + ', ' + leader[2] + '’s average ' + leader[3] + '.',
      'faq-lastcheckin': fmtDate(last.date) + ' at ' + last.hotel + '.'
    };
    Object.keys(answers).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = answers[id];
    });

    // Story in three: first / latest / favourite
    var favourite = STAYS.filter(function (s) { return s.favourite; })[0];
    var storyMap = { 'story-first': first, 'story-latest': last, 'story-fave': favourite };
    Object.keys(storyMap).forEach(function (key) {
      var s = storyMap[key];
      var el = document.querySelector('[data-story="' + key + '"]');
      if (!el || !s) return;
      el.querySelector('.story-date').textContent = fmtDate(s.date) + ' · ' + s.hotel;
      var photo = el.querySelector('.story-photo');
      photo.setAttribute('style', stayartStyle(STAYS.indexOf(s)).replace(/^style="|"$/g, ''));
      photo.innerHTML = '<div class="stayart" style="width:100%;height:100%"></div>';
    });
  }

  /* ---------------- Add-a-stay sheet ---------------- */
  function initAddSheet() {
    var sheet = document.getElementById('add-sheet');
    if (!sheet) return;
    var scrim = document.getElementById('add-scrim');
    var openers = document.querySelectorAll('[data-open-add]');
    var closers = sheet.querySelectorAll('[data-close-add]');
    var steps = Array.prototype.slice.call(sheet.querySelectorAll('.sheet-step'));
    var progressBar = sheet.querySelector('.sheet-progress-bar');
    var titleEl = sheet.querySelector('.sheet-header-title');
    var stepIndex = 0;
    var titles = ['Hotel', 'When', 'What we did', 'Photos', 'The good part'];

    function paint() {
      steps.forEach(function (s, i) { s.classList.toggle('is-active', i === stepIndex); });
      progressBar.style.width = ((stepIndex + 1) / steps.length) * 100 + '%';
      titleEl.textContent = titles[stepIndex] + '  ' + (stepIndex + 1) + '/' + steps.length;
      sheet.querySelectorAll('[data-back]').forEach(function (b) { b.style.visibility = stepIndex === 0 ? 'hidden' : 'visible'; });
      sheet.querySelectorAll('[data-next]').forEach(function (b) {
        b.textContent = stepIndex === steps.length - 1 ? 'Save our stay' : 'Next';
      });
    }

    function open(toStep) {
      scrim.classList.add('is-open');
      sheet.classList.add('is-open');
      stepIndex = toStep || 0;
      paint();
      document.body.style.overflow = 'hidden';
    }
    function close() {
      scrim.classList.remove('is-open');
      sheet.classList.remove('is-open');
      document.body.style.overflow = '';
    }
    openers.forEach(function (b) { b.addEventListener('click', function () { open(Number(b.getAttribute('data-open-add')) || 0); }); });
    closers.forEach(function (b) { b.addEventListener('click', close); });
    scrim.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet.classList.contains('is-open')) close(); });

    sheet.querySelectorAll('[data-next]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (stepIndex < steps.length - 1) { stepIndex++; paint(); }
        else { close(); showCelebration(); }
      });
    });
    sheet.querySelectorAll('[data-back]').forEach(function (b) {
      b.addEventListener('click', function () { if (stepIndex > 0) { stepIndex--; paint(); } });
    });

    // chip selection
    sheet.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () { chip.classList.toggle('is-selected'); });
    });
    sheet.querySelectorAll('.mood-stamp').forEach(function (m) {
      m.addEventListener('click', function () { m.classList.toggle('is-selected'); });
    });
    sheet.querySelectorAll('.option-row[data-thumb-city]').forEach(function () {});
    // stars
    var starButtons = sheet.querySelectorAll('.star-row button');
    starButtons.forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        starButtons.forEach(function (b2, j) { b2.classList.toggle('is-filled', j <= i); });
      });
    });
    // nights stepper
    var stepperValue = sheet.querySelector('.stepper-value');
    if (stepperValue) {
      sheet.querySelectorAll('.stepper-btn').forEach(function (b) {
        b.addEventListener('click', function () {
          var v = Number(stepperValue.textContent);
          v = b.getAttribute('data-op') === 'inc' ? v + 1 : Math.max(0, v - 1);
          stepperValue.textContent = v;
        });
      });
    }

    window.SNopenAddSheet = open;

    function showCelebration() {
      var cel = document.getElementById('celebration');
      if (!cel) return;
      cel.classList.add('is-open');
      var flaps = cel.querySelector('[data-celebration-flap]');
      if (flaps) renderFlaps(flaps, computeStats().visits + 1, { flip: true });
      cel.querySelectorAll('[data-close-celebration]').forEach(function (b) {
        b.onclick = function () { cel.classList.remove('is-open'); };
      });
    }
  }

  /* ---------------- Stay detail page ---------------- */
  function initDetail() {
    var root = document.querySelector('[data-detail-root]');
    if (!root) return;
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    var stay = STAYS.filter(function (s) { return s.id === id; })[0] || STAYS[STAYS.length - 1];
    var idx = STAYS.indexOf(stay);

    document.title = stay.hotel + ' — Suite Nothings';
    document.querySelectorAll('[data-d-hotel]').forEach(function (el) { el.textContent = stay.hotel; });
    document.querySelectorAll('[data-d-area]').forEach(function (el) { el.textContent = stay.area + ', ' + stay.city; });
    document.querySelectorAll('[data-d-date]').forEach(function (el) { el.textContent = fmtDate(stay.date); });
    document.querySelectorAll('[data-d-time]').forEach(function (el) { el.textContent = stay.checkIn + ' → ' + stay.checkOut; });
    document.querySelectorAll('[data-d-note]').forEach(function (el) { el.textContent = '“' + stay.note + '”'; });
    document.querySelectorAll('[data-d-moment]').forEach(function (el) { el.textContent = stay.bestMoment; });
    document.querySelectorAll('[data-d-nirsh]').forEach(function (el) { el.textContent = '★'.repeat(stay.ratingNirsh) + '☆'.repeat(5 - stay.ratingNirsh); });
    document.querySelectorAll('[data-d-shady]').forEach(function (el) {
      el.textContent = stay.ratingShady == null ? 'Waiting for Shady’s rating' : '★'.repeat(stay.ratingShady) + '☆'.repeat(5 - stay.ratingShady);
    });
    var badge = badgeFor(stay);
    document.querySelectorAll('[data-d-badge]').forEach(function (el) { el.textContent = badge.text; });
    document.querySelectorAll('[data-d-visittype]').forEach(function (el) { el.textContent = stay.visitType.join(' · '); });

    document.querySelectorAll('[data-d-art]').forEach(function (el, i) {
      el.setAttribute('style', stayartStyle(idx + i).replace(/^style="|"$/g, ''));
    });

    var visits = STAYS.filter(function (s) { return s.hotel === stay.hotel; });
    var timelineEl = document.querySelector('[data-d-timeline]');
    if (timelineEl) {
      timelineEl.innerHTML = visits
        .map(function (v) { return '<div class="timeline-item"><strong>' + fmtDate(v.date) + '</strong> — ' + v.visitType.join(', ') + '</div>'; })
        .join('');
    }
  }

  /* ---------------- Map page ---------------- */
  function initMap() {
    var mapPage = document.querySelector('[data-map-root]');
    if (!mapPage) return;

    var hotelMap = {};
    STAYS.forEach(function (s) {
      if (!hotelMap[s.hotel]) hotelMap[s.hotel] = { hotel: s.hotel, area: s.area, city: s.city, country: s.country, cityKey: s.cityKey, count: 0, favourite: false, stayId: s.id, date: s.date, checkIn: s.checkIn, checkOut: s.checkOut, idx: STAYS.indexOf(s) };
      hotelMap[s.hotel].count++;
      if (s.favourite) hotelMap[s.hotel].favourite = true;
    });
    var hotels = Object.keys(hotelMap).map(function (k) { return hotelMap[k]; });

    var chapters = {
      city: { title: HOME_CITY.toUpperCase(), scope: 'dubai' },
      country: { title: 'UNITED ARAB EMIRATES', scope: 'uae' },
      world: { title: 'THE WORLD', scope: 'world' }
    };

    function inScope(h, scope) {
      if (scope === 'dubai') return h.cityKey === 'dubai';
      if (scope === 'uae') return h.cityKey !== 'abroad';
      return true;
    }

    var titleFlap = document.querySelector('[data-map-title]');
    var countEl = document.querySelector('[data-map-count]');
    var chips = document.querySelectorAll('[data-map-chip]');

    function paintChapter(key) {
      var ch = chapters[key];
      renderFlaps(titleFlap, ch.title);
      var visible = hotels.filter(function (h) { return inScope(h, ch.scope); });
      countEl.textContent = visible.length + (visible.length === 1 ? ' stay in view' : ' stays in view');
      document.querySelectorAll('[data-pin]').forEach(function (pinEl) {
        var h = hotelMap[pinEl.getAttribute('data-pin')];
        pinEl.style.display = inScope(h, ch.scope) ? '' : 'none';
      });
      mapPage.classList.remove('scale-city', 'scale-country', 'scale-world');
      mapPage.classList.add('scale-' + key);
      chips.forEach(function (c) { c.classList.toggle('is-active', c.getAttribute('data-map-chip') === key); });
    }

    chips.forEach(function (c) { c.addEventListener('click', function () { paintChapter(c.getAttribute('data-map-chip')); }); });

    // Render pins
    var pinLayer = document.querySelector('[data-pin-layer]');
    var positions = {
      'Golden Tulip Al Barsha': [46, 62],
      'Rove Downtown': [52, 55],
      'Address Dubai Marina': [40, 66],
      'JA Ocean View Hotel': [38, 70],
      'Atlantis The Palm': [33, 58],
      'Sheraton Sharjah Beach Resort': [58, 42],
      'Emirates Palace Mandarin Oriental': [26, 60],
      'Waldorf Astoria Ras Al Khaimah': [68, 30],
      'Shangri-La Barr Al Jissah': [86, 66],
      'Four Seasons Hotel Bahrain Bay': [14, 50]
    };
    if (pinLayer) {
      pinLayer.innerHTML = hotels.map(function (h) {
        var pos = positions[h.hotel] || [50, 50];
        var glow = h.favourite ? '<ellipse cx="22" cy="30" rx="17" ry="19" fill="#FF6A3D" opacity="0.5"/>' : '';
        var label = h.count > 1
          ? '<circle cx="22" cy="28.5" r="8" fill="#fff" stroke="#1A1A1A" stroke-width="1.6"/><text x="22" y="32" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="10.5" fill="#1A1A1A">' + h.count + '</text>'
          : '<path d="M16.5 28.5h11" stroke="#1A1A1A" stroke-width="2" stroke-linecap="round" opacity="0.55"/>';
        return (
          '<button class="map-pin-btn" data-pin="' + h.hotel + '" style="left:' + pos[0] + '%;top:' + pos[1] + '%">' +
          '<svg viewBox="0 0 44 58">' + glow +
          '<circle cx="22" cy="10" r="6.4" fill="none" stroke="#1A1A1A" stroke-width="2.4"/>' +
          '<path d="M22 15.5c7.9 0 13.5 5.4 13.5 12.6 0 8.6-7.4 14.6-12.3 24.4a1.3 1.3 0 0 1-2.4 0C15.9 42.7 8.5 36.7 8.5 28.1 8.5 20.9 14.1 15.5 22 15.5z" fill="#FFC83D" stroke="#1A1A1A" stroke-width="2.4" stroke-linejoin="round"/>' +
          '<circle cx="22" cy="20.6" r="2.3" fill="#fff" stroke="#1A1A1A" stroke-width="1.6"/>' +
          '<path d="M22 16.4v4.2" stroke="#1A1A1A" stroke-width="2.4" stroke-linecap="round"/>' + label +
          '</svg></button>'
        );
      }).join('');

      pinLayer.querySelectorAll('.map-pin-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          pinLayer.querySelectorAll('.map-pin-btn').forEach(function (b) { b.classList.remove('is-selected'); });
          btn.classList.add('is-selected');
          openPinCard(hotelMap[btn.getAttribute('data-pin')]);
        });
      });
    }

    var pinSheet = document.querySelector('[data-pin-sheet]');
    function openPinCard(h) {
      if (!pinSheet) return;
      pinSheet.querySelector('[data-pc-name]').textContent = h.hotel;
      pinSheet.querySelector('[data-pc-area]').textContent = h.area + ', ' + h.city;
      pinSheet.querySelector('[data-pc-badge]').textContent = h.count > 1 ? 'Visit ' + h.count : 'First';
      pinSheet.querySelector('[data-pc-date]').textContent = fmtDate(h.date);
      pinSheet.querySelector('[data-pc-time]').textContent = h.checkIn + ' → ' + h.checkOut;
      pinSheet.querySelector('[data-pc-art]').setAttribute('style', stayartStyle(h.idx).replace(/^style="|"$/g, ''));
      pinSheet.querySelector('[data-pc-link]').href = 'stay.html?id=' + h.stayId;
      pinSheet.classList.add('is-open');
    }
    document.querySelectorAll('[data-close-pin]').forEach(function (b) { b.addEventListener('click', function () { pinSheet.classList.remove('is-open'); }); });

    // list view
    var listView = document.querySelector('[data-map-list]');
    var listToggle = document.querySelector('[data-toggle-list]');
    if (listView && listToggle) {
      var groups = {};
      hotels.forEach(function (h) { (groups[h.city] = groups[h.city] || []).push(h); });
      listView.querySelector('[data-map-list-body]').innerHTML = Object.keys(groups).map(function (city) {
        return '<div class="map-list-group"><h3>' + city + '</h3>' + groups[city].map(function (h) {
          return '<a class="map-list-row" href="stay.html?id=' + h.stayId + '"><span class="thumb"><span class="stayart" style="width:100%;height:100%"></span></span>' +
            '<span><strong>' + h.hotel + '</strong><br><span class="text-muted" style="font-size:.8rem">' + fmtDate(h.date) + '</span></span></a>';
        }).join('') + '</div>';
      }).join('');
      listToggle.addEventListener('click', function () { listView.classList.add('is-open'); });
      document.querySelectorAll('[data-close-list]').forEach(function (b) { b.addEventListener('click', function () { listView.classList.remove('is-open'); }); });
    }

    document.querySelectorAll('[data-locate], [data-compass]').forEach(function (b) {
      b.addEventListener('click', function () { b.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.9)' }, { transform: 'scale(1)' }], { duration: 200 }); });
    });

    paintChapter('city');
  }

  /* ---------------- Boot ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    document.body.insertAdjacentHTML('afterbegin', buildSprite());
    document.querySelectorAll('[data-mark]').forEach(function (el) {
      el.innerHTML = markSvg(Number(el.getAttribute('data-mark')) || 32);
    });
    initHeroHeader();
    initDismissables();
    updateTogetherCounters();
    setInterval(updateTogetherCounters, 1000);
    initHome();
    initAddSheet();
    initDetail();
    initMap();
  });
})();
