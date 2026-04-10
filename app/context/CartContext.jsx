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
  // 💾 1. Al iniciar, recuperar del navegador si existe algo (Ahora localStorage)
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

  // 💾 2. Guardado Automático: Cada vez que cambien los items o el tipo de orden
  // 💾 2. Guardado Automático con "Amortiguador" (Debounce)
  // Esto evita que el sistema titile al cargar una mesa desde Sanity
  useEffect(() => {
    // Si el carrito está vacío y no hay nada en disco, no hacemos nada
    if (items.length === 0) {
        localStorage.removeItem('talanquera_cart');
        return;
    }

    // Ponemos un pequeño retraso (150ms). 
    // Si setItems se dispara muchas veces rápido, solo guardamos la última.
    const saveTimeout = setTimeout(() => {
      localStorage.setItem('talanquera_cart', JSON.stringify(items));
      localStorage.setItem('talanquera_tipo_orden', tipoOrden || 'mesa');
    }, 150);

    return () => clearTimeout(saveTimeout);
  }, [items, tipoOrden]);
  
  const addProduct = async (product) => {
    const pId = product._id || product.id;
    const insumoId = product.insumoVinculado?._ref;

    // --- 🛡️ ESCUDO PREVENTIVO (Bloqueo Síncrono) ---
    if (product.controlaInventario && insumoId) {
      const stockEnProducto = Number(product.stockActual) || 0;
      
      if (!stockLocalCache.has(insumoId) || stockEnProducto > Number(stockLocalCache.get(insumoId))) {
        stockLocalCache.set(insumoId, stockEnProducto);
      }

      const stockDisponible = Number(stockLocalCache.get(insumoId));
      const cantidadADescontar = Number(product.cantidadADescontar) || 1;

      if ((stockDisponible + 0.001) < cantidadADescontar) {
        alert(`🚫 STOCK AGOTADO LOCAL: No puedes agregar más "${product.nombre}".`);
        return; 
      }

      stockLocalCache.set(insumoId, stockDisponible - cantidadADescontar);
    }

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

  // --- 🛡️ 2. LÓGICA DE INVENTARIO (VERSIÓN BLINDADA) ---
    if (product.controlaInventario && insumoId) {
      fetch('/api/inventario/descontar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            insumoId, 
            cantidad: Number(product.cantidadADescontar) || 1 
        })
      })
      .then(async (res) => {
        const data = await res.json();

        // 🚨 CASO 409: EL SERVIDOR DIJO NO (Stock insuficiente)
        if (res.status === 409) {
          // ✅ BISTURÍ: No asumimos 0. Seteamos lo que el servidor diga que hay.
          stockLocalCache.set(insumoId, Number(data.disponible || 0));
          
          avisosDados.add(insumoId);

          setItems(prev => {
            // REVERSIÓN SEGURA: Solo afectamos lo que no se ha guardado (_key)
            const idx = prev.findIndex(it => 
                (it._id || it.id) === pId && 
                !it._key && 
                (it.comentario === (product.comentario || ''))
            );
            
            if (idx === -1) return prev;
            const copy = [...prev];
            if (copy[idx].cantidad > 1) {
                const nCant = copy[idx].cantidad - 1;
                copy[idx] = { ...copy[idx], cantidad: nCant, subtotalNum: nCant * precioNum };
                return copy;
            } else {
                return copy.filter((_, i) => i !== idx);
            }
          });

          alert(`🚫 STOCK AGOTADO: El servidor indica que solo quedan ${data.disponible} unidades.`);
          return;
        }

        // ✅ CASO 200: ÉXITO TOTAL
        if (res.ok) {
            // Sincronizamos el caché local con la verdad absoluta del servidor
            stockLocalCache.set(insumoId, Number(data.nuevoStock));

            if (data.alertaStockBajo && !avisosDados.has(insumoId)) {
                avisosDados.add(insumoId);
                alert(`⚠️ AVISO: Stock bajo de "${data.nombreInsumo || product.nombre}" (${data.nuevoStock} disp.)`);
            }
        }
      })
      .catch(err => {
          console.error("🔥 Error crítico inventario:", err);
          // 🛡️ Si la red falla, no dejamos que el usuario siga agregando a ciegas
          stockLocalCache.set(insumoId, 0); 
      });
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

  const insumoId = itemADisminuir.insumoVinculado?._ref;

  if (itemADisminuir.controlaInventario && insumoId) {
    const stockActualEnMapa = stockLocalCache.get(insumoId) || 0;
    const unidadInsumoXPlato = Number(itemADisminuir.cantidadADescontar) || 1;
    stockLocalCache.set(insumoId, stockActualEnMapa + unidadInsumoXPlato);

    fetch('/api/inventario/devolver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        items: [{ 
          // 🚨 CAMBIO CRÍTICO: Usamos 'insumoId' para que la API lo reconozca
          insumoId: insumoId, 
          cantidad: 1, // 1 plato
          insumos: [{ _id: insumoId, cantidad: unidadInsumoXPlato }] // Mantenemos este por si acaso
        }] 
      })
    })
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        if (data.nuevoStock) {
            stockLocalCache.set(insumoId, Number(data.nuevoStock));
        }
        if (!data.alertaStockBajo) {
          avisosDados.delete(insumoId);
        }
      }
    })
    .catch(err => console.error("Error al devolver stock:", err));
  }

  // Lógica de UI intacta
  setItems(prev => {
    const idx = prev.findIndex(i => i.lineId === lineId);
    if (idx === -1) return prev;
    const copy = [...prev];
    if (copy[idx].cantidad <= 1) {
      copy.splice(idx, 1);
    } else {
      const nuevaCant = copy[idx].cantidad - 1;
      copy[idx] = { 
        ...copy[idx], 
        cantidad: nuevaCant,
        subtotalNum: nuevaCant * (copy[idx].precioNum || 0)
      };
    }
    return copy;
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
    // 1. Preparamos el paquete de datos en el formato que la API espera
    const itemsParaDevolver = items
      .filter(it => it.controlaInventario && (it.insumoVinculado?._ref || it.insumoId))
      .map(it => ({
        insumoId: it.insumoVinculado?._ref || it.insumoId,
        // Calculamos el total: (lo que gasta cada plato) x (cuántos platos hay)
        cantidad: (Number(it.cantidadADescontar) || 1) * (Number(it.cantidad) || 1)
      }));

    // 2. Si hay algo que devolver, hacemos UN SOLO viaje a la API (más rápido)
    if (itemsParaDevolver.length > 0) {
      try {
        await fetch('/api/inventario/devolver', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            items: itemsParaDevolver // 👈 Aquí está la clave: enviamos la carpeta "items"
          })
        });
        console.log("✅ Stock devuelto masivamente");
      } catch (e) {
        console.error("Error devolviendo stock en limpieza profunda", e);
      }
    }
    
    // 3. Limpieza visual
    clear(); 
};

const eliminarLineaConStock = async (lineId) => {
    // 1. Capturamos el item ANTES de filtrar, validando que exista
    const itemABorrar = items.find(it => it.lineId === lineId);
    
    if (!itemABorrar) {
        console.warn("⚠️ No se encontró el item para borrar:", lineId);
        return items; 
    }

    // 2. Calculamos el nuevo carrito localmente (Inmutable)
    const nuevoCarrito = items.filter(it => it.lineId !== lineId);

    // 3. Lógica de Inventario usando la referencia capturada
    if (itemABorrar.controlaInventario) {
        const insumoId = itemABorrar.insumoVinculado?._ref || itemABorrar.insumoId;
        const cantidadADevolver = (Number(itemABorrar.cantidadADescontar) || 1) * (Number(itemABorrar.cantidad) || 1);
        
        try {
            await fetch('/api/inventario/devolver', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: [{ insumoId, cantidad: cantidadADevolver }] })
            });
        } catch (err) {
            console.error("❌ Error devolviendo stock:", err);
        }
    }

    // 4. Actualizamos el estado y retornamos el nuevo carrito para el Handler
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
      items, tipoOrden, total, metodoPago, propina, montoManual, eliminarLineaConStock, refreshStockLocal
      ]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);