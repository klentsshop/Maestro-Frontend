'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { cleanPrice } from '@/lib/utils'; // ✅ Usamos tu utilidad global

const CartContext = createContext();
const avisosDados = new Set();
const stockLocalCache = new Map();

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [propina, setPropina] = useState(0); // 👈 Estado para el % de propina
  const [montoManual, setMontoManual] = useState(0); // 👈 Campo "Otro" (Monto manual)
  const [tipoOrden, setTipoOrden] = useState('mesa');
  const [ordenActivaId, setOrdenActivaId] = useState(null);
  const [ordenMesa, setOrdenMesa] = useState(null);
   // 💾 1. Al iniciar: Recuperar Carrito y Tipo de Orden del navegador
  useEffect(() => {
    // Definimos las constantes extrayendo los datos del almacenamiento
    const savedItems = localStorage.getItem('talanquera_cart');
    const savedTipo = localStorage.getItem('talanquera_tipo_orden');

    // Si hay items guardados, los cargamos
    if (savedItems) {
      try {
        const parsed = JSON.parse(savedItems);
        if (parsed && parsed.length > 0) setItems(parsed);
      } catch (e) {
        console.error("Error parseando el carrito del localStorage", e);
      }
    }

    // ✅ Si hay un tipo de orden guardado (domicilio/llevar), lo aplicamos
    if (savedTipo) {
      setTipoOrden(savedTipo);
    }

    // 🔥 SINCRONIZACIÓN ENTRE PESTAÑAS (Para que no se crucen las órdenes)
    const syncTabs = (e) => {
      if (e.key === 'talanquera_cart') {
        const newValue = e.newValue ? JSON.parse(e.newValue) : [];
        setItems(newValue);
      }
      // Sincronizar también el radio si se cambia en otra pestaña abierta
      if (e.key === 'talanquera_tipo_orden') {
        setTipoOrden(e.newValue || 'mesa');
      }
    };

    window.addEventListener('storage', syncTabs);
    return () => window.removeEventListener('storage', syncTabs);
  }, []);

    // 💾 2. Guardado Automático con "Amortiguador" (Debounce)
  // Esto evita que el sistema titile al cargar una mesa desde Sanity
// 💾 2. Guardado Automático con "Detector de Huérfanos" (Blindaje Mesa 0)
  useEffect(() => {
    // 1. Si el carrito está vacío, limpiamos disco y paramos
    if (items.length === 0) {
        localStorage.removeItem('talanquera_cart');
        return;
    }

    // 2. 🛡️ BISTURÍ: Identificamos el origen de los platos
    const tienePlatosDeSanity = items.some(it => it.esDeOrdenGuardada || it._key);
    const tienePlatosNuevos = items.some(it => !it.esDeOrdenGuardada && !it._key);

    const saveTimeout = setTimeout(() => {
      // 🚨 LA REGLA DE ORO CONTRA DUPLICADOS:
      // Si la tablet cree que NO hay una orden activa (null) pero los platos dicen que
      // YA venían de Sanity, bloqueamos el guardado. Es un "fantasma" de una mesa ya cobrada.
      if (tienePlatosDeSanity && !tienePlatosNuevos && !ordenActivaId) {
          console.warn("🚫 [BLOQUEO_FANTASMA]: Evitando creación de Mesa 0 duplicada.");
          return; 
      }

      // 3. Si pasa el filtro, guardamos normal (Tu lógica original intacta)
      localStorage.setItem('talanquera_cart', JSON.stringify(items));
      localStorage.setItem('talanquera_tipo_orden', tipoOrden || 'mesa');
    }, 150);

    return () => clearTimeout(saveTimeout);
    
    // 🛡️ RECUERDA: Agregamos ordenActivaId a las dependencias para que el radar funcione
  }, [items, tipoOrden, ordenActivaId]);
  
  const addProduct = async (product) => {
    const pId = product._id || product.id;
    const insumoId = product.insumoVinculado?._ref;

    // --- 🍎 1. LÓGICA VISUAL ---
    const precioNum = cleanPrice(product.precio);

    setItems(prev => {
      // 🛡️ COMPARACIÓN PRO: Busca el mismo producto Y que tenga el MISMO comentario
      const existingIdx = prev.findIndex(it => 
        (it._id || it.id) === pId && 
       (it.comentario === (product.comentario || '')) &&
            !it._key // <--- 🔑 CORAZÓN DEL CAMBIO: Solo agrupa si es nuevo localmente
        );
      if (existingIdx !== -1) {
        const copy = [...prev];
        const itemActual = copy[existingIdx];
        const nuevaCantidad = itemActual.cantidad + 1;

        copy[existingIdx] = { 
                ...itemActual,           
                ...product,              // Re-sincronizamos datos frescos del producto
                _id: pId,                
                cantidad: nuevaCantidad, 
                subtotalNum: nuevaCantidad * precioNum 
            };
            return copy;
        }

      return [...prev, { 
            ...product, 
            _id: pId, 
            lineId: crypto.randomUUID(), // Identidad única para la APK
            cantidad: 1, 
            precioNum, 
            subtotalNum: precioNum, 
            comentario: product.comentario || '', 
            categoria: (product.categoria || "").toString().toUpperCase().trim(),
            seImprime: product.seImprime ?? true 
            // Nota: Al no llevar _key aquí, forzamos que sea una línea nueva en Sanity al guardar.
        }];
    });
    // --- 🛡️ LÓGICA DE INVENTARIO MULTI-INSUMO (Bisturí Senior Corregido) ---
// --- 🛡️ ESCUDO PREVENTIVO MULTI-INSUMO (Fusión Blindada) ---
if (product.controlaInventario) {
  // 1. Armamos la receta (Soporta ambos formatos)
  const receta = product.recetaInsumos || (product.insumoVinculado?._ref ? [{ 
      insumoId: product.insumoVinculado._ref, 
      cantidad: Number(product.cantidadADescontar) || 1 
  }] : []);

  if (receta.length > 0) {
    // A. VALIDACIÓN LOCAL: Revisa todos los ingredientes antes de seguir
    for (const item of receta) {
      const dispLocal = stockLocalCache.get(item.insumoId) ?? (Number(product.stockActual) || 0);
      if (Number(dispLocal) < item.cantidad) {
        alert(`🚫 STOCK AGOTADO LOCAL: Falta ingrediente para "${product.nombre}".`);
        return; 
      }
    }

    // B. DESCUENTO PREVENTIVO LOCAL: Restamos todos del caché de la tablet
    receta.forEach(r => {
      const actual = stockLocalCache.get(r.insumoId) ?? (Number(product.stockActual) || 0);
      stockLocalCache.set(r.insumoId, actual - r.cantidad);
    });

    // C. LLAMADA AL SERVIDOR: Validamos con el insumo principal
    const principal = receta[0];
    fetch('/api/inventario/descontar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insumoId: principal.insumoId, cantidad: principal.cantidad })
    })
    .then(async (res) => {
      const data = await res.json();
      if (res.status === 409) {
        // Si el servidor rebota, corregimos el caché y revertimos UI
        stockLocalCache.set(principal.insumoId, Number(data.disponible || 0));
        setItems(prev => {
          const idx = prev.findIndex(it => (it._id || it.id) === pId && !it._key && (it.comentario === (product.comentario || '')));
          if (idx === -1) return prev;
          const copy = [...prev];
          if (copy[idx].cantidad > 1) {
            const n = copy[idx].cantidad - 1;
            return copy.map((it, i) => i === idx ? { ...it, cantidad: n, subtotalNum: n * precioNum } : it);
          }
          return copy.filter((_, i) => i !== idx);
        });
        alert(`🚫 STOCK AGOTADO: Solo quedan ${data.disponible} unidades.`);
      } else if (res.ok) {
        // Sincronizamos con el stock real del servidor
        stockLocalCache.set(principal.insumoId, Number(data.nuevoStock));
      }
    });
  }
}
};
  const setCartFromOrden = (platosOrdenados = [], tipoDeSanity = 'mesa') => {
    // 🧹 Limpiamos el rastro del localStorage antes de cargar lo nuevo
    localStorage.removeItem('talanquera_cart');
    
    // Seteamos el tipo de orden inmediatamente
    setTipoOrden(tipoDeSanity);

    const reconstruido = platosOrdenados.map(p => ({
      _key: p._key,
      lineId: p._key || crypto.randomUUID(),
      _id: p._id || p.id || p.nombrePlato,
      nombre: p.nombrePlato,
      precio: cleanPrice(p.precioUnitario),
      cantidad: Number(p.cantidad) || 1,
      precioNum: cleanPrice(p.precioUnitario),
      subtotalNum: cleanPrice(p.precioUnitario) * (Number(p.cantidad) || 1),
      comentario: p.comentario || "",
      categoria: p.categoria || "",
      controlaInventario: p.controlaInventario || false,
      insumoVinculado: p.insumoVinculado || null,
      seImprime: p.seImprime === true,
      cantidadADescontar: p.cantidadADescontar || 0
    }));

    // Actualizamos el estado. El "Amortiguador" del useEffect de arriba 
    // se encargará de que esto no cause un parpadeo violento.
    setItems(reconstruido);
  };

 const decrease = async (lineId) => {
  const itemADisminuir = items.find(i => i.lineId === lineId);
  if (!itemADisminuir) return;

  // 1. Identificamos si tiene receta nueva o insumo antiguo
  const tieneReceta = Array.isArray(itemADisminuir.recetaInsumos) && itemADisminuir.recetaInsumos.length > 0;
  const insumoIdLegacy = itemADisminuir.insumoVinculado?._ref || itemADisminuir.insumoId;

  if (itemADisminuir.controlaInventario) {
    // 🛡️ Preparamos el array de items para devolver de forma atómica
    let itemsParaDevolver = [];

    if (tieneReceta) {
      // CASO NUEVO: Arroz Caribeño (Verdura + Camarón)
      itemsParaDevolver = itemADisminuir.recetaInsumos.map(r => ({
        insumoId: r.insumoId,
        cantidad: Number(r.cantidad) || 1
      }));
    } else if (insumoIdLegacy) {
      // CASO ANTIGUO: Insumo único
      itemsParaDevolver = [{
        insumoId: insumoIdLegacy,
        cantidad: Number(itemADisminuir.cantidadADescontar) || 1
      }];
    }

    // 🚀 Disparamos la devolución solo si hay algo que devolver
    if (itemsParaDevolver.length > 0) {
      fetch('/api/inventario/devolver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsParaDevolver })
      })
      .then(res => {
        if (res.ok) {
          window.dispatchEvent(new Event('inventarioActualizado'));
        }
      })
      .catch(err => console.error("Error al devolver stock:", err));
    }
  }

  // --- Lógica de UI (Se mantiene EXACTAMENTE igual a tu original) ---
  setItems(prev => {
    const idx = prev.findIndex(i => i.lineId === lineId);
    if (idx === -1) return prev;
    const copy = [...prev];
    if (copy[idx].cantidad <= 1) {
      return prev.filter(i => i.lineId !== lineId);
    } else {
      const nuevaCant = copy[idx].cantidad - 1;
      copy[idx] = { 
        ...copy[idx], 
        cantidad: nuevaCant,
        subtotalNum: nuevaCant * (copy[idx].precioNum || 0)
      };
      return copy;
    }
  });
};

const clear = () => {
    setItems([]);
    setPropina(0);
    setMontoManual(0);
    setTipoOrden('mesa');
    avisosDados.clear(); // 🛡️ Limpia alertas de la mesa anterior
    stockLocalCache.clear();
    localStorage.removeItem('talanquera_cart');
    localStorage.removeItem('talanquera_mesa');
    localStorage.removeItem('talanquera_tipo_orden');
  };
  const clearWithStockReturn = async () => {
    const itemsParaDevolver = [];
    
    items.forEach(it => {
        if (it.controlaInventario) {
            const receta = it.recetaInsumos || (it.insumoVinculado?._ref ? [{ insumoId: it.insumoVinculado._ref, cantidad: Number(it.cantidadADescontar) || 1 }] : []);
            receta.forEach(r => {
                itemsParaDevolver.push({
                    insumoId: r.insumoId,
                    cantidad: r.cantidad * it.cantidad
                });
            });
        }
    });

    if (itemsParaDevolver.length > 0) {
        try {
            const res = await fetch('/api/inventario/devolver', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: itemsParaDevolver })
            });
            if (res.ok) {
                refreshStockLocal();
                window.dispatchEvent(new Event('inventarioActualizado'));
            }
        } catch (e) { console.error(e); }
    }
    clear(); 
};

const eliminarLineaConStock = async (lineId) => {
    const it = items.find(it => it.lineId === lineId);
    if (!it) return items;

    const nuevoCarrito = items.filter(it => it.lineId !== lineId);

    if (it.controlaInventario) {
        // 🛡️ RECOLECTOR DE RECETA (Soporta nuevo y viejo)
        const receta = it.recetaInsumos || (it.insumoVinculado?._ref ? [{ insumoId: it.insumoVinculado._ref, cantidad: Number(it.cantidadADescontar) || 1 }] : []);
        
        if (receta.length > 0) {
            const aDevolver = receta.map(r => ({
                insumoId: r.insumoId,
                cantidad: r.cantidad * it.cantidad // Multiplicamos por los platos en la línea
            }));

            try {
                await fetch('/api/inventario/devolver', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: aDevolver })
                });
                window.dispatchEvent(new Event('inventarioActualizado'));
            } catch (err) { console.error(err); }
        }
    }
    setItems(nuevoCarrito);
    return nuevoCarrito; 
};
// 🚀 BISTURÍ: Esta función limpia la memoria de stock para forzar recarga
  const refreshStockLocal = () => {
    stockLocalCache.clear();
    avisosDados.clear();
    console.log("🧹 Memoria de inventario limpia. El próximo '+' pedirá datos frescos.");
  };
  // 🧮 CÁLCULO DEL TOTAL BLINDADO
  const total = useMemo(() => {
    const subtotalProductos = items.reduce((s, it) => s + (it.precioNum * it.cantidad), 0);
    
    // Si la propina es manual (-1), ignoramos porcentajes y sumamos el monto puro
    if (propina === -1) {
      return subtotalProductos + Number(montoManual);
    }
    
    const valorPropinaPorcentaje = subtotalProductos * (propina / 100);
    return subtotalProductos + valorPropinaPorcentaje;
  }, [items, propina, montoManual]);

  // ✅ BISTURÍ: Añadimos la función que falta para arreglar el POS
  const actualizarComentario = (lineId, comentario) => {
    setItems(prev =>
      prev.map(it =>
        it.lineId === lineId ? { ...it, comentario } : it
      )
    );
  };
  const contextValue = useMemo(() => ({
      items,
      addProduct,
      setCartFromOrden,
      tipoOrden,     
      setTipoOrden,
      ordenActivaId, 
      setOrdenMesa,  
      ordenMesa,
      setOrdenActivaId,
      decrease,
      clear,
      clearWithStockReturn,
      eliminarLineaConStock,
      total,
      metodoPago,
      setMetodoPago,
      propina,
      setPropina,
      montoManual,
      setMontoManual,
      actualizarComentario,
      cleanPrice: cleanPrice,
     refreshStockLocal 
      }), [
      items, tipoOrden, ordenActivaId, total, metodoPago, propina, montoManual, eliminarLineaConStock, refreshStockLocal
      ]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);