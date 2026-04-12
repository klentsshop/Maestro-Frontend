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
            // 1. Identificar el ID de forma estricta (Priorizamos insumoId directo)
            // Ya no buscamos en sub-arrays complejos para evitar confusiones de identidad
            const insumoId = item.insumoId;
            
            if (!insumoId || insumoId === 'undefined') {
                console.warn("⚠️ Intento de devolución ignorado: ID de insumo no válido.");
                continue; 
            }

            // 2. Cálculo SEGURO (Suma Simple)
            // 🚀 ELIMINAMOS LA MULTIPLICACIÓN: 
            // El Frontend (CartContext) ya nos envía la cantidad neta a devolver.
            // Si el POS dice que devuelva 5, sumamos 5. Si dice 1, sumamos 1.
            const totalARecuperar = Number(item.cantidad) || 0;

            if (totalARecuperar > 0) {
                hayCambios = true;
                transaction = transaction.patch(insumoId, {
                    setIfMissing: { stockActual: 0 },
                    inc: { stockActual: totalARecuperar }
                });
                console.log(`📝 Preparando devolución: ${insumoId} +${totalARecuperar}`);
            }
        }

        if (hayCambios) {
            // 3. Commit atómico: Todo se guarda o nada se guarda
            await transaction.commit();
            console.log("✅ Sanity: Devolución de stock procesada con éxito.");
        } else {
            console.warn("ℹ️ No se procesaron cambios: Ningún item tenía cantidad válida.");
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('❌ ERROR_DEVOLVER_ROUTE:', error.message);
        return NextResponse.json({ 
            error: 'Error interno al devolver stock',
            details: error.message 
        }, { status: 500 });
    }
}