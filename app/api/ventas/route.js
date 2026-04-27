import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req) {
    try {
        const payload = await req.json();
        const { transaccionId, datosEntrega } = payload;
        
        // --- VARIABLES ORIGINALES ---
        const mesa = payload.mesa || 'General';
        const mesero = payload.mesero || 'Personal General';
        const metodoPagoRaw = payload.metodoPago || 'efectivo';
        const metodoPago = metodoPagoRaw.toLowerCase().trim();
        const totalPagado = Number(payload.totalPagado) || 0;
        const propinaRecaudada = Number(payload.propinaRecaudada) || 0;
        const ordenId = payload.ordenId;
        const tipoOrden = typeof payload.tipoOrden === 'string' ? payload.tipoOrden.trim() : 'mesa';

        // --- FECHAS Y FOLIO ---
        const now = new Date();
        const fechaUTC = now.toISOString();
        const fechaLocal = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' });

        const datePart = fechaUTC.slice(2, 10).replace(/-/g, '');
        const seed = transaccionId ? transaccionId.slice(-4).toUpperCase() : (crypto.randomBytes(2).toString('hex')).toUpperCase();
        const folioGenerado = `TAL-${datePart}-${seed}`;
        const ventaId = transaccionId ? `venta-${transaccionId}` : `venta-${Date.now()}`;
        
        // ==========================================
        // 🛡️ ESCUDO ANTI-FANTASMAS (EL BLOQUEO MAESTRO)
        // ==========================================
        if (ordenId) {
            const mesaExiste = await sanityClientServer.fetch(
                `defined(*[_type == "ordenActiva" && _id == $id][0])`, 
                { id: ordenId }
            );
            
            if (!mesaExiste) {
                console.warn(`⚠️ Cobro duplicado evitado: ${ordenId}`);
                return NextResponse.json({ 
                    ok: true, 
                    yaProcesada: true, 
                    message: 'Esta mesa ya fue cerrada anteriormente.' 
                }, { status: 200 });
            }
        } else {
            // Regla para Caja Rápida
            const esCajaRapida = mesa === '0' || mesa === 'General' || mesa === '';
            if (!esCajaRapida) {
                return NextResponse.json({ 
                    ok: false, 
                    error: 'REFERENCIA_PERDIDA', 
                    message: 'No se puede cobrar una mesa guardada sin su ID original.' 
                }, { status: 400 });
            }
        }
        // --- 🚀 BÚSQUEDA DE IDS Y RECETAS ---
        const nombresPlatos = (payload.platosVendidosV2 || []).map(item => item.nombrePlato || item.nombre);
        const mapeoSanity = await sanityClientServer.fetch(
            `*[_type == "plato" && nombre in $nombres]{
                nombre, 
                _id, 
                controlaInventario,
                insumoVinculado,
                cantidadADescontar,
                recetaInsumos[]{
                    "insumoId": insumo._ref,
                    cantidad
                }
            }`,
            { nombres: nombresPlatos },
            { useCdn: false }
        );

        // --- MAPEO DE PLATOS ---
        const platosVenta = (payload.platosVendidosV2 || []).map(item => ({
            _key: crypto.randomUUID(),
            _type: 'platoVendidoV2',
            nombrePlato: item.nombrePlato || item.nombre,
            cantidad: Number(item.cantidad) || 1,
            precioUnitario: Number(item.precioUnitario) || 0,
            subtotal: Number(item.subtotal) || 0,
            comentario: item.comentario || ""
        }));

        const abrirCajon = metodoPago === 'efectivo';
        const detallePagosValido = (Array.isArray(payload.detallePagos) && payload.detallePagos.length > 0) 
            ? payload.detallePagos 
            : [{ metodo: metodoPagoRaw, monto: totalPagado + propinaRecaudada }];

        // ============================
        // TRANSACCIÓN ATÓMICA ÚNICA
        // ============================
        let transaction = sanityClientServer.transaction();

        // 1. Crear Venta
        transaction = transaction.createIfNotExists({
            _id: ventaId,
            _type: 'venta',
            folio: folioGenerado,
            mesa,
            mesero,
            tipoOrden,
            ...(datosEntrega && typeof datosEntrega === 'object' ? { datosEntrega } : {}),
            metodoPago: (metodoPago === 'mixto_v2' || detallePagosValido.length > 1) ? 'mixto_v2' : metodoPago,
            detallePagos: detallePagosValido.map(p => ({
                _key: crypto.randomUUID(),
                metodo: String(p.metodo || 'efectivo').toLowerCase().trim(),
                monto: Number(p.monto || 0)
            })),
            totalPagado,
            propinaRecaudada,
            fecha: fechaUTC,
            fechaLocal: fechaLocal,
            platosVendidosV2: platosVenta,
        });

        // 2. Crear Ticket para APK
        transaction = transaction.create({
            _type: 'ticketCobro',
            mesa,
            mesero,
            tipoOrden,
            ...(datosEntrega && typeof datosEntrega === 'object' ? { datosEntrega } : {}),
            metodoPago: detallePagosValido.length > 1 ? 'múltiple' : metodoPago,
            items: platosVenta.map(p => ({
                _key: crypto.randomUUID(),
                nombrePlato: p.nombrePlato,
                cantidad: p.cantidad,
                precio: p.precioUnitario,
                subtotal: p.subtotal
            })),
            subtotal: totalPagado,
            propina: propinaRecaudada,
            total: totalPagado + propinaRecaudada,
            abrirCajon,
            impreso: false,
            imprimirSolicitada: false,
            fecha: fechaUTC
        });

        // 3. Borrar Mesa Activa
        if (ordenId) {
            transaction = transaction.delete(ordenId);
        }

        // 4. 🔥 POPULARIDAD E INVENTARIO (Fusión Blindada)
       // 4. 🔥 POPULARIDAD E INVENTARIO (Fusión Atómica Senior)
        (payload.platosVendidosV2 || []).forEach(p => {
            const nombrePlato = p.nombrePlato || p.nombre;
            const match = mapeoSanity.find(m => m.nombre === nombrePlato);
            
            // Usamos el ID del match de Sanity para asegurar que el patch llegue al documento correcto
            if (match && match._id) {
                // A. Popularidad del plato
                transaction = transaction.patch(match._id, {
                    setIfMissing: { totalVentas: 0 },
                    inc: { totalVentas: Number(p.cantidad) || 1 }
                });

                // B. Descuento de Inventario (Solo si el plato lo requiere)
                if (match.controlaInventario) {
                    const cantPlato = Number(p.cantidad) || 1;
                    
                    // CASO 1: Sistema de Receta (Múltiples ingredientes)
                    if (Array.isArray(match.recetaInsumos) && match.recetaInsumos.length > 0) {
                        match.recetaInsumos.forEach(insumoItem => {
                            if (insumoItem.insumoId) {
                                transaction = transaction.patch(insumoItem.insumoId, {
                                    inc: { stockActual: -(Number(insumoItem.cantidad) * cantPlato) }
                                });
                            }
                        });
                    } 
                    // CASO 2: Sistema de Insumo Vinculado (Un solo ingrediente)
                    else if (match.insumoVinculado && match.insumoVinculado._ref) {
                        const cantADescontar = Number(match.cantidadADescontar) || 1;
                        transaction = transaction.patch(match.insumoVinculado._ref, {
                            inc: { stockActual: -(cantADescontar * cantPlato) }
                        });
                    }
                }
            }
        });

        // 🚀 EL MOMENTO DE LA VERDAD
        await transaction.commit();

        return NextResponse.json({ 
            ok: true, 
            message: 'Venta registrada e Inventario actualizado',
            folio: folioGenerado
        }, { status: 201 });

    } catch (err) {
        console.error('🔥 [FATAL_ERROR_VENTAS]:', err.message);
        return NextResponse.json({ 
            ok: false, 
            error: 'Error en la transacción final',
            details: err.message 
        }, { status: 500 });
    }
}