// ============================================================
//  ÉXITO COMPARTIDO — Sistema de Gestión Financiera
//  Archivo: auth.js
//  Descripción: Seguridad compartida — Se incluye en TODAS las páginas. Verifica sesión activa, maneja permisos por rol y expone funciones globales (EC.*).
//  ----------------------------------------------------------
//  🔗 ENLACE APP SCRIPT (BASE DE DATOS):
//     https://script.google.com/macros/s/AKfycby-BrSpUIdQ_v08SYjsg7lFDcMCMxfgbqAjPIlfZZGFRVEoyyTHrRIzJmZFMoUIDAzTFw/exec
//  ----------------------------------------------------------
//  ⚠️  Si necesitas cambiar la URL de la base de datos,
//      busca la constante API_URL y reemplaza el valor.
// ============================================================
// ============================================================
// auth.js — Seguridad compartida para todas las páginas
// Todas las páginas del sistema deben incluir este script
// PRIMERO antes de cualquier otro código
// ============================================================

(function verificarSesion(){
  const SESSION = sessionStorage.getItem('ec_user');
  const ROL     = sessionStorage.getItem('ec_rol');
  const API     = sessionStorage.getItem('api_url');

  // Si no hay sesión, redirigir al login inmediatamente
  if(!SESSION || !ROL || !API){
    window.location.replace('index.html');
    // Detener todo lo demás
    throw new Error('SIN_SESION');
  }

  // Parsear sesión
  let usuario;
  try{ usuario = JSON.parse(SESSION); }
  catch(e){ window.location.replace('index.html'); throw new Error('SESION_INVALIDA'); }

  if(!usuario || !usuario.email){
    window.location.replace('index.html');
    throw new Error('SESION_INVALIDA');
  }

  // ============================================================
  //  CAPA DE CACHÉ DE DATOS (stale-while-revalidate)
  //  - Las lecturas (GET al Apps Script) se guardan en memoria y en
  //    sessionStorage, así al cambiar de página los datos aparecen al instante.
  //  - Si el dato tiene menos de FRESH_MS se usa tal cual (sin red).
  //  - Si tiene menos de MAX_MS se muestra al instante y se actualiza en
  //    segundo plano; si cambió, se dispara el evento 'ec:datos'.
  //  - Cualquier escritura (POST agregar/actualizar) limpia la caché.
  //  - Las peticiones idénticas simultáneas se unifican en una sola.
  // ============================================================
  const FRESH_MS = 15 * 1000;
  const MAX_MS   = 10 * 60 * 1000;
  const PREFIJO  = 'ec_c:';
  const mem      = new Map();
  const enVuelo  = new Map();
  let generacion = 0;
  let timerEvento = null;
  const fetchOriginal = window.fetch.bind(window);

  function cacheGet(k){
    if(mem.has(k)) return mem.get(k);
    try{
      const raw = sessionStorage.getItem(PREFIJO + k);
      if(raw){ const e = JSON.parse(raw); mem.set(k, e); return e; }
    }catch(_){}
    return null;
  }
  function cacheSet(k, texto){
    const e = {t: Date.now(), d: texto};
    mem.set(k, e);
    try{ sessionStorage.setItem(PREFIJO + k, JSON.stringify(e)); }
    catch(_){ /* sin espacio: queda solo en memoria */ }
  }
  function cacheLimpiar(){
    generacion++;
    mem.clear();
    try{
      Object.keys(sessionStorage).forEach(k=>{ if(k.indexOf(PREFIJO)===0) sessionStorage.removeItem(k); });
    }catch(_){}
  }
  function esLectura(url, init){
    const metodo = ((init && init.method) || 'GET').toUpperCase();
    if(metodo !== 'GET') return false;
    if(typeof url !== 'string' || url.indexOf(API) !== 0) return false;
    if(url.indexOf('accion=') < 0 || url.indexOf('accion=login') >= 0) return false;
    if(url.indexOf('tab=usuarios') >= 0) return false; // nunca se guarda en caché (contiene contraseñas)
    return true;
  }
  function respuesta(texto){
    return new Response(texto, {status:200, headers:{'Content-Type':'application/json'}});
  }
  function pedirRed(url){
    if(enVuelo.has(url)) return enVuelo.get(url);
    const gen = generacion;
    const p = fetchOriginal(url).then(r=>r.text()).then(txt=>{
      let ok = false;
      try{ ok = JSON.parse(txt).ok === true; }catch(_){}
      if(ok && gen === generacion) cacheSet(url, txt);
      return txt;
    }).finally(()=>{ enVuelo.delete(url); });
    enVuelo.set(url, p);
    return p;
  }
  function avisarCambio(){
    clearTimeout(timerEvento);
    timerEvento = setTimeout(()=>window.dispatchEvent(new Event('ec:datos')), 300);
  }

  window.fetch = function(url, init){
    // Escrituras al Apps Script: limpiar caché al terminar
    if(typeof url === 'string' && url.indexOf(API) === 0 && init && String(init.method||'').toUpperCase() === 'POST'){
      const esLogin = typeof init.body === 'string' && init.body.indexOf('"accion":"login"') >= 0;
      if(!esLogin){
        return fetchOriginal(url, init).then(
          r=>{ cacheLimpiar(); return r; },
          e=>{ cacheLimpiar(); throw e; }
        );
      }
    }
    if(!esLectura(url, init)) return fetchOriginal(url, init);

    // cache:'reload' = forzar lectura fresca del servidor (y refrescar la caché)
    if(init && init.cache === 'reload') return pedirRed(url).then(respuesta);

    const e = cacheGet(url);
    const edad = e ? Date.now() - e.t : Infinity;
    if(e && edad < FRESH_MS) return Promise.resolve(respuesta(e.d));
    if(e && edad < MAX_MS){
      pedirRed(url).then(txt=>{ if(txt !== e.d) avisarCambio(); }).catch(()=>{});
      return Promise.resolve(respuesta(e.d));
    }
    return pedirRed(url).then(respuesta);
  };

  // ============================================================
  //  CARGA DIFERIDA DE LIBRERÍAS (PDF / imágenes)
  // ============================================================
  const LIBS = {
    jspdf   : 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    autotable: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
    html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  };
  const GRUPOS = { pdf:['jspdf','autotable'], canvas:['html2canvas'] };
  const libsPromesas = {};
  const libsListas   = new Set();
  function cargarScript(nombre){
    if(libsPromesas[nombre]) return libsPromesas[nombre];
    libsPromesas[nombre] = new Promise((res, rej)=>{
      const s = document.createElement('script');
      s.src = LIBS[nombre]; s.async = true;
      s.onload = ()=>{ libsListas.add(nombre); res(); };
      s.onerror = ()=>{ delete libsPromesas[nombre]; rej(new Error('No se pudo cargar '+nombre)); };
      document.head.appendChild(s);
    });
    return libsPromesas[nombre];
  }
  async function cargarGrupo(grupo){
    for(const n of (GRUPOS[grupo]||[])) await cargarScript(n); // en orden: jsPDF antes que autoTable
  }

  // Conexión anticipada al CDN
  try{
    const pc = document.createElement('link');
    pc.rel = 'preconnect'; pc.href = 'https://cdnjs.cloudflare.com'; pc.crossOrigin = '';
    document.head.appendChild(pc);
  }catch(_){}

  // Exponer globalmente para que cada página los use
  window.EC = {
    // ── Datos / caché ────────────────────────────────────────
    silencioso : false,
    // Lee una pestaña completa de la base de datos (usa la caché)
    leer: async function(tab){
      const r = await fetch(`${API}?accion=leer&tab=${tab}`);
      const j = await r.json();
      return j.ok ? (j.data||[]) : [];
    },
    leerVarias: function(tabs){ return Promise.all(tabs.map(t=>EC.leer(t))); },
    limpiarCache: cacheLimpiar,
    // Ejecuta fn cuando llegan datos más nuevos en segundo plano (si no hay un modal abierto)
    alActualizar: function(fn){
      window.addEventListener('ec:datos', ()=>{
        if(document.querySelector('.modal-overlay.open')) return;
        EC.silencioso = true;
        Promise.resolve().then(fn).catch(()=>{}).finally(()=>{ EC.silencioso = false; });
      });
    },
    // Librerías pesadas bajo demanda: 'pdf' (jsPDF + autoTable) y 'canvas' (html2canvas)
    cargarLib: async function(...grupos){ for(const g of grupos) await cargarGrupo(g); },
    precargarLib: function(...grupos){
      const ir = ()=>EC.cargarLib(...grupos).catch(()=>{});
      if('requestIdleCallback' in window) requestIdleCallback(ir, {timeout:4000});
      else setTimeout(ir, 2000);
    },
    // Envuelve funciones globales para que carguen las librerías antes de ejecutarse
    conLib: function(nombres, ...grupos){
      nombres.forEach(n=>{
        const f = window[n];
        if(typeof f !== 'function') return;
        window[n] = async function(...args){
          const hayLibs = grupos.every(g=>(GRUPOS[g]||[]).every(x=>libsListas.has(x)));
          if(!hayLibs){
            EC.showLoading('Preparando documento...');
            try{ await EC.cargarLib(...grupos); }
            catch(e){ EC.hideLoading(); EC.toast('No se pudo cargar el generador de documentos. Revisa tu conexión.','error'); return; }
            EC.hideLoading();
          }
          return f.apply(this, args);
        };
      });
    },

    usuario : usuario,
    rol     : ROL,
    api     : API,
    esAdmin : ROL === 'admin',

    // Cerrar sesión
    cerrarSesion: function(){
      sessionStorage.clear();
      window.location.replace('index.html');
    },

    // Llenar info del usuario en el sidebar
    initSidebar: function(){
      const ini = usuario.nombre.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase();
      const elAvatar = document.getElementById('sb-avatar');
      const elName   = document.getElementById('sb-name');
      const elRole   = document.getElementById('sb-role');
      if(elAvatar) elAvatar.textContent = ini;
      if(elName)   elName.textContent   = usuario.nombre;
      if(elRole)   elRole.textContent   = {admin:'Administrador', contador:'Contador / Tesorero'}[ROL] || ROL;

      // Mostrar sección de usuarios solo para admin
      const navAdmin    = document.getElementById('nav-admin-group');
      const navUsuarios = document.getElementById('nav-usuarios');
      if(navAdmin)    navAdmin.style.display    = ROL === 'admin' ? '' : 'none';
      if(navUsuarios) navUsuarios.style.display = ROL === 'admin' ? '' : 'none';
    },

    // Verificar permiso: si no es admin, bloquear acción
    soloAdmin: function(callback){
      if(ROL !== 'admin'){
        EC.toast('Solo el administrador puede realizar esta acción','error');
        return false;
      }
      if(callback) callback();
      return true;
    },

    // Mostrar/ocultar botones según rol
    aplicarPermisos: function(){
      // Ocultar botones de eliminar y editar para contador
      if(ROL !== 'admin'){
        document.querySelectorAll('.solo-admin').forEach(el => el.style.display='none');
      }
    },

    // Toast de notificaciones
    toast: function(msg, tipo='ok'){
      let el = document.getElementById('ec-toast');
      if(!el){
        el = document.createElement('div');
        el.id = 'ec-toast';
        el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);
          padding:10px 16px;border-radius:6px;font-size:13px;font-weight:bold;z-index:9999;
          transition:transform .3s ease;display:flex;align-items:center;gap:8px;
          box-shadow:0 2px 8px rgba(16,24,32,.15);white-space:nowrap;border:1px solid;
          font-family:Arial,Helvetica,sans-serif;`;
        document.body.appendChild(el);
      }
      if(tipo==='error'){ el.style.background = '#fbe9e7'; el.style.color = '#b3261e'; el.style.borderColor = '#f0c4c0'; }
      else if(tipo==='warn'){ el.style.background = '#fbf2e3'; el.style.color = '#8a6116'; el.style.borderColor = '#ecdcb3'; }
      else { el.style.background = '#e7f3ec'; el.style.color = '#1d7a4c'; el.style.borderColor = '#c3e2d2'; }
      el.textContent      = msg;
      el.style.transform  = 'translateX(-50%) translateY(0)';
      clearTimeout(window._ecToastTimer);
      window._ecToastTimer = setTimeout(()=>{ el.style.transform='translateX(-50%) translateY(80px)'; }, 3200);
    },

    // Llamada a la API de Google Sheets
    api_get: async function(accion, tab, extras={}){
      const url = `${API}?accion=${accion}&tab=${tab}`;
      const r   = await fetch(url);
      const j   = await r.json();
      return j.ok ? j.data : [];
    },

    api_post: async function(accion, tab, datos={}){
      const r = await fetch(API, {
        method : 'POST',
        body   : JSON.stringify({ accion, tab, ...datos })
      });
      const j = await r.json();
      return j;
    },

    // Loading
    showLoading: function(msg='Cargando...'){
      if(EC.silencioso) return; // refresco en segundo plano: sin pantalla de carga
      const el = document.getElementById('loading-overlay');
      const tx = document.getElementById('loading-text');
      if(el) el.classList.add('show');
      if(tx) tx.textContent = msg;
    },
    hideLoading: function(){
      const el = document.getElementById('loading-overlay');
      if(el) el.classList.remove('show');
    },

    // Sidebar hamburguesa
    openSidebar:  function(){ document.getElementById('sidebar')?.classList.add('open'); document.getElementById('overlay')?.classList.add('open'); },
    closeSidebar: function(){ document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('overlay')?.classList.remove('open'); },

    // Fecha formateada
    fmtDate: function(s){ if(!s)return'—'; const p=String(s).split('T')[0].split('-'); return `${p[2]}/${p[1]}/${p[0]}`; },
    fmt:     function(v){ return '$'+Number(v||0).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2}); },
    hoy:     function(){ return new Date().toISOString().split('T')[0]; },
  };

})();
