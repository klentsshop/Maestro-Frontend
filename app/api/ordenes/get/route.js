import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const { ordenId } = await request.json();

        if (!ordenId) {
            return NextResponse.json(
                { error: 'ordenId es requerido', exists: false },
                { status: 400 }
            );
        }

        const query = `
            *[_type == "ordenActiva" && _id == $ordenId][0] {
                _id,
                mesa,
                mesero,  // 🔥 AGREGADO: Ahora la API sí entregará el nombre (Diana, Mauricio, etc.)
                tipoOrden,
                fechaCreacion,
                imprimirSolicitada,
                platosOrdenados[] {
                    _key,
                    _id,
                    categoria,
                    nombrePlato,
                    cantidad,
                    precioUnitario,
                    subtotal,
                    comentario,
                    seImprime,
                    controlaInventario,
                    cantidadADescontar,
                    insumoVinculado,
                    recetaInsumos
                }
            }
        `;

        // 🔥 Agregamos { useCdn: false } para que el dato sea 100% fresco al cargar
        const orden = await sanityClientServer.fetch(query, { ordenId }, { useCdn: false });

        if (!orden) {
            return NextResponse.json(
                { message: 'Orden no encontrada', exists: false },
                { status: 200 } 
            );
        }

        return NextResponse.json({ ...orden, exists: true });

    } catch (error) {
        console.error('[API_GET_ORDEN_ERROR]:', error);
        return NextResponse.json(
            { error: 'Error interno al obtener la orden', exists: false },
            { status: 500 }
        );
    }
}