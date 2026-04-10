import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const { items } = await request.json();

        if (!items || !Array.isArray(items)) {
            return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
        }

        // 🛡️ BISTURÍ: Usamos una transacción para procesar todo en un solo viaje a Sanity
        let transaction = sanityClientServer.transaction();
        let hayCambios = false;

        for (const item of items) {
            // 1. Identificar el ID de forma estricta
            const insumoId = item.insumoId || (item.insumos && item.insumos[0]?._id);
            
            if (!insumoId || insumoId === 'undefined') {
                console.warn("⚠️ Intento de devolución ignorado: ID de insumo no válido.");
                continue; 
            }

            // 2. Cálculo SEGURO (Sin inventar unidades)
            // Si no viene cantidad, es 0. No 1.
            const cantPlatos = Number(item.cantidad) || 0;
            
            // Si viene de 'decrease' (botón menos), el item ya trae la cantidad total a devolver
            // Si viene de 'limpieza masiva', calculamos platos * insumo
            const cantInsumo = item.insumos ? (Number(item.insumos[0]?.cantidad) || 1) : 1;
            
            // Si cantPlatos es 0, no devolvemos nada para evitar inflar stock
            const totalARecuperar = cantPlatos * cantInsumo;

            if (totalARecuperar > 0) {
                hayCambios = true;
                transaction = transaction.patch(insumoId, {
                    setIfMissing: { stockActual: 0 },
                    inc: { stockActual: totalARecuperar }
                });
            }
        }

        if (hayCambios) {
            await transaction.commit();
            console.log("✅ Devolución de stock procesada con éxito.");
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('❌ ERROR_DEVOLVER_ROUTE:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}