// 1. IMPORTACIÓN CRÍTICA: Cambiamos 'client' por 'sanityClientServer'
import { sanityClientServer as client } from '@/lib/sanity'; 
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { insumoId, cantidadASumar } = body;

        // 2. Validación de seguridad básica
        if (!insumoId || cantidadASumar === undefined) {
            return NextResponse.json({ error: "Faltan datos (ID o Cantidad)" }, { status: 400 });
        }

        // 3. Forzamos que sea un número para evitar que Sanity lo rechace como texto
        const monto = Number(cantidadASumar);

        // 🚀 OPERACIÓN MAESTRA REFORZADA (Usando el cliente con TOKEN)
        const result = await client
            .patch(insumoId)
            .setIfMissing({ stockActual: 0 }) // Si el campo no existe en Sanity, lo crea en 0
            .inc({ stockActual: monto })      // Suma la cantidad recibida
            .commit();

        console.log(`✅ Sanity: ${insumoId} actualizado. Nuevo stock: ${result.stockActual}`);

        return NextResponse.json({ 
            success: true, 
            nuevoStock: result.stockActual 
        });

    } catch (error) {
        // Si el error es "Mismatched Token" o "Permission Denied", saldrá aquí:
        console.error("🔥 Error real de Sanity en servidor:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}