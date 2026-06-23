/* ============================================================
   KRONOS V40 · app.js · Lógica principal
   Módulos: datos, estado, storage, filtros, render,
            carrito, wishlist, comparador, soluciones,
            cuenta, pedidos, pagos, seguimiento, solicitudes
   ============================================================ */

// ---- Datos globales ----
const products      = window.KRONOS_PRODUCTS   || [];
const familyRecords = window.KRONOS_FAMILIES   || [];
const brandRecords  = window.KRONOS_BRANDS     || [];
const families = familyRecords.map(x => typeof x === 'string' ? x : x.familia).filter(Boolean);
const brands   = brandRecords.map(x => typeof x === 'string' ? x : x.marca).filter(Boolean);

// ---- Claves de storage ----
const STORAGE = {
  cart:     'kronos_v40_cart',
  requests: 'kronos_v40_requests',
  events:   'kronos_v40_events',
  profile:  'kronos_v40_profile',
  wishlist: 'kronos_v40_wishlist',
  compare:  'kronos_v40_compare',
};

// ---- Estado de la aplicación ----
const URL_PARAMS = new URLSearchParams(window.location.search);
let state = {
  family:  URL_PARAMS.get('familia') || 'Todos',
  brand:   URL_PARAMS.get('marca')   || 'Todas',
  query:   '',
  cart:    loadCart(),
  wishlist: loadWishlist(),
  compare: loadCompare(),   // array de SKUs (máx 3)
};

// ---- Utilidades DOM ----
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const exists = s => Boolean($(s));

// ---- Utilidades generales ----
const esc = s => String(s ?? '').replace(/[&<>"']/g, m =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));
const fmt = v => v ? '$' + Number(v).toLocaleString('es-CL') : 'Cotizar';
const nowIso  = () => new Date().toISOString();
const todayId = () => new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);

// ---- Storage helpers ----
function get(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch(e) { return fallback; }
}
function set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function loadCart()     { return get(STORAGE.cart, {}); }
function saveCart()     { set(STORAGE.cart, state.cart); }
function loadWishlist() { return get(STORAGE.wishlist, []); }
function saveWishlist() { set(STORAGE.wishlist, state.wishlist); }
function loadCompare()  { return get(STORAGE.compare, []); }
function saveCompare()  { set(STORAGE.compare, state.compare); }

function getRequests()  { return get(STORAGE.requests, []); }
function setRequests(v) { set(STORAGE.requests, v); }
function getEvents()    { return get(STORAGE.events, []); }
function setEvents(v)   { set(STORAGE.events, v); }
function getProfile()   { return get(STORAGE.profile, null); }
function setProfile(v)  { set(STORAGE.profile, v); }

// ---- Logging de eventos ----
function logEvent(type, payload = {}) {
  const ev = getEvents();
  ev.push({
    event_id:   `EV-${todayId()}-${String(ev.length+1).padStart(4,'0')}`,
    event_type: type,
    created_at: nowIso(),
    ...payload
  });
  setEvents(ev);
}

// ---- Validaciones ----
const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());
const validPhone = v => normalizePhone(v).length >= 8;

// ---- Helpers de producto ----
function imgPath(p, key) { return (p.media && p.media[key]) || ''; }
function normalizePhone(phone) { return String(phone||'').replace(/\D/g,'').replace(/^0+/,''); }
function encodeText(t) { return encodeURIComponent(t); }
function bySku(sku) { return products.find(p => p.sku === sku); }

// ---- Filtrado y ordenamiento ----
function filtered() {
  const q = state.query.toLowerCase().trim();
  return products.filter(p => {
    const fam = state.family === 'Todos' || p.familia === state.family;
    const br  = state.brand  === 'Todas' || p.marca   === state.brand;
    const hay = `${p.sku} ${p.nombre_web} ${p.marca} ${p.familia} ${p.subfamilia} ${p.bajada_corta} ${(p.caracteristicas||[]).join(' ')}`
      .toLowerCase().includes(q);
    return fam && br && hay;
  }).sort((a, b) => {
    const s = $('#sort')?.value || 'ranking';
    if (s === 'name')      return a.nombre_web.localeCompare(b.nombre_web,'es');
    if (s === 'priceAsc')  return (a.precio_clp||999999999)-(b.precio_clp||999999999);
    if (s === 'priceDesc') return (b.precio_clp||0)-(a.precio_clp||0);
    return (a.ranking||999)-(b.ranking||999);
  });
}

// ---- Carrito ----
function cartCount() { return Object.values(state.cart).reduce((a,b) => a+Number(b||0), 0); }
function cartItems() {
  return Object.entries(state.cart)
    .map(([sku,qty]) => ({ product: bySku(sku), qty }))
    .filter(x => x.product && x.qty > 0);
}
function cartTotal() {
  return cartItems().reduce((a,{product:p,qty}) => a+(Number(p.precio_clp||0)*qty), 0);
}
function addCart(sku) {
  state.cart[sku] = (state.cart[sku]||0) + 1;
  saveCart();
  logEvent('add_cart',{sku});
  renderCart(); renderHomePanel(); renderProducts();
  toast('Producto agregado al carro ✓');
}
function removeCart(sku, delta=-1) {
  if (!state.cart[sku]) return;
  state.cart[sku] += delta;
  if (state.cart[sku] <= 0) delete state.cart[sku];
  saveCart(); renderCart(); renderHomePanel(); renderProducts();
}
function clearCart() {
  state.cart = {}; saveCart();
  renderCart(); renderHomePanel(); renderProducts();
  toast('Carro vaciado');
}

// ---- Wishlist ----
function isInWishlist(sku) { return state.wishlist.includes(sku); }
function toggleWishlist(sku) {
  if (isInWishlist(sku)) {
    state.wishlist = state.wishlist.filter(s => s !== sku);
    toast('Eliminado de favoritos');
  } else {
    state.wishlist.push(sku);
    toast('Guardado en favoritos ♥');
    logEvent('add_wishlist',{sku});
  }
  saveWishlist();
  renderProducts();
  renderWishlistDrawer();
}
function renderWishlistDrawer() {
  const drawer = $('#wishlistDrawer');
  if (!drawer) return;
  const count = $('#wishlistCount');
  if (count) count.textContent = state.wishlist.length;
  const items = $('#wishlistItems');
  if (!items) return;
  const list = state.wishlist.map(sku => bySku(sku)).filter(Boolean);
  items.innerHTML = list.length
    ? list.map(p => `
        <div class="wish-item">
          <img src="${esc(imgPath(p,'hero'))}" alt="${esc(p.nombre_web)}">
          <div>
            <b>${esc(p.nombre_web)}</b>
            <small>${esc(p.marca)} · ${esc(p.familia)}</small>
            <span>${fmt(p.precio_clp)}</span>
          </div>
          <div style="display:grid;gap:6px">
            <button class="btn" style="padding:8px 10px;font-size:12px" onclick="addCart('${esc(p.sku)}')">+ Carro</button>
            <button class="mini-btn" onclick="toggleWishlist('${esc(p.sku)}')">Quitar</button>
          </div>
        </div>`)
      .join('')
    : '<p class="empty">No hay favoritos todavía. Usa el ♥ en los productos.</p>';
}
function openWishlist()  { $('#wishlistDrawer')?.classList.add('open'); }
function closeWishlist() { $('#wishlistDrawer')?.classList.remove('open'); }

// ---- Comparador (máx 3 productos) ----
function isInCompare(sku) { return state.compare.includes(sku); }
function toggleCompare(sku) {
  if (isInCompare(sku)) {
    state.compare = state.compare.filter(s => s !== sku);
    toast('Quitado del comparador');
  } else {
    if (state.compare.length >= 3) { toast('Máximo 3 productos para comparar'); return; }
    state.compare.push(sku);
    toast('Agregado al comparador');
  }
  saveCompare();
  renderProducts();
  renderCompareBar();
}
function renderCompareBar() {
  const bar = $('#compareBar');
  if (!bar) return;
  const visible = state.compare.length > 0;
  bar.classList.toggle('visible', visible);
  const slots = $('#compareSlots');
  if (!slots) return;
  const filled = state.compare.map(sku => bySku(sku)).filter(Boolean);
  let html = '';
  for (let i = 0; i < 3; i++) {
    const p = filled[i];
    html += p
      ? `<div class="compare-slot filled"><b>${esc(p.familia)}</b>${esc(p.nombre_web)}</div>`
      : `<div class="compare-slot">Vacío</div>`;
  }
  slots.innerHTML = html;
}
function openCompareModal() {
  if (state.compare.length < 2) { toast('Selecciona al menos 2 productos para comparar'); return; }
  const modal = $('#compareModal');
  if (!modal) return;
  const prods = state.compare.map(sku => bySku(sku)).filter(Boolean);
  const content = $('#compareContent');
  if (content) content.innerHTML = buildCompareTable(prods);
  modal.classList.add('open');
}
function closeCompareModal() { $('#compareModal')?.classList.remove('open'); }
function clearCompare() {
  state.compare = []; saveCompare();
  renderProducts(); renderCompareBar();
  closeCompareModal();
  toast('Comparador vaciado');
}
function buildCompareTable(prods) {
  const pad = [...prods];
  while (pad.length < 3) pad.push(null);
  const imgHtml  = pad.map(p => p ? `<img src="${esc(imgPath(p,'hero'))}" alt="">` : '').join('');
  const nameHtml = pad.map(p => p ? `<div><h3>${esc(p.nombre_web)}</h3><div class="price">${fmt(p.precio_clp)}</div></div>` : '<div></div>').join('');
  const rows = [
    ['Marca',        pad.map(p => p ? `<b>${esc(p.marca)}</b>` : '—')],
    ['Familia',      pad.map(p => p ? esc(p.familia) : '—')],
    ['Subfamilia',   pad.map(p => p ? esc(p.subfamilia||'—') : '—')],
    ['Precio',       pad.map(p => p ? `<b>${fmt(p.precio_clp)}</b>` : '—')],
    ['Descripción',  pad.map(p => p ? esc(p.bajada_corta||'—') : '—')],
    ['Instalación',  pad.map(p => p ? esc(p.compatibilidad_instalacion||'—') : '—')],
    ['Características', pad.map(p => p ? (p.caracteristicas||[]).slice(0,4).map(x=>`<span style="display:block;margin:2px 0">• ${esc(x)}</span>`).join('') : '—')],
  ];
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h2 style="margin:0">Comparador de productos</h2>
      <div style="display:flex;gap:10px">
        <button class="btn ghost" onclick="clearCompare()">Limpiar</button>
        <button class="btn ghost" onclick="closeCompareModal()">Cerrar</button>
      </div>
    </div>
    <div class="compare-grid">
      <div class="compare-header"><div class="label">Imagen</div>${imgHtml}</div>
      <div class="compare-header"><div class="label">Producto</div>${nameHtml}</div>
      ${rows.map(([label,vals]) => `
        <div class="compare-row">
          <div class="label">${label}</div>
          ${vals.map(v => `<div class="val">${v||'—'}</div>`).join('')}
        </div>`).join('')}
      <div class="compare-row">
        <div class="label">Acción</div>
        ${pad.map(p => p
          ? `<div class="val"><button class="btn" style="padding:9px 12px;font-size:12px" onclick="addCart('${esc(p.sku)}');closeCompareModal()">Agregar al carro</button></div>`
          : '<div></div>').join('')}
      </div>
    </div>`;
}

// ---- Render KPIs ----
function renderKPIs() {
  if ($('#totalProducts')) $('#totalProducts').textContent = products.length;
  if ($('#totalFamilies')) $('#totalFamilies').textContent = families.length;
  if ($('#totalBrands'))   $('#totalBrands').textContent   = brands.length;
}

// ---- Render filtros ----
function renderFilters() {
  if ($('#familyFilter'))
    $('#familyFilter').innerHTML = '<option value="Todos">Todas las familias</option>'
      + families.map(f => `<option ${state.family===f?'selected':''}>${esc(f)}</option>`).join('');
  if ($('#brandFilter'))
    $('#brandFilter').innerHTML  = '<option value="Todas">Todas las marcas</option>'
      + brands.map(b => `<option ${state.brand===b?'selected':''}>${esc(b)}</option>`).join('');
}

// ---- Render familias (marquee) ----
function renderFamilies() {
  if (!$('#familyMarquee')) return;
  const chips = [...families,...families].map(f => {
    const meta = familyRecords.find(x => (typeof x==='string'?x:x.familia) === f);
    return `<button class="family-chip ${state.family===f?'active':''}" onclick="filterFamily('${esc(f)}')">
      <span>${esc(meta?.icon||'●')}</span>${esc(f)}
    </button>`;
  }).join('');
  $('#familyMarquee').innerHTML = chips;
}

function filterFamily(f) {
  state.family = f;
  if ($('#familyFilter')) $('#familyFilter').value = f;
  renderProducts(); renderFamilies();
  document.querySelector('#catalogo')?.scrollIntoView({ behavior:'smooth' });
}

// ---- Render productos ----
function renderProducts() {
  if (!$('#productGrid')) return;
  const list = filtered();
  if ($('#resultCount')) $('#resultCount').textContent = `${list.length} productos`;
  $('#productGrid').innerHTML = list.map(card).join('')
    || '<p class="empty">No hay productos para este filtro.</p>';
  renderRecommended();
}

function card(p) {
  const qty   = state.cart[p.sku] || 0;
  const liked = isInWishlist(p.sku);
  const inCmp = isInCompare(p.sku);
  return `
    <article class="card">
      <div class="card-media">
        <img src="${esc(imgPath(p,'hero'))}" alt="${esc(p.nombre_web)}" loading="lazy">
        <span class="badge">${esc(p.familia)}</span>
        ${qty ? `<span class="qty-badge">${qty}</span>` : ''}
        <button class="wish-btn ${liked?'active':''}" onclick="toggleWishlist('${esc(p.sku)}')" title="Favoritos">♥</button>
        <button class="compare-btn ${inCmp?'active':''}" onclick="toggleCompare('${esc(p.sku)}')" title="Comparar">⇌</button>
      </div>
      <div class="card-body">
        <h3>${esc(p.nombre_web)}</h3>
        <p>${esc(p.bajada_corta||'')}</p>
        <div class="price">${fmt(p.precio_clp)}</div>
        <div class="card-actions">
          <button class="btn ghost" onclick="openDetail('${esc(p.sku)}')">Ver ficha</button>
          <button class="btn" onclick="addCart('${esc(p.sku)}')">Agregar</button>
        </div>
      </div>
    </article>`;
}

// ---- Render recomendados ----
function renderRecommended() {
  if (!$('#recommendedRail')) return;
  const rec = [...products].sort((a,b) => (a.ranking||999)-(b.ranking||999)).slice(0,24);
  $('#recommendedRail').innerHTML = [...rec,...rec].map(p => `
    <article class="card rail-card">
      <div class="card-media">
        <img src="${esc(imgPath(p,'hero'))}" alt="${esc(p.nombre_web)}" loading="lazy">
        <span class="badge">${esc(p.marca)}</span>
      </div>
      <div class="card-body">
        <h3>${esc(p.nombre_web)}</h3>
        <div class="price">${fmt(p.precio_clp)}</div>
        <div class="card-actions">
          <button class="btn ghost" onclick="openDetail('${esc(p.sku)}')">Ver ficha</button>
          <button class="btn" onclick="addCart('${esc(p.sku)}')">Agregar</button>
        </div>
      </div>
    </article>`).join('');
}

// ---- Render panel cliente en hero ----
function renderHomePanel() {
  const profile = getProfile(), reqs = getRequests(), latest = reqs[0];
  if ($('#homeClientName')) $('#homeClientName').textContent = profile?.nombre || 'Visitante';
  if ($('#homeCartCount'))  $('#homeCartCount').textContent  = cartCount();
  if ($('#homeOrderCount')) $('#homeOrderCount').textContent = reqs.length;
  if ($('#homePaymentStatus'))  $('#homePaymentStatus').textContent  = latest?.payment?.status  || '—';
  if ($('#homeTrackingStatus')) $('#homeTrackingStatus').textContent = latest?.shipping?.status || '—';
}

// ---- Render carrito ----
function renderCart() {
  const count = cartCount();
  if ($('#cartCount'))   $('#cartCount').textContent   = count;
  if ($('#cartSummary')) $('#cartSummary').textContent = `${count} productos seleccionados`;
  if ($('#cartTotal'))   $('#cartTotal').textContent   = fmt(cartTotal());
  if (!$('#cartItems')) return;
  const items = cartItems();
  $('#cartItems').innerHTML = items.length
    ? items.map(({product:p,qty}) => `
        <div class="cart-row">
          <img src="${esc(imgPath(p,'hero'))}" alt="${esc(p.nombre_web)}">
          <div>
            <b>${esc(p.nombre_web)}</b>
            <small>${esc(p.sku)} · ${esc(p.marca)} · ${fmt(p.precio_clp)}</small>
          </div>
          <div class="qty-controls">
            <button onclick="removeCart('${esc(p.sku)}',-1)">−</button>
            <b>${qty}</b>
            <button onclick="addCart('${esc(p.sku)}')">+</button>
          </div>
        </div>`).join('')
    : '<p class="empty">Agrega productos desde el catálogo para crear una solicitud.</p>';
}

// ---- Ficha de producto ----
function openVideoBySku(sku) {
  const p = bySku(sku);
  const url = p?.media?.videoUrl || p?.video_url || '';
  if (url) window.open(url,'_blank');
  else toast('Video pendiente de validación');
}

function openDetail(sku) {
  const p = bySku(sku);
  if (!p || !$('#detail')) return;
  logEvent('view_item',{ sku:p.sku, product_name:p.nombre_web, family:p.familia, brand:p.marca });
  const rel     = p.relation || {};
  const related = rel.productos_relacionados || [];
  const features = p.caracteristicas || [];

  $('#detailTitle').textContent = p.nombre_web;
  $('#detailSub').textContent   = `${p.sku} · ${p.marca} · ${p.familia} · ${fmt(p.precio_clp)}`;

  $('#detailBody').innerHTML = `
    <div class="detail-left">
      <div class="media-grid">
        <button class="media-tile"><span class="media-label">01 principal</span><img src="${esc(imgPath(p,'hero'))}" alt=""></button>
        <button class="media-tile"><span class="media-label">02 uso / ángulos</span><img src="${esc(imgPath(p,'angles'))}" alt=""></button>
        <button class="media-tile"><span class="media-label">03 características</span><img src="${esc(imgPath(p,'features'))}" alt=""></button>
        <button class="media-tile" onclick="openVideoBySku('${esc(p.sku)}')"><span class="media-label">04 video</span><img src="${esc(imgPath(p,'videoThumb'))}" alt=""></button>
      </div>
      <div class="card-actions" style="margin-top:0">
        <button class="btn" onclick="addCart('${esc(p.sku)}')">${p.precio_clp?'Agregar al carro':'Cotizar'}</button>
        <button class="btn ghost" onclick="toggleWishlist('${esc(p.sku)}')">${isInWishlist(p.sku)?'♥ Favorito':'♡ Favoritos'}</button>
        <a class="btn ghost" href="carrito.html">Ver carro</a>
      </div>
      <div class="left-summary">
        <h4>Resumen</h4>
        <p>${esc(p.descripcion_ficha||p.bajada_corta||'Producto para solución domótica.')}</p>
        <p><b>Marca:</b> ${esc(p.marca)} · <b>Familia:</b> ${esc(p.familia)}</p>
      </div>
    </div>
    <div class="detail-right">
      <div class="info-block">
        <h4>Descripción comercial</h4>
        <p>${esc(p.bajada_corta||'')}</p>
      </div>
      <div class="info-block">
        <h4>Características clave</h4>
        <ul>${features.map(x=>`<li>${esc(x)}</li>`).join('') || '<li>Pendiente completar características específicas.</li>'}</ul>
      </div>
      <div class="info-block">
        <h4>Compatibilidad e instalación</h4>
        <p>${esc(p.compatibilidad_instalacion||'Revisar compatibilidad específica antes de compra o instalación.')}</p>
      </div>
      <div class="info-block">
        <h4>Productos complementarios</h4>
        <div class="relation-flow">
          ${related.slice(0,6).map(r => `
            <button class="rel-card" onclick="openDetail('${esc(r.sku)}')">
              <b>${esc(r.nombre_web)}</b>
              <small>${esc(r.familia)} · ${esc(String(r.motivo||'').replace('Complementa','Relacionado con'))}</small>
            </button>`).join('') || '<p class="mini-note">Sin productos complementarios registrados.</p>'}
        </div>
      </div>
    </div>`;
  $('#detail').classList.add('open');
}

function closeDetail() { $('#detail')?.classList.remove('open'); }

// ---- Soluciones domóticas ----
const SOLUCIONES = [
  {
    id: 'living',
    icon: '🛋️',
    nombre: 'Living conectado',
    desc: 'Control de luces, persianas, audio y temperatura desde un punto central.',
    color: 'rgba(99,230,190,.2)',
    skus: ['LUZ-AMP-001','LUZ-TIR-001','CTR-CLI-001','CEB-HUB-001','ENE-REL-001'],
    tags: ['Iluminación','Clima','Control'],
  },
  {
    id: 'dormitorio',
    icon: '🛏️',
    nombre: 'Dormitorio inteligente',
    desc: 'Ambiente óptimo para descanso: luces suaves, temperatura, sensores de presencia y persianas automáticas.',
    color: 'rgba(177,151,252,.2)',
    skus: ['LUZ-AMP-007','CTR-CLI-003','SEN-MOV-001','CTR-ESC-001','ENE-INT-001'],
    tags: ['Sueño','Clima','Sensores'],
  },
  {
    id: 'seguridad',
    icon: '🔒',
    nombre: 'Seguridad y acceso',
    desc: 'Cerradura digital, cámara, sensores de puerta y alarma. Control desde tu teléfono.',
    color: 'rgba(255,107,107,.2)',
    skus: ['SEG-CDA-004','SEN-OPN-001','SEN-MOV-001','SEG-CAM-001','CEB-HUB-001'],
    tags: ['Acceso','Monitoreo','Alerta'],
  },
  {
    id: 'energia',
    icon: '⚡',
    nombre: 'Energía eficiente',
    desc: 'Monitorea y reduce el consumo con interruptores inteligentes, enchufes medidores y respaldo UPS.',
    color: 'rgba(243,201,105,.2)',
    skus: ['ENE-REL-001','ENE-INT-001','ENE-ENC-001','BCK-UPS-001','ENE-MED-001'],
    tags: ['Ahorro','Monitoreo','Respaldo'],
  },
  {
    id: 'oficina',
    icon: '💼',
    nombre: 'Oficina productiva',
    desc: 'Red Wi-Fi estable, iluminación ajustable, control de acceso y automatizaciones para reuniones.',
    color: 'rgba(99,189,255,.2)',
    skus: ['NET-ROU-001','LUZ-AMP-001','SEG-CDA-004','CTR-CLI-001','ENE-INT-001'],
    tags: ['Red','Luz','Acceso'],
  },
  {
    id: 'exterior',
    icon: '🌿',
    nombre: 'Exterior y jardín',
    desc: 'Iluminación exterior, riego automático, sensores ambientales y cámaras de vigilancia.',
    color: 'rgba(163,230,53,.2)',
    skus: ['LUZ-FOC-002','SEN-MOV-008','SEG-CAM-001','ENE-REL-001','SEN-AMB-001'],
    tags: ['Jardín','Clima','Seguridad'],
  },
];

function renderSoluciones() {
  const grid = $('#solucionesGrid');
  if (!grid) return;
  grid.innerHTML = SOLUCIONES.map(sol => {
    const disponibles = sol.skus.map(sku => bySku(sku)).filter(Boolean);
    const total = disponibles.reduce((a,p) => a+(p.precio_clp||0), 0);
    return `
      <div class="solution-card" style="--sol-color:${sol.color}" onclick="openSolucion('${sol.id}')">
        <span class="solution-icon">${sol.icon}</span>
        <h3>${esc(sol.nombre)}</h3>
        <p>${esc(sol.desc)}</p>
        <div class="solution-tags">${sol.tags.map(t=>`<span class="solution-tag">${esc(t)}</span>`).join('')}</div>
        <div class="solution-price">${total ? 'Desde ' + fmt(total) : 'Precio a consultar'}</div>
        <div style="margin-top:12px;display:flex;gap:8px">
          <span style="color:var(--muted);font-size:12px">${disponibles.length} productos</span>
        </div>
      </div>`;
  }).join('');
}

function openSolucion(id) {
  const sol = SOLUCIONES.find(s => s.id === id);
  if (!sol) return;
  const modal = $('#solucionModal');
  if (!modal) return;
  const disponibles = sol.skus.map(sku => bySku(sku)).filter(Boolean);
  const total = disponibles.reduce((a,p) => a+(p.precio_clp||0), 0);
  const content = $('#solucionContent');
  if (content) content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:16px;flex-wrap:wrap">
      <div>
        <span style="font-size:36px">${sol.icon}</span>
        <h2 style="margin:8px 0 4px">${esc(sol.nombre)}</h2>
        <p style="color:var(--muted);margin:0">${esc(sol.desc)}</p>
      </div>
      <button class="btn ghost" onclick="closeSolucion()">Cerrar</button>
    </div>
    <div class="solution-products-list">
      ${disponibles.map(p => `
        <div class="sol-product-row">
          <img src="${esc(imgPath(p,'hero'))}" alt="${esc(p.nombre_web)}">
          <div>
            <b>${esc(p.nombre_web)}</b>
            <small>${esc(p.marca)} · ${esc(p.familia)}</small>
          </div>
          <span>${fmt(p.precio_clp)}</span>
        </div>`).join('')}
      ${disponibles.length === 0 ? '<p class="empty">Productos pendientes de validar.</p>' : ''}
    </div>
    <div style="border-top:1px solid rgba(255,255,255,.1);padding-top:16px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div><b style="font-size:22px;color:var(--gold)">${total ? 'Total referencial: ' + fmt(total) : 'Precio a consultar'}</b><small style="display:block;color:var(--muted);margin-top:4px">Precios referenciales. Instalación y configuración aparte.</small></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${disponibles.length > 0 ? `<button class="btn" onclick="addSolucionToCart('${sol.id}');closeSolucion()">Agregar solución completa</button>` : ''}
        <a class="btn ghost" href="carrito.html">Ver carro</a>
      </div>
    </div>`;
  modal.classList.add('open');
}

function closeSolucion() { $('#solucionModal')?.classList.remove('open'); }

function addSolucionToCart(id) {
  const sol = SOLUCIONES.find(s => s.id === id);
  if (!sol) return;
  const disponibles = sol.skus.map(sku => bySku(sku)).filter(Boolean);
  disponibles.forEach(p => { state.cart[p.sku] = (state.cart[p.sku]||0) + 1; });
  saveCart(); renderCart(); renderHomePanel(); renderProducts();
  toast(`${sol.icon} Solución "${sol.nombre}" agregada al carro`);
}

// ---- Trazabilidad y solicitudes ----
function trackingCode(id) { return `KR-ENV-${id.split('-').slice(-2).join('-')}`; }
function paymentLink(r)   { return `https://www.webpay.cl/form-pay/demo-kronos?orden=${encodeURIComponent(r.request_id)}&monto=${r.total_reference_clp||0}`; }

function whatsappMessage(r) {
  const items = (r.items||[]).slice(0,8).map(i => `• ${i.producto} x${i.cantidad}`).join('\n');
  return `Hola ${r.customer?.nombre||''}, somos Kronos.\n\nTu solicitud ${r.request_id} está registrada.\nTotal referencial: ${fmt(r.total_reference_clp)}.\nPago: ${r.payment?.status}.\nEntrega: ${r.shipping?.status}.\nSeguimiento: ${r.shipping?.tracking_code}.\n\nProductos:\n${items}\n\nLink de pago simulado: ${paymentLink(r)}\n\nTe contactaremos para confirmar stock, compatibilidad e instalación.`;
}
function emailSubject(r) { return `Kronos · confirmación solicitud ${r.request_id}`; }
function emailBody(r)    { return `${whatsappMessage(r)}\n\nCorreo preparado desde catálogo Kronos V40.`; }
function contactLinks(r) {
  const phone = normalizePhone(r.customer?.telefono);
  return {
    whatsapp_url:  phone ? `https://wa.me/${phone}?text=${encodeText(whatsappMessage(r))}` : '#',
    email_url:     r.customer?.email ? `mailto:${encodeURIComponent(r.customer.email)}?subject=${encodeText(emailSubject(r))}&body=${encodeText(emailBody(r))}` : '#',
    whatsapp_text: whatsappMessage(r),
    email_subject: emailSubject(r),
    email_body:    emailBody(r),
  };
}

function appendTimeline(r, type, note) {
  r.timeline = r.timeline || [];
  r.timeline.push({ at: nowIso(), type, note });
}

function createRequest(fd) {
  const items = cartItems();
  if (!items.length) { toast('Agrega productos antes de registrar la solicitud'); return null; }
  const id    = `KR-V40-${todayId()}-${String(getRequests().length+1).padStart(4,'0')}`;
  const total = cartTotal();
  const customer = {
    nombre:    fd.get('nombre'),
    telefono:  fd.get('telefono'),
    email:     fd.get('email'),
    comuna:    fd.get('comuna'),
    direccion: fd.get('direccion'),
  };
  setProfile(customer);
  const request = {
    request_id:   id,
    version:      'V40',
    created_at:   nowIso(),
    updated_at:   nowIso(),
    channel:      'Web catálogo',
    status:       'solicitud_creada',
    customer,
    request_type: fd.get('tipo'),
    priority:     fd.get('prioridad'),
    comment:      fd.get('comentario'),
    items: items.map(({product:p,qty}) => ({
      sku:              p.sku,
      producto:         p.nombre_web,
      marca:            p.marca,
      familia:          p.familia,
      cantidad:         qty,
      precio_unitario_clp: p.precio_clp||0,
      subtotal_clp:     (p.precio_clp||0)*qty,
    })),
    item_count:         items.reduce((a,x) => a+x.qty, 0),
    sku_count:          items.length,
    total_reference_clp: total,
    payment: {
      method:     fd.get('medio_pago'),
      status:     'pendiente',
      amount_clp: total,
      link:       paymentLink({request_id:id, total_reference_clp:total}),
    },
    shipping: {
      method:        fd.get('metodo_entrega'),
      status:        'pendiente_coordinar',
      tracking_code: trackingCode(id),
      tracking_url:  `https://tracking.kronos.local/${trackingCode(id)}`,
    },
    communication: {
      whatsapp_status: 'pendiente',
      email_status:    'pendiente',
      last_message:    'Solicitud registrada; falta confirmación interna.',
    },
    audit_points: {
      cliente:   true,
      contacto:  true,
      direccion: Boolean(customer.direccion),
      productos: items.length,
      total:     true,
      pago:      true,
      entrega:   true,
      tracking:  true,
      whatsapp:  true,
      email:     Boolean(customer.email),
    },
    timeline: [],
  };
  appendTimeline(request,'request_created','Solicitud creada desde carro V40.');
  const reqs = getRequests();
  reqs.unshift(request);
  setRequests(reqs);
  logEvent('request_created',{ request_id:id, sku_count:request.sku_count, item_count:request.item_count, total_reference_clp:total });
  clearCart();
  renderRequestResult(request);
  renderAccount(); renderOrders(); renderPayments(); renderTracking();
  return request;
}

function renderRequestResult(r) {
  if (!$('#resultado-solicitud')) return;
  $('#resultado-solicitud').style.display = 'block';
  const links = contactLinks(r);
  $('#requestResult').innerHTML = `
    <p><b>ID:</b> ${esc(r.request_id)}</p>
    <p><b>Total referencial:</b> ${fmt(r.total_reference_clp)}</p>
    <p><b>Seguimiento:</b> ${esc(r.shipping.tracking_code)}</p>
    <div class="card-actions" style="flex-wrap:wrap">
      <a class="btn ghost" href="pedidos.html">Ver pedidos</a>
      <a class="btn ghost" href="pagos.html">Ver pagos</a>
      <a class="btn ghost" href="seguimiento.html">Ver seguimiento</a>
      <a class="btn ghost" target="_blank" href="${esc(links.whatsapp_url)}">WhatsApp preparado</a>
      <a class="btn ghost" href="${esc(links.email_url)}">Correo preparado</a>
    </div>`;
  $('#resultado-solicitud').scrollIntoView({ behavior:'smooth' });
}

function seedDemos() {
  fetch('registros_demo/requests_demo_v37.json')
    .then(r => r.json())
    .then(d => {
      d = d.map(x => ({ ...x, version:'V40', request_id:String(x.request_id).replace('V37','V40'), channel:'Web catálogo' }));
      setRequests(d); setProfile(d[0].customer);
      renderAccount(); renderOrders(); renderPayments(); renderTracking(); renderHomePanel();
      toast('3 pruebas demo cargadas');
    }).catch(() => toast('No se pudieron cargar pruebas demo'));
}

// ---- Cuenta ----
function renderAccount() {
  const profile = getProfile();
  if ($('#profileForm') && profile)
    Object.entries(profile).forEach(([key,value]) => {
      const input = $(`#profileForm [name="${key}"]`);
      if (input) input.value = value || '';
    });
  const reqs  = getRequests();
  const total = reqs.reduce((a,r) => a+Number(r.total_reference_clp||0), 0);
  if ($('#accountSummary'))
    $('#accountSummary').innerHTML = reqs.length
      ? `<p><b>${reqs.length}</b> solicitudes registradas.</p>
         <p>Total referencial acumulado: <b>${fmt(total)}</b></p>
         <p>Último estado: ${esc(reqs[0]?.status||'')}</p>
         <div class="card-actions">
           <a class="btn ghost" href="pedidos.html">Pedidos</a>
           <a class="btn ghost" href="pagos.html">Pagos</a>
           <a class="btn ghost" href="seguimiento.html">Seguimiento</a>
         </div>`
      : 'Sin solicitudes todavía.';
  if ($('#activityTimeline')) {
    const labels = { app_loaded:'Página visitada', view_item:'Ficha revisada', add_cart:'Producto agregado', search:'Búsqueda realizada', request_created:'Solicitud registrada', profile_saved:'Perfil actualizado', add_wishlist:'Guardado en favoritos' };
    const events = getEvents().slice(-8).reverse();
    $('#activityTimeline').innerHTML = events.length
      ? events.map(e => `
          <div class="activity-item">
            <i></i>
            <div><b>${esc(labels[e.event_type]||'Actividad')}</b><small>${new Date(e.created_at).toLocaleString('es-CL')}</small></div>
          </div>`).join('')
      : '<p class="empty">Todavía no hay actividad registrada.</p>';
  }
}

function saveProfileForm(form) {
  const fd      = new FormData(form);
  const profile = Object.fromEntries(fd.entries());
  const message = $('#profileMessage');
  if (!profile.nombre?.trim())      { message.textContent='Ingresa tu nombre o empresa.'; form.nombre.focus(); return; }
  if (!validPhone(profile.telefono)) { message.textContent='Ingresa un teléfono válido de al menos 8 dígitos.'; form.telefono.focus(); return; }
  if (!validEmail(profile.email))    { message.textContent='Ingresa un correo electrónico válido.'; form.email.focus(); return; }
  setProfile(profile);
  logEvent('profile_saved');
  message.textContent = 'Perfil guardado correctamente.';
  renderHomePanel(); toast('Perfil actualizado');
}

// ---- Pedidos ----
function renderOrders() {
  if (!$('#ordersTable')) return;
  const reqs = getRequests();
  $('#ordersTable').innerHTML = reqs.length
    ? `<table>
        <thead><tr><th>ID</th><th>Cliente</th><th>Productos</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
        <tbody>${reqs.map(r => `
          <tr>
            <td><b>${esc(r.request_id)}</b></td>
            <td>${esc(r.customer?.nombre||'')}<br><small>${esc(r.customer?.telefono||'')} · ${esc(r.customer?.email||'')}</small></td>
            <td>${(r.items||[]).slice(0,4).map(i=>esc(i.producto)).join('<br>')}<br><small>${r.item_count||0} uds · ${r.sku_count||0} SKU</small></td>
            <td>${fmt(r.total_reference_clp)}</td>
            <td><b>${esc(r.status||'')}</b></td>
            <td>${new Date(r.created_at).toLocaleString('es-CL')}</td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : '<p class="empty">Sin pedidos o solicitudes registradas.</p>';
}

// ---- Pagos ----
function renderPayments() {
  if (!$('#paymentsTable')) return;
  const reqs = getRequests();
  $('#paymentsTable').innerHTML = reqs.length
    ? `<table>
        <thead><tr><th>ID</th><th>Cliente</th><th>Total</th><th>Método</th><th>Estado</th><th>Link</th></tr></thead>
        <tbody>${reqs.map(r => `
          <tr>
            <td><b>${esc(r.request_id)}</b></td>
            <td>${esc(r.customer?.nombre||'')}</td>
            <td>${fmt(r.total_reference_clp)}</td>
            <td>${esc(r.payment?.method||'')}</td>
            <td><b>${esc(r.payment?.status||'')}</b></td>
            <td><a class="mini-btn" target="_blank" href="${esc(r.payment?.link||paymentLink(r))}">Abrir link</a></td>
          </tr>`).join('')}
        </tbody>
      </table>`
    : '<p class="empty">Sin pagos registrados.</p>';
}

// ---- Seguimiento ----
function renderTracking() {
  if (!$('#trackingTable')) return;
  const reqs = getRequests();
  $('#trackingTable').innerHTML = reqs.length
    ? `<table>
        <thead><tr><th>ID</th><th>Cliente</th><th>Entrega</th><th>Tracking</th><th>Contacto</th></tr></thead>
        <tbody>${reqs.map(r => {
          const links = contactLinks(r);
          return `<tr>
            <td><b>${esc(r.request_id)}</b></td>
            <td>${esc(r.customer?.nombre||'')}<br><small>${esc(r.customer?.telefono||'')} · ${esc(r.customer?.email||'')}</small></td>
            <td><b>${esc(r.shipping?.status||'')}</b><br><small>${esc(r.shipping?.method||'')}</small></td>
            <td>${esc(r.shipping?.tracking_code||'')}<br><small>${esc(r.shipping?.tracking_url||'')}</small></td>
            <td><a class="mini-btn" target="_blank" href="${esc(links.whatsapp_url)}">WhatsApp</a> <a class="mini-btn" href="${esc(links.email_url)}">Correo</a></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>`
    : '<p class="empty">Sin seguimientos registrados.</p>';
}

// ---- Toast ----
function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---- Nav móvil dinámica ----
function ensureMobileNav() {
  if ($('.mobile-nav')) return;
  const page  = location.pathname.split('/').pop() || 'index.html';
  const items = [['index.html','⌂','Catálogo'],['marcas.html','◇','Marcas'],['carrito.html','▣','Carro'],['cuenta.html','○','Cuenta']];
  document.body.insertAdjacentHTML('beforeend',
    `<nav class="mobile-nav" aria-label="Navegación móvil">
      ${items.map(([href,icon,label]) =>
        `<a class="${page===href?'active':''}" href="${href}"><span>${icon}</span>${label}</a>`
      ).join('')}
    </nav>`);
}

// ---- Render todo ----
function renderAll() {
  renderKPIs(); renderFilters(); renderFamilies(); renderProducts();
  renderCart(); renderHomePanel(); renderAccount();
  renderOrders(); renderPayments(); renderTracking();
  renderWishlistDrawer(); renderCompareBar(); renderSoluciones();
}

// ---- Exponer funciones globales (para onclick en HTML) ----
Object.assign(window, {
  openDetail, closeDetail, addCart, removeCart,
  openVideoBySku, filterFamily,
  toggleWishlist, openWishlist, closeWishlist,
  toggleCompare, openCompareModal, closeCompareModal, clearCompare,
  openSolucion, closeSolucion, addSolucionToCart,
  clearCart, seedDemos,
});

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  ensureMobileNav();

  // Buscador
  if ($('#search'))
    $('#search').oninput = e => { state.query = e.target.value; logEvent('search',{query:state.query}); renderProducts(); };

  // Filtros
  if ($('#familyFilter'))
    $('#familyFilter').onchange = e => { state.family = e.target.value; renderFamilies(); renderProducts(); };
  if ($('#brandFilter'))
    $('#brandFilter').onchange  = e => { state.brand  = e.target.value; renderProducts(); };
  if ($('#sort'))
    $('#sort').onchange = renderProducts;
  if ($('#resetFilters'))
    $('#resetFilters').onclick = () => {
      state = { ...state, family:'Todos', brand:'Todas', query:'' };
      if ($('#search')) $('#search').value = '';
      renderAll();
    };

  // Carrito
  if ($('#clearCartBtn')) $('#clearCartBtn').onclick = clearCart;

  // Ficha modal
  if ($('#closeDetail')) $('#closeDetail').onclick = closeDetail;
  if ($('#detail')) $('#detail').addEventListener('click', e => { if (e.target.id==='detail') closeDetail(); });

  // Wishlist drawer
  if ($('#openWishlistBtn')) $('#openWishlistBtn').onclick = openWishlist;
  if ($('#closeWishlistBtn')) $('#closeWishlistBtn').onclick = closeWishlist;

  // Comparador modal
  if ($('#openCompareBtn')) $('#openCompareBtn').onclick = openCompareModal;
  if ($('#closeCompareBtn')) $('#closeCompareBtn').onclick = closeCompareModal;
  if ($('#compareModal')) $('#compareModal').addEventListener('click', e => { if (e.target.id==='compareModal') closeCompareModal(); });

  // Solución modal
  if ($('#solucionModal')) $('#solucionModal').addEventListener('click', e => { if (e.target.id==='solucionModal') closeSolucion(); });

  // Formulario de solicitud
  if ($('#requestForm'))
    $('#requestForm').addEventListener('submit', e => {
      e.preventDefault();
      const form = e.currentTarget, fd = new FormData(form), message = $('#requestMessage');
      if (!fd.get('nombre')?.trim())                   { message.textContent='Ingresa el nombre o empresa.'; form.nombre.focus(); return; }
      if (!validPhone(fd.get('telefono')))              { message.textContent='Ingresa un teléfono o WhatsApp válido.'; form.telefono.focus(); return; }
      if (fd.get('email') && !validEmail(fd.get('email'))) { message.textContent='Revisa el formato del correo electrónico.'; form.email.focus(); return; }
      message.textContent = '';
      const r = createRequest(fd);
      if (r) { form.reset(); toast(`Solicitud ${r.request_id} registrada`); }
    });

  // Formulario de perfil
  if ($('#profileForm'))
    $('#profileForm').addEventListener('submit', e => { e.preventDefault(); saveProfileForm(e.currentTarget); });

  // Botones seed demo
  $$('#seedDemoBtn').forEach(btn => btn.onclick = seedDemos);

  // Render inicial
  renderAll();
  logEvent('app_loaded',{ version:'V40', products:products.length, families:families.length, brands:brands.length, page:location.pathname.split('/').pop()||'index.html' });
});
