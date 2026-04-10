import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const body = await request.json();
        const { fechaSeleccionada } = body; 

        if (!fechaSeleccionada) {
            return NextResponse.json({ error: 'Falta la fecha' }, { status: 400 });
        }

        // 🕛 NORMALIZACIÓN IDÉNTICA A TU API ADMIN (Corte Colombia)
        const inicio = `${fechaSeleccionada} 00:00:00`;
        const fin = `${fechaSeleccionada} 23:59:59`;

        // CONSULTA BLINDADA
        const query = `*[_type == "venta" && (
            (defined(fechaLocal) && fechaLocal >= $inicio && fechaLocal <= $fin) ||
            (!defined(fechaLocal) && fecha >= $inicio && fecha <= $fin) ||
            (_createdAt >= $inicio && _createdAt <= $fin)
        )] | order(fechaLocal desc) {
            _id,
            folio,
            mesa,
            mesero,
            metodoPago,
            totalPagado,
            propinaRecaudada,
            fechaLocal,
            platosVendidosV2
        }`;

        const ventasRaw = await sanityClientServer.fetch(query, { inicio, fin }, { useCdn: false });

        // ✅ CORRECCIÓN: Normalizamos los datos antes de enviarlos al frontend
        const ventas = (ventasRaw || []).map(v => ({
            ...v,
            // Sumamos la propina al total para que el ticket y el visual muestren el gran total
            totalPagado: Number(v.totalPagado || 0) + Number(v.propinaRecaudada || 0)
        }));

        return NextResponse.json(ventas);
    } catch (error) {
        console.error('[HISTORIAL_VENTAS_ERROR]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}