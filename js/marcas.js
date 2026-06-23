
const products = window.KRONOS_PRODUCTS || [];
const families = window.KRONOS_FAMILIES || [];
const brands = window.KRONOS_BRANDS || [];
const profiles = window.KRONOS_BRAND_PROFILES || [];
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const fmt = v => v ? '$' + Number(v).toLocaleString('es-CL') : 'Cotizar';
function img(p){ return (p.media && (p.media.hero || p.media.videoThumb)) || ''; }
function slug(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function profileFor(name){ return profiles.find(p => p.marca === name) || {marca:name, descripcion:'Marca incorporada al catálogo Kronos.', enfoque:'Soluciones conectadas.', familias:[], productos_destacados:[]}; }
function countFamiliesFor(name){ return [...new Set(products.filter(p=>p.marca===name).map(p=>p.familia))].length; }
function renderStats(){ $('#brandTotal').textContent = brands.length; $('#productTotal').textContent = products.length; $('#familyTotal').textContent = families.length; }
function brandCard(profile){
  const p0 = (profile.productos_destacados || [])[0];
  const familyText = (profile.familias || []).slice(0,3).map(f=>f.familia).join(' · ') || 'Catálogo Kronos';
  return `<button class="brand-card-detailed" data-brand="${esc(profile.marca)}">
    <div class="brand-logo-mark">${esc(profile.marca.slice(0,2).toUpperCase())}</div>
    <div class="brand-card-copy">
      <b>${esc(profile.marca)}</b>
      <small>${profile.cantidad || 0} productos · ${countFamiliesFor(profile.marca)} familias</small>
      <p>${esc(profile.enfoque || '')}</p>
      <span>${esc(familyText)}</span>
    </div>
    ${p0 && img(p0) ? `<img src="${esc(img(p0))}" alt="${esc(profile.marca)}">` : ''}
  </button>`;
}
function renderCards(){
  const q = ($('#brandSearch')?.value || '').toLowerCase().trim();
  const data = profiles.filter(p=>{
    const hay = `${p.marca} ${p.descripcion} ${p.enfoque} ${(p.familias||[]).map(f=>f.familia).join(' ')}`.toLowerCase();
    return !q || hay.includes(q);
  });
  $('#brandCards').innerHTML = data.map(brandCard).join('');
  $$('[data-brand]').forEach(el => el.onclick = () => selectBrand(el.dataset.brand));
}
function productMini(p){
  return `<article class="brand-mini-product">
    <img src="${esc(img(p))}" alt="${esc(p.nombre_web)}">
    <div><b>${esc(p.nombre_web)}</b><small>${esc(p.sku)} · ${esc(p.familia)}</small><span>${fmt(p.precio_clp)}</span></div>
  </article>`;
}
function selectBrand(name){
  const p = profileFor(name);
  const link = `index.html?marca=${encodeURIComponent(name)}#catalogo`;
  const priceText = p.precio_desde_clp || p.precio_hasta_clp ? `${fmt(p.precio_desde_clp)} a ${fmt(p.precio_hasta_clp)}` : 'Cotizar';
  $('#brandDetail').innerHTML = `<div class="brand-detail-head">
    <div class="brand-logo-large">${esc(name.slice(0,2).toUpperCase())}</div>
    <div><h2>${esc(name)}</h2><p>${esc(p.descripcion)}</p></div>
    <a class="btn" href="${esc(link)}">Ver productos de ${esc(name)}</a>
  </div>
  <div class="brand-detail-grid">
    <div class="operation-card">
      <h3>Qué aporta al catálogo</h3>
      <p>${esc(p.uso_comercial || p.enfoque || '')}</p>
      <div class="brand-kpis-inline"><span><b>${p.cantidad||0}</b> productos</span><span><b>${countFamiliesFor(name)}</b> familias</span><span><b>${priceText}</b> rango</span></div>
    </div>
    <div class="operation-card">
      <h3>Familias asociadas</h3>
      <div class="brand-family-tags">${(p.familias||[]).map(f=>`<a href="index.html?marca=${encodeURIComponent(name)}&familia=${encodeURIComponent(f.familia)}#catalogo">${esc(f.familia)} <small>${f.cantidad}</small></a>`).join('') || '<p class="empty">Sin familias asociadas.</p>'}</div>
    </div>
  </div>
  <div class="operation-card brand-products-block">
    <div class="section-title compact"><div><h3>Productos destacados de ${esc(name)}</h3><p>Selección inicial tomada del maestro de productos.</p></div><a class="btn ghost" href="${esc(link)}">Abrir catálogo filtrado</a></div>
    <div class="brand-products-preview">${(p.productos_destacados||[]).map(productMini).join('')}</div>
  </div>`;
  $$('#brandCards .brand-card-detailed').forEach(x=>x.classList.toggle('active', x.dataset.brand === name));
  $('#panel-marca').scrollIntoView({behavior:'smooth'});
}
document.addEventListener('DOMContentLoaded', () => {
  renderStats();
  renderCards();
  $('#brandSearch').addEventListener('input', renderCards);
  const params = new URLSearchParams(location.search);
  const selected = params.get('marca') || (profiles[0] && profiles[0].marca);
  if(selected) selectBrand(selected);
});
