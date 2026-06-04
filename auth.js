// ============================================================
//  ÉXITO COMPARTIDO — Sistema de Gestión Financiera
//  Archivo: auth.js
//  Descripción: Seguridad compartida — Se incluye en TODAS las páginas. Verifica sesión activa, maneja permisos por rol y expone funciones globales (EC.*).
//  ----------------------------------------------------------
//  🔗 ENLACE APP SCRIPT (BASE DE DATOS):
//     https://script.google.com/macros/s/AKfycbzffZlfscfcQ8dr5VTE6v3v7N-zIusxodt863ldHt4CmaTOPbJ1tTwSiyW45BDmirJr/exec
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

  // Exponer globalmente para que cada página los use
  window.EC = {
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
          padding:11px 18px;border-radius:10px;font-size:13px;font-weight:500;z-index:9999;
          transition:transform .3s ease;display:flex;align-items:center;gap:8px;
          box-shadow:0 4px 20px rgba(0,0,0,.4);white-space:nowrap;
          font-family:'DM Sans',sans-serif;`;
        document.body.appendChild(el);
      }
      el.style.background = tipo==='error' ? '#e74c3c' : tipo==='warn' ? '#f39c12' : '#2ecc71';
      el.style.color      = '#fff';
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
