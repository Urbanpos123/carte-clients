/* URBANPOS — Carte des références publiques.
 * Loads clients.json, places markers on a Leaflet map with type-based icons,
 * clusters them, and lets the visitor filter by type de service. */

(function () {
  'use strict';

  var TYPE_COLORS = {
    'Service à table': '#7B133C',
    'Quick': '#ea580c',
    'Bar-Café': '#D4A853',
    'Retail': '#0f766e'
  };

  var TYPE_ICONS = {
    'Service à table': '<svg viewBox="0 0 24 24"><path d="M8 2v8a4 4 0 0 0 3 3.87V22h2v-8.13A4 4 0 0 0 16 10V2h-2v8a2 2 0 0 1-1 1.73V2h-2v9.73A2 2 0 0 1 10 10V2H8z"/></svg>',
    'Quick': '<svg viewBox="0 0 24 24"><path d="M3 11h18l-1 8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2l-1-8zm9-9c1.5 0 3 1 3 2.5S13.5 7 12 7s-3-1-3-2.5S10.5 2 12 2zM3 9h18a1 1 0 0 0 0-2H3a1 1 0 0 0 0 2z"/></svg>',
    'Bar-Café': '<svg viewBox="0 0 24 24"><path d="M2 21h18v-2H2v2zm18-9V3H4v9a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4zm-2 0a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5h12v7zm2-6h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2V6z"/></svg>',
    'Retail': '<svg viewBox="0 0 24 24"><path d="M19 6h-2a5 5 0 0 0-10 0H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-7-3a3 3 0 0 1 3 3H9a3 3 0 0 1 3-3zm7 17H5V8h2v2a1 1 0 0 0 2 0V8h6v2a1 1 0 0 0 2 0V8h2v12z"/></svg>'
  };

  function makeIcon(type) {
    var color = TYPE_COLORS[type] || '#7B133C';
    var glyph = TYPE_ICONS[type] || TYPE_ICONS['Service à table'];
    return L.divIcon({
      className: '',
      html: '<div class="urbanpos-marker" style="background:' + color + '">' + glyph + '</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function truncate(s, n) {
    if (!s) return '';
    s = String(s);
    return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
  }

  function renderPopup(e) {
    var color = TYPE_COLORS[e.type] || '#7B133C';
    var html = '<div class="popup">';
    if (e.photo) {
      html += '<img class="popup-photo" loading="lazy" src="' + escapeHtml(e.photo) + '" alt="' + escapeHtml(e.name) + '">';
    }
    html += '<div class="popup-body">';
    html += '<h3 class="popup-name">' + escapeHtml(e.name) + '</h3>';
    html += '<div class="popup-meta">';
    html += '<span>' + escapeHtml(e.city || '') + '</span>';
    if (e.type) {
      html += '<span class="popup-type" style="--type-color:' + color + '">' + escapeHtml(e.type) + '</span>';
    }
    html += '</div>';
    if (e.testimonial) {
      html += '<p class="popup-testimonial">«&nbsp;' + escapeHtml(truncate(e.testimonial, 280)) + '&nbsp;»';
      if (e.testimonial_author) {
        html += '<span class="popup-testimonial-author">— ' + escapeHtml(e.testimonial_author) + '</span>';
      }
      html += '</p>';
    }
    if (e.website) {
      var url = e.website;
      if (!/^https?:/i.test(url)) url = 'https://' + url;
      html += '<a class="popup-website" target="_blank" rel="noopener" href="' + escapeHtml(url) + '">Visiter le site →</a>';
    }
    html += '</div></div>';
    return html;
  }

  var map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([50.85, 4.35], 8);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(map);

  var cluster = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 50,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true
  });
  map.addLayer(cluster);

  var allMarkers = [];
  var activeFilter = 'all';

  function applyFilter() {
    cluster.clearLayers();
    var visible = [];
    for (var i = 0; i < allMarkers.length; i++) {
      var entry = allMarkers[i];
      if (activeFilter === 'all' || entry.type === activeFilter) {
        visible.push(entry.marker);
      }
    }
    cluster.addLayers(visible);
  }

  document.querySelectorAll('[data-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-filter]').forEach(function (b) {
        b.classList.remove('filter-chip-active');
      });
      btn.classList.add('filter-chip-active');
      activeFilter = btn.dataset.filter;
      applyFilter();
    });
  });

  fetch('clients.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('clients.json HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      var establishments = data.establishments || [];
      document.getElementById('count').textContent = establishments.length.toLocaleString('fr-BE');

      for (var i = 0; i < establishments.length; i++) {
        var e = establishments[i];
        if (typeof e.lat !== 'number' || typeof e.lon !== 'number') continue;
        var marker = L.marker([e.lat, e.lon], { icon: makeIcon(e.type) });
        marker.bindPopup(renderPopup(e), { maxWidth: 280, autoPan: true });
        allMarkers.push({ marker: marker, type: e.type });
      }
      applyFilter();
      var loading = document.getElementById('loading');
      if (loading) {
        loading.classList.add('hidden');
        setTimeout(function () { loading.style.display = 'none'; }, 250);
      }
    })
    .catch(function (err) {
      console.error('Failed to load clients.json:', err);
      var loading = document.getElementById('loading');
      if (loading) {
        loading.innerHTML = '<div class="text-red-600 text-sm">Erreur de chargement de la carte. Réessayez plus tard.</div>';
      }
    });
})();
