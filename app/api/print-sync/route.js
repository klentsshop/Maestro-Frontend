import { sanityClientServer } from '@/lib/sanity';
import { NextResponse } from 'next/server';

/**
 * 🛠️ SYNC SERVICE SENIOR: Sincronización de Impresión Multiestación
 * Este archivo garantiza que cada estación (Cable o APK) limpie su rastro 
 * sin pisar el trabajo de las demás.
 */
export async function POST(request) {
    try {
        const { ordenId, campoUltimoKey, ultimaKey, misCategorias } = await request.json();

        if (!ordenId || !ultimaKey) {
            return NextResponse.json({ success: false, error: "Faltan IDs críticos" }, { status: 400 });
        }

        // 1️⃣ PREPARACIÓN DEL PATCH BASE
        // Seteamos los cursores de avance (El ancla del Watcher)
        let patch = sanityClientServer.patch(ordenId).set({
            [campoUltimoKey]: ultimaKey,
            ultimoKeyImpreso: ultimaKey,
            _actualizadoEn: new Date().toISOString() // Vital para que el Listener de la APK reaccione
        });

        // 2️⃣ LIMPIEZA ATÓMICA DE CATEGORÍAS (UNSET)
        // Usamos una doble limpieza: por si el POS las mandó con espacios o sin ellos.
        if (misCategorias && Array.isArray(misCategorias)) {
            const unsets = [];
            misCategorias.forEach(cat => {
                const cleanCat = cat.trim().toUpperCase();
                if (cleanCat) {
                    // Selector exacto de Sanity para borrar elementos específicos de un array
                    unsets.push(`estacionesPendientes[@ == "${cleanCat}"]`);
                }
            });

            if (unsets.length > 0) {
                patch = patch.unset(unsets);
            }
        }

        // 3️⃣ EJECUCIÓN DEL PRIMER PASO (Actualizar cursores y limpiar mi estación)
        // Usamos { visibility: 'async' } para mayor velocidad o omitimos para consistencia total.
        const docActualizado = await patch.commit();

        // 4️⃣ VERIFICACIÓN DE CIERRE GLOBAL (LA CURA)
        // No usamos 'result', volvemos a evaluar el documento real que retorna el commit
        // Si el array de pendientes ya no existe o está vacío, matamos la bandera global.
        const pendientes = docActualizado.estacionesPendientes || [];
        
        // 🚩 REGLA DE ORO: Filtramos "basura" (ceros, nulos o vacíos) que a veces quedan por lag
        const pendientesReales = pendientes.filter(p => p && p !== "0" && p !== "NULL");

        if (pendientesReales.length === 0) {
            console.log(`✅ Orden ${ordenId} completada en todas las estaciones. Apagando bandera.`);
            await sanityClientServer
                .patch(ordenId)
                .set({ 
                    imprimirSolicitada: false,
                    estacionesPendientes: [] // Limpieza total por seguridad
                })
                .commit();
        }

        return NextResponse.json({ 
            success: true, 
            pendientes: pendientesReales.length 
        });

    } catch (error) {
        console.error("🔥 [SYNC_CRITICAL_ERROR]:", error.message);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}