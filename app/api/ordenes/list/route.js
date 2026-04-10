import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const query = `*[_type == "ordenActiva"] | order(fechaCreacion asc) {
            _id, mesa, mesero, tipoOrden, fechaCreacion, platosOrdenados, imprimirSolicitada
        }`;
        const data = await sanityClientServer.fetch(query, {}, { useCdn: false });
        return NextResponse.json(data || []); 
    } catch (error) {
        console.error('[API_LIST_GET_ERROR]:', error);
        return NextResponse.json([], { status: 200 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { mesa, mesero, platosOrdenados, ordenId, tipoOrden } = body;

        if (!mesa || !Array.isArray(platosOrdenados) || platosOrdenados.length === 0) {
            return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 });
        }

        // 1. NORMALIZACIÓN DE PLATOS Y ESTACIONES
        const estacionesSet = new Set(); 
        const platosNormalizados = platosOrdenados.map(p => {
            const categoriaPlato = (p.categoria || "").trim().toUpperCase();
            if (p.seImprime === true) estacionesSet.add(categoriaPlato);

            return {
                _key: p._key || p.lineId || Math.random().toString(36).substring(2, 9), 
                _id: p._id, 
                nombrePlato: p.nombrePlato || p.nombre, 
                cantidad: Number(p.cantidad) || 1,
                precioUnitario: Number(p.precioUnitario || p.precioNum) || 0,
                subtotal: (Number(p.precioUnitario || p.precioNum) || 0) * (Number(p.cantidad) || 1),
                comentario: p.comentario || "",
                categoria: categoriaPlato,
                seImprime: p.seImprime === true,
                controlaInventario: p.controlaInventario || false,
                cantidadADescontar: p.cantidadADescontar || 0,
                insumoVinculado: p.insumoVinculado || null
            };
        });

        const estacionesPendientes = Array.from(estacionesSet);
        const fechaActual = new Date().toISOString();
        const valorSolicitada = body.hasOwnProperty('imprimirSolicitada') ? body.imprimirSolicitada : true;

        // 2. BUSCAR ID SI NO VIENE (Escudo anti-duplicados)
        let idDestino = ordenId;
        if (!idDestino) {
            idDestino = await sanityClientServer.fetch(
                `*[_type == "ordenActiva" && mesa == $mesa][0]._id`,
                { mesa },
                { useCdn: false }
            );
        }

        // 3. TRANSACCIÓN ATÓMICA
        let transaction = sanityClientServer.transaction();

        if (idDestino) {
            // ACTUALIZAR MESA: Usamos insert para no borrar lo que la APK tiene pendiente
            transaction = transaction.patch(idDestino, {
                setIfMissing: { estacionesPendientes: [] },
                insert: {
                    after: 'estacionesPendientes[-1]',
                    items: estacionesPendientes
                },
                set: {
                    mesa,
                    mesero,
                    tipoOrden: tipoOrden || 'mesa',
                    platosOrdenados: platosNormalizados,
                    ultimaActualizacion: fechaActual,
                    imprimirSolicitada: valorSolicitada
                },
                // Limpiamos campos basura que bloquean la APK
                unset: ['impreso', 'imprime']
            });
        } else {
            // CREAR MESA NUEVA
            transaction = transaction.create({
                _id: `orden-${Date.now()}`, // ID manual para evitar colisiones
                _type: 'ordenActiva',
                mesa,
                mesero,
                tipoOrden: tipoOrden || 'mesa',
                fechaCreacion: fechaActual,
                ultimaActualizacion: fechaActual,
                platosOrdenados: platosNormalizados,
                imprimirSolicitada: valorSolicitada,
                estacionesPendientes: estacionesPendientes
            });
        }

        const result = await transaction.commit();

        return NextResponse.json({ 
            message: idDestino ? 'Orden actualizada' : 'Orden creada', 
            ordenId: idDestino || (result.results[0] ? result.results[0].id : null)
        }, { status: 200 });

    } catch (error) {
        console.error('🔥 [API_ORDENES_POST_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}