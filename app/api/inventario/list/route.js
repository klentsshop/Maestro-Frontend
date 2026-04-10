import { sanityClientPublic as client } from '@/lib/sanity';
import { NextResponse } from 'next/server';

// 🛡️ CONFIGURACIÓN DE NEXT.JS PARA EVITAR CACHÉ DEL SERVIDOR
export const dynamic = 'force-dynamic'; 
export const revalidate = 0;

export async function GET() {
    try {
        const query = `*[_type == "inventario"] | order(nombre asc) {
            _id,
            nombre,
            stockActual,
            stockMinimo,
            unidadMedida
        }`;

        // 🚀 CORRECCIÓN DE ALERTA:
        // Mantenemos useCdn: false para datos en tiempo real.
        // Dejamos solo 'cache: no-store' que es suficiente para decirle a Next.js 
        // que no guarde esta lista y así eliminamos el aviso amarillo de la terminal.
        const insumos = await client.fetch(
            query, 
            {}, 
            { 
                useCdn: false, 
                cache: 'no-store' 
            }
        );

        // ✅ RESPUESTA CON HEADERS AGRESIVOS ANTI-CACHÉ
        // Esto obliga al navegador y a los meseros a ver la realidad de Sanity al instante.
        return new NextResponse(JSON.stringify(insumos), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });
    } catch (error) {
        console.error("❌ Error listando inventario:", error);
        return NextResponse.json({ error: "Error al obtener inventario" }, { status: 500 });
    }
}