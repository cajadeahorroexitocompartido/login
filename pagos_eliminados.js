// ============================================================
//  ÉXITO COMPARTIDO — Gestor de pagos eliminados
//  Archivo: pagos_eliminados.js
//  Descripción: Guarda localmente los IDs de pagos eliminados
//  para filtrarlos en todas las páginas sin depender del servidor.
//  ------------------------------------------------------------
//  🔗 ENLACE APP SCRIPT (BASE DE DATOS):
//     https://script.google.com/macros/s/AKfycbxLsaiL7CJBCC7frd8FuTeCLHRC1qZFKgu1HN6fy6-gJmtDOg9v9YzPHAQ1mfpOS_Ka/exec
// ============================================================

const PagosEliminados = {

  // Clave en localStorage
  KEY: 'ec_pagos_eliminados',

  // Obtener todos los IDs eliminados
  obtener: function(){
    try{
      return JSON.parse(localStorage.getItem(this.KEY) || '[]');
    }catch(e){ return []; }
  },

  // Agregar un ID a la lista
  agregar: function(id){
    const lista = this.obtener();
    if(!lista.includes(id)){
      lista.push(id);
      localStorage.setItem(this.KEY, JSON.stringify(lista));
    }
  },

  // Verificar si un pago está eliminado
  estaEliminado: function(id){
    return this.obtener().includes(id);
  },

  // Filtrar un array de pagos quitando los eliminados
  filtrar: function(pagos){
    const eliminados = this.obtener();
    if(eliminados.length === 0) return pagos;
    return pagos.filter(p => !eliminados.includes(p.ID));
  },

};
