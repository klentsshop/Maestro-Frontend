import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export async function POST(request) {
    try {
        const { receta } = await request.json();

        // 1. 🛡️ VALIDACIÓN DE ENTRADA (Lupa Senior)
        if (!receta || !Array.isArray(receta) || receta.length === 0) {
            return NextResponse.json({ error: 'Faltan datos o la receta está vacía' }, { status: 400 });
        }

        // 2. 🔍 LECTURA PREVIA COLECTIVA (Bisturí de Seguridad)
        // Traemos los datos actuales de TODOS los insumos involucrados
        const ids = receta.map(r => r.insumoId);
        const insumosActuales = await sanityClientServer.fetch(
            `*[_id in $ids]{ _id, stockActual, stockMinimo, nombre }`, 
            { ids }
        );

        // 3. 📏 VALIDACIÓN DE UMBRAL (Atomicidad Preventiva)
        // Si UN SOLO ingrediente no tiene stock, abortamos TODA la operación
        for (const item of receta) {
            const serverInsumo = insumosActuales.find(s => s._id === item.insumoId);
            
            if (!serverInsumo) {
                return NextResponse.json({ error: `Insumo no encontrado: ${item.insumoId}` }, { status: 404 });
            }

            const stockDisponible = Number(serverInsumo.stockActual) || 0;
            const cantidadARestar = Number(item.cantidad);

            if (stockDisponible < cantidadARestar) {
                return NextResponse.json({ 
                    error: 'Stock insuficiente', 
                    insumo: serverInsumo.nombre,
                    disponible: stockDisponible 
                }, { status: 409 });
            }
        }

        // 4. 🚀 TRANSACCIÓN ATÓMICA (Ejecución de Blindaje)
        // Solo llegamos aquí si todos los ingredientes pasaron la prueba
        let transaction = sanityClientServer.transaction();
        
        receta.forEach(item => {
            transaction = transaction.patch(item.insumoId, p => 
                p.setIfMissing({ stockActual: 0, stockMinimo: 5 }) // Heredado de tu API vieja
                 .dec({ stockActual: Number(item.cantidad) })
            );
        });

        await transaction.commit();

        // 5. 📊 RESPUESTA INTEGRAL (Match con el POS)
        // Re-leemos para devolver el estado final exacto del servidor
        const finales = await sanityClientServer.fetch(
            `*[_id in $ids]{ _id, stockActual, stockMinimo, nombre }`, 
            { ids }
        );

        return NextResponse.json({ 
            success: true, 
            actualizaciones: finales.map(s => ({
                insumoId: s._id,
                nuevoStock: s.stockActual,
                alertaStockBajo: s.stockActual <= (s.stockMinimo ?? 5),
                nombreInsumo: s.nombre
            }))
        });

    } catch (error) {
        console.error('🔥 [SUPER_API_INVENTARIO_ERROR]:', error.message);
        return NextResponse.json({ 
            error: 'Error interno en la transacción de inventario',
            details: error.message 
        }, { status: 500 });
    }
}