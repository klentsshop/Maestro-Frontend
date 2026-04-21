'use client';
import React, { useState, useEffect, useMemo } from 'react';

const normalizarParaImpresora = (texto) => {
    // 1. Forzamos que sea String y manejamos nulos/undefined (Tu lógica original + robustez)
    const raw = String(texto || "").trim();
    if (!raw) return "";

    // 2. Cirugía de caracteres (Quitar tildes y diéresis)
    // Usamos normalize('NFD') para separar la letra de su acento y luego borramos el acento
    const sinTildes = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 3. Mapeo manual de la Ñ y caracteres que normalize a veces no captura
    return sinTildes
        .replace(/ñ/g, "n")
        .replace(/Ñ/g, "N")
        .replace(/[^\x00-\x7F]/g, "") // 🛡️ FILTRO FINAL: Borra cualquier caracter NO ASCII (emojis o simbolos raros)
        .toUpperCase();               // Mayúsculas para que el chef no use gafas
};
export function useOrdenHandlers({
    cart, total, clearCart, clearWithStockReturn, setCartFromOrden,eliminarLineaConStock, 
    apiGuardar, apiEliminar, refreshOrdenes,
    ordenesActivas, esModoCajero, setMostrarCarritoMobile,
    nombreMesero, setNombreMesero,tipoOrden, ordenMesa, setOrdenMesa,
    rep, validarPinAdmin, ordenActivaId, setOrdenActivaId
}) {
  
    const [mensajeExito, setMensajeExito] = useState(false);
    const [errorMesaOcupada, setErrorMesaOcupada] = useState(null);
    // 🧬 DNA de Cobro: Mantiene el ID idéntico en reintentos por lag
    const [dnaCobro, setDnaCobro] = useState(null);

    const esVentaDirecta = esModoCajero && cart.length > 0 && !ordenActivaId;
    const textoBotonPrincipal = esVentaDirecta ? "GUARDAR" : (ordenActivaId ? "ACTUALIZAR" : "GUARDAR");

    useEffect(() => {
        if (esModoCajero && !nombreMesero) {
            setNombreMesero("Caja");
        }
    }, [esModoCajero]);

    // ==============================
    // CARGAR ORDEN EXISTENTE
    // ==============================
    const cargarOrden = async (id) => {
        try {
            const res = await fetch('/api/ordenes/get', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ ordenId: id }) 
            });
            const o = await res.json();
            
            if (o && o.platosOrdenados) {
                // 1. 🛡️ Seteamos la identidad de la orden primero
                setOrdenActivaId(o._id); 
                setOrdenMesa(o.mesa); 
                
                const meseroFinal = o.mesero || o.nombreMesero || localStorage.getItem('ultimoMesero') || (esModoCajero ? "Caja" : null);
                setNombreMesero(meseroFinal); 

                // 2. ⏳ PEQUEÑO DELAY (50ms): Esto es el secreto anti-titileo.
                // Le damos tiempo a la UI para que asiente el nombre de la mesa 
                // antes de inyectar todos los platos al carrito.
                setTimeout(() => {
                    const platosParaCarrito = o.platosOrdenados.map(p => ({
                        ...p,
                        // 1. Identidad del plato
                        nombre: p.nombrePlato || p.nombre,
                        comentario: p.comentario || "",
                        precioNum: p.precioUnitario || p.precio,
                        
                        // 2. 🛡️ BLINDAJE DE CATEGORÍA: 
                        categoria: (p.categoria || p.categoriaPlato || "").toString().toUpperCase().trim(),
                        
                        // 3. Flags de impresión y estado
                        seImprime: p.seImprime === true, 
                        esDeOrdenGuardada: true
                    }));

                    // Enviamos al carrito con el tipo de orden recuperado de Sanity
                    setCartFromOrden(platosParaCarrito, o.tipoOrden || 'mesa'); 
                }, 50);

                setMostrarCarritoMobile(true);
                return { 
                    success: true, 
                    tipoOrden: o.tipoOrden || 'mesa' 
                };
            }
        } catch (e) { 
            console.error("Error crítico en carga de orden:", e); 
        }
        return false;
    };

    // ==============================
    // GUARDAR ORDEN (MESA)
    // ==============================
    
   
    const guardarOrden = async () => {
        if (cart.length === 0) return;

        let mesaDefault = esModoCajero ? "0" : "0";
        let mesa = ordenMesa || prompt("Mesa o Cliente:", mesaDefault);
        if (!mesa) return;

        const nombreNuevoNorm = mesa.toLowerCase().trim();

        // ✨ DETECCIÓN SENIOR PARA EL RADIO (Justo después del prompt)
        let tipoParaSanity = tipoOrden;
     
        if (nombreNuevoNorm.startsWith('domi')) {
            tipoParaSanity = 'domicilio';
        } else if (nombreNuevoNorm.startsWith('llevar')) {
            tipoParaSanity = 'llevar';
        } else if (/^\d+$/.test(nombreNuevoNorm) || nombreNuevoNorm.startsWith('mesa')) {
            tipoParaSanity = 'mesa';
        }
        // --- 🛡️ NUEVO ESCUDO HÍBRIDO "DOMI-SEGURO" ---
        if (!ordenActivaId) {
            const soloNumerosNuevos = mesa.match(/\d+/g)?.join("");

            // Definimos qué palabras activan la flexibilidad de números
            const palabrasFlex = ['domi', 'domicilio', 'llevar'];
            const esBusquedaFlexible = palabrasFlex.some(p => nombreNuevoNorm.startsWith(p));

            const existe = (ordenesActivas || []).find((o) => {
                const nombreExistenteNorm = (o.mesa || "").toLowerCase().trim();
                const soloNumerosExistentes = (o.mesa || "").match(/\d+/g)?.join("");

                // 1. Validación Texto Exacto
                const coincidenciaTexto = nombreExistenteNorm === nombreNuevoNorm;
                if (coincidenciaTexto) return true;

                // 2. Validación Numérica: Solo si NO es Domi/Llevar.
                if (!esBusquedaFlexible) {
                    const coincidenciaNumero = soloNumerosNuevos && soloNumerosExistentes && (soloNumerosNuevos === soloNumerosExistentes);
                    return coincidenciaNumero;
                }
                return false;
            });

            if (existe) {
                setErrorMesaOcupada(mesa); 
                return; 
            }
        }
        // --- 🛡️ FIN DEL ESCUDO ---

        // Mantenemos intacta tu lógica de meseros
        let meseroFinal = nombreMesero || localStorage.getItem('ultimoMesero') || (esModoCajero ? "Caja" : null);
        if (!meseroFinal) {
            alert("⚠️ Por favor, selecciona un mesero antes de guardar la orden.");
            return;
        }

        localStorage.setItem('ultimoMesero', meseroFinal);

        // ✅ LÓGICA DE INVENTARIO Y MAPEO (INTACTA)
        const platosParaGuardar = cart.map(i => ({ 
            _id: i._id,
            _key: i._key || i.lineId || `new-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`, 
            nombrePlato: i.nombre || i.nombrePlato, 
            cantidad: i.cantidad, 
            precioUnitario: i.precioNum, 
            subtotal: i.precioNum * i.cantidad,
            comentario: normalizarParaImpresora(i.comentario),
            // 🚀 BISTURÍ: Aquí resolvemos el problema de la categoría en una sola línea
            categoria: (i.categoria || i.categoriaPlato || i.nombreCategoria || "").toString().trim().toUpperCase(),
            seImprime: i.seImprime === true,
            controlaInventario: i.controlaInventario || false,
            recetaInsumos: i.recetaInsumos || [],
            insumoVinculado: i.insumoVinculado || null,
            cantidadADescontar: i.cantidadADescontar || 0
        }));

        try {
            setMensajeExito(true);
            setMostrarCarritoMobile(false);

            // ✅ ENVÍO A API (INTACTO)
            await apiGuardar({ 
                mesa: mesa.trim(), 
                mesero: meseroFinal, 
                ordenId: ordenActivaId, 
                platosOrdenados: platosParaGuardar,
                _unset: ['impreso', 'imprime'],
                imprimirSolicitada: true,
                tipoOrden: tipoParaSanity,
                ultimaActualizacion: new Date().toISOString()
            });
            
            await refreshOrdenes();

            setTimeout(() => {
                setMensajeExito(false);
                setOrdenActivaId(null); 
                setOrdenMesa(null); 
                clearCart(); 
                if (meseroFinal) setNombreMesero(meseroFinal);
            }, 1500);

        } catch (e) { 
            console.error("🔥 [ERROR_GUARDAR_ORDEN]:", e);
            setMensajeExito(false);
            alert("Sin internet o servidor lento. Intenta de nuevo."); 
        }
    };
 
    // ==============================
    // COBRAR ORDEN (VERSIÓN FINAL BLINDADA)
    // ==============================
    const cobrarOrden = async (metodoPrimario, args = null) => {
        
        if (mensajeExito) return;
        if (cart.length === 0) return alert("⚠️ El carrito está vacío.");
        if (!esModoCajero) return alert("⚠️ Solo el cajero puede realizar cobros directos.");
        
        // 🛵 1. CAPTURA DE DATOS DE DOMICILIO (Si aplica)
    let datosEntrega = null;
    if (tipoOrden === 'domicilio') {
        const nombre = prompt("Nombre del Cliente (Domicilio):", "");
        const direccion = prompt("Dirección de Entrega:", "");
        const telefono = prompt("Teléfono de Contacto:", "");
        
        // Solo creamos el objeto si el cajero llenó al menos la dirección
        if (nombre || direccion || telefono) {
            datosEntrega = {
                nombreCliente: nombre || "N/A",
                direccion: direccion || "N/A",
                telefono: telefono || "N/A"
            };
        }
    }

        let detalleFinal = [];
        let metodoParaConfirmar = metodoPrimario; 
        
        // 1. Lógica de métodos (Modal y Prompt)
        if (metodoPrimario === 'mixto_v2' && args) {
            detalleFinal = [
                { metodo: 'efectivo', monto: Number(args.efectivo || 0) },
                { metodo: 'tarjeta', monto: Number(args.tarjeta || 0) },
                { metodo: 'digital', monto: Number(args.digital || 0) }
            ].filter(p => p.monto > 0);
            metodoParaConfirmar = "PAGO DIVIDIDO (MODAL)"; 
        }
        else if (metodoPrimario === 'mixto') {
            const efectivo = Number(prompt("Monto en EFECTIVO:", "0"));
            if (isNaN(efectivo) || efectivo < 0) return alert("Monto inválido");
            const tarjeta = total - efectivo;
            if (tarjeta < 0) return alert("El efectivo no puede ser mayor al total de la cuenta.");
            detalleFinal = [
                { metodo: 'efectivo', monto: efectivo },
                { metodo: 'tarjeta', monto: tarjeta }
            ];
            metodoParaConfirmar = `MIXTO (Efe: $${efectivo.toLocaleString()} - Tarj:$${tarjeta.toLocaleString()})`;
        } else {
            detalleFinal = [{ metodo: metodoPrimario, monto: total }];
            metodoParaConfirmar = metodoPrimario.toUpperCase();
        }

        // 💰 Cálculo de Propina
        const subtotalVenta = cart.reduce((s, i) => s + (Number(i.precioNum) * i.cantidad), 0);
        const valorPropina = total > subtotalVenta ? total - subtotalVenta : 0;

        const transaccionId = dnaCobro || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        if (!dnaCobro) setDnaCobro(transaccionId);

        setMensajeExito(true);
        const fechaLocal = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })).toISOString();

        try {
            const res = await fetch('/api/ventas', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    mesa: ordenMesa || "0", 
                    tipoOrden: tipoOrden || "mesa",
                    datosEntrega,
                    mesero: nombreMesero || "Caja", 
                    metodoPago: metodoPrimario,
                    detallePagos: detalleFinal,
                    totalPagado: Number(subtotalVenta),
                    propinaRecaudada: Number(valorPropina),
                    fechaLocal, 
                    transaccionId, 
                    ordenId: ordenActivaId || null, 
                    platosVendidosV2: cart.map(i => ({ 
                        nombrePlato: i.nombre || i.nombrePlato,
                        cantidad: i.cantidad, 
                        precioUnitario: i.precioNum, 
                        subtotal: i.precioNum * i.cantidad,
                        comentario: normalizarParaImpresora(i.comentario || "")
                    })) 
                }) 
            });

            if (res.ok) {
                // 🛡️ PASO 1: MATAR IDENTIDAD INMEDIATAMENTE
                // Esto evita que si hay un re-render, el sistema crea que hay una mesa viva.
                setOrdenActivaId(null); 
                setOrdenMesa(null); 
                setDnaCobro(null);

                sessionStorage.setItem('ticket_preview_data', JSON.stringify({
                    productos: cart,
                    subtotal: subtotalVenta,
                    propina: valorPropina,
                    total: total,
                    metodoPago: metodoPrimario,
                    detallePagos: detalleFinal,
                    mesa: ordenMesa || "0",
                    mesero: nombreMesero || "Caja",
                    fecha: fechaLocal,
                    tipoOrden: tipoOrden,
                    datosEntrega
                }));

                // ⏳ PASO 2: TIEMPO DE GRACIA PARA SANITY (1.2 segundos)
                // Es el tiempo necesario para que refreshOrdenes no traiga la mesa vieja.
                setTimeout(async () => {
                    clearCart(); // Limpiamos el carrito al final
                    await refreshOrdenes();
                    if (rep?.cargarReporteAdmin) rep.cargarReporteAdmin();
                    setMensajeExito(false); // Liberamos el botón al final
                }, 1200); 

            } else {
                setMensajeExito(false);
                alert("❌ Error en el servidor al procesar la venta.");
            }
        } catch (e) { 
            setMensajeExito(false);
            alert('❌ Error en el pago. Revisa la conexión.'); 
        }
    };
    const cancelarOrden = async () => {
        if (!ordenActivaId) return;
        if (!esModoCajero) return alert("🔒 PIN de Cajero requerido.");
        
        // 1. Única confirmación: Si el usuario dice que sí, procedemos sin más interrupciones
        if (confirm(`⚠️ ¿Eliminar orden de ${ordenMesa}?`)) {
            // 🛡️ Activamos el escudo para bloquear el botón mientras Sanity procesa
            setMensajeExito(true); 

            try {
                // Ejecutamos las acciones de borrado en Sanity y local
                await apiEliminar(ordenActivaId);
                await clearWithStockReturn(); 
                
                setOrdenActivaId(null); 
                setOrdenMesa(null);
                
                await refreshOrdenes(); 

                // ✅ BISTURÍ: Eliminamos el alert("🗑️ Eliminada.")
                // Ahora el sistema simplemente se limpia y ya queda listo.

                // Liberamos el escudo después de un breve respiro para que la UI se asiente
                setTimeout(() => {
                    setMensajeExito(false);
                }, 300);

            } catch (error) { 
                setMensajeExito(false);
                alert("❌ Error al eliminar la orden."); 
            }
        }
    };
  // 📦 FUNCIÓN GEMELA: Sincronización silenciosa para borrados con PIN
const sincronizarBorradoEnSanity = async (carritoFiltrado) => {
    // Si el carrito queda vacío, el Schema de Sanity (min 1) o tu API (línea 45) darán error.
    // En ese caso, lo correcto es eliminar la orden completa.
    if (!ordenActivaId || !carritoFiltrado || carritoFiltrado.length === 0) {
        await apiEliminar(ordenActivaId);
        return;
    }

    try {
        setMensajeExito(true);
        const mesaReal = ordenMesa || ordenesActivas.find(o => o._id === ordenActivaId)?.mesa;

        const platosParaSanity = carritoFiltrado.map(i => ({ 
            _id: i._id,
            _key: i._key || i.lineId, 
            nombrePlato: i.nombre || i.nombrePlato, 
            cantidad: Number(i.cantidad), 
            precioUnitario: Number(i.precioNum || i.precioUnitario), // Según Schema
            subtotal: Number((i.precioNum || i.precioUnitario) * i.cantidad),
            comentario: normalizarParaImpresora(i.comentario || ""),
            categoria: (i.categoria || "").toString().trim().toUpperCase(),
            seImprime: i.seImprime === true,
            controlaInventario: i.controlaInventario || false,
            esDeOrdenGuardada: true,
            recetaInsumos: i.recetaInsumos || [],
            insumoVinculado: i.insumoVinculado || null,
            cantidadADescontar: Number(i.cantidadADescontar || 0)
        }));

        await apiGuardar({ 
            mesa: String(mesaReal), 
            mesero: nombreMesero || "Caja", 
            ordenId: ordenActivaId, 
            platosOrdenados: platosParaSanity, // Coincide con línea 45 de la API
            imprimirSolicitada: true, 
            tipoOrden: tipoOrden || "mesa",
            ultimaActualizacion: new Date().toISOString()
        });
        
        await refreshOrdenes();
        setTimeout(() => setMensajeExito(false), 500);
    } catch (e) {
        console.error("🔥 Error en sincronización:", e);
        setMensajeExito(false);
    }
};
  const solicitarEliminacionAdmin = async (item) => {
    // 1. Lógica para Cajero
    if (esModoCajero) {
        if (confirm(`⚠️ ¿Desea eliminar "${item.nombre}"? Este plato ya fue enviado a cocina.`)) {
            const carritoFiltrado = await eliminarLineaConStock(item.lineId);
            
            if (carritoFiltrado) {
                // ✅ CAMBIO AQUÍ: Usamos la gemela para que no limpie pantalla ni imprima
                await sincronizarBorradoEnSanity(carritoFiltrado); 
            }
        }
        return;
    }

    // 2. Lógica para Mesero (Pide PIN)
    const pinIngresado = prompt(`🔒 PIN de Administrador para eliminar "${item.nombre}":`);
    if (!pinIngresado) return; 

    try {
        const res = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pinIngresado, tipo: 'admin' })
        });

        const data = await res.json();

        if (data.autorizado) {
            if (confirm(`✅ PIN Correcto. ¿Eliminar "${item.nombre}" de la mesa?`)) {
                const carritoFiltrado = await eliminarLineaConStock(item.lineId);

                if (carritoFiltrado) {
                    // ✅ CAMBIO AQUÍ: Sincronización silenciosa
                    await sincronizarBorradoEnSanity(carritoFiltrado);
                }
            }
        } else {
            alert("❌ PIN Administrativo incorrecto.");
        }
    } catch (error) {
        console.error("🔥 Error en validación:", error);
        alert("❌ Error de seguridad.");
    }
};
    return React.useMemo(() => ({
        ordenActivaId, ordenMesa, nombreMesero, setNombreMesero,
        cargarOrden, errorMesaOcupada, setErrorMesaOcupada,
        guardarOrden, cobrarOrden, cancelarOrden, solicitarEliminacionAdmin,
        mensajeExito, textoBotonPrincipal, eliminarLineaConStock, setMensajeExito,
        setOrdenActivaId, setOrdenMesa
    }), [
        ordenActivaId, ordenMesa, nombreMesero, errorMesaOcupada, dnaCobro,
        mensajeExito, textoBotonPrincipal, cart, esModoCajero, cart.length, total, tipoOrden, validarPinAdmin, eliminarLineaConStock
    ]);
}