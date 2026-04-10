import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export async function POST(request) {
    try {
        const { insumoId, cantidad } = await request.json();

        if (!insumoId || !cantidad) {
            return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
        }

        // 🛡️ BISTURÍ: VALIDACIÓN ATÓMICA PREVIA
        // Leemos el estado actual del insumo directamente del servidor antes de tocar nada
        const insumoActual = await sanityClientServer.fetch(
            `*[_id == $id][0]{stockActual, stockMinimo, nombre}`, 
            { id: insumoId }
        );

        if (!insumoActual) {
            return NextResponse.json({ error: 'Insumo no encontrado' }, { status: 404 });
        }

        // 📏 VALIDACIÓN DE UMBRAL: Si lo que vamos a restar supera lo que hay, abortamos.
        // Usamos un margen de 0.001 por si manejas decimales en recetas de Deli Arepa.
        const stockDisponible = Number(insumoActual.stockActual) || 0;
        const cantidadARestar = Number(cantidad);

        if (stockDisponible < cantidadARestar) {
            return NextResponse.json({ 
                error: 'Stock insuficiente', 
                disponible: stockDisponible 
            }, { status: 409 });
        }

        // 1. Ejecutamos el descuento (Solo llegamos aquí si hay stock suficiente)
        const result = await sanityClientServer
            .patch(insumoId)
            .setIfMissing({ stockActual: 0, stockMinimo: 5 })
            .dec({ stockActual: cantidadARestar })
            .commit();

        // 2. INTEGRACIÓN ALERTA STOCK MÍNIMO
        // Usamos el stockMinimo definido en Sanity o 5 por defecto si no existe
        const umbralMinimo = result.stockMinimo ?? 5;
        const esStockBajo = result.stockActual <= umbralMinimo;

        // 3. RESPUESTA EXITOSA
        return NextResponse.json({ 
            success: true, 
            nuevoStock: result.stockActual,
            alertaStockBajo: esStockBajo, 
            nombreInsumo: result.nombre || insumoActual.nombre
        });

    } catch (error) {
        console.error('🔥 [INVENTARIO_ERROR]:', error.message);
        return NextResponse.json({ 
            error: 'Error interno en el servidor de inventario',
            details: error.message 
        }, { status: 500 });
    }
}