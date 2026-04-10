// Archivo: talanquera-frontend/app/api/ordenes/[id]/route.js

import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

// Handler para GET (Obtener el detalle de una orden por ID)
// La URL se verá así: /api/ordenes/qwer-1234-abcd
export async function GET(request, { params }) {
    const ordenId = params.id; // Captura el ID de la URL

    if (!ordenId) {
        return NextResponse.json(
            { error: 'ID de orden faltante' }, 
            { status: 400 }
        );
    }

    try {
        // Consulta GROQ: Trae el documento completo de la orden activa.
        // Importante: También trae el _id, que necesitaremos para eliminarla.
       const query = `*[_type == "ordenActiva" && _id == $id][0] {
    _id,
    mesa,
    fechaCreacion,
    platosOrdenados[] {
        _key,
        nombrePlato,
        cantidad,
        precioUnitario,
        subtotal,
        comentario,
        controlaInventario,
        cantidadADescontar,
        insumoVinculado
    }
}`;
        
        const orden = await sanityClientServer.fetch(query, { id: ordenId });

        if (!orden) {
            return NextResponse.json(
                { error: `Orden activa con ID ${ordenId} no encontrada.` }, 
                { status: 404 }
            );
        }

        return NextResponse.json(orden);
    } catch (err) {
        console.error('Error obteniendo detalle de orden:', err);
        return NextResponse.json(
            { error: 'Error interno del servidor.' },
            { status: 500 }
        );
    }
}