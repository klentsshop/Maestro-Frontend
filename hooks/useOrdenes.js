import useSWR, { mutate as mutateGlobal } from 'swr';
import { useState } from 'react';

const fetcher = (url) => fetch(url).then((res) => {
    if (!res.ok) throw new Error('Error al obtener datos');
    return res.json();
});

export function useOrdenes() {
    // ✅ Sincronización Profesional: Ahorro real sin sacrificar fluidez.
    const { data: ordenes = [], mutate, error } = useSWR('/api/ordenes/list', fetcher, {
        refreshInterval: 7000, 
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 2000 // Protege el listado de órdenes
    });

    const [cargandoAccion, setCargandoAccion] = useState(false);

    const guardarOrden = async (ordenPayload) => {
        setCargandoAccion(true);
        try {
            const payload = {
                ...ordenPayload,
                estado: ordenPayload.estado || 'abierta',
                metodoPago: ordenPayload.metodoPago || 'efectivo',
                imprimirSolicitada: ordenPayload.imprimirSolicitada !== undefined ? ordenPayload.imprimirSolicitada : true,
                imprimirCliente: ordenPayload.imprimirCliente !== undefined ? ordenPayload.imprimirCliente : false,
                ultimaActualizacion: new Date().toISOString()
            };

            const res = await fetch('/api/ordenes/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            
            if (!res.ok) throw new Error("Error al guardar en servidor");
            
            const data = await res.json();
            
            // ✅ Sincronizamos mesas
            await mutate(); 

            // ⏱️ RETRASO TÁCTICO: Esperamos a que Sanity procese el descuento
            await new Promise(resolve => setTimeout(resolve, 800));

            // 🔥 CERO LAG: Notificamos al inventario tras el respiro
            await mutateGlobal('/api/inventario/list'); 
            
            return data;
        } catch (err) {
            console.error("❌ Error guardarOrden:", err);
            throw err; 
        } finally {
            setCargandoAccion(false);
        }
    };

    const eliminarOrden = async (ordenId) => {
        if (!ordenId) return;
        const ordenAEliminar = ordenes.find(o => o._id === ordenId);

        try {
            if (ordenAEliminar && ordenAEliminar.platosOrdenados) {
                const platosParaDevolver = ordenAEliminar.platosOrdenados
                    .filter(p => p.controlaInventario && p.insumoVinculado?._ref)
                    .map(p => ({
                        insumos: [{ 
                            _id: p.insumoVinculado._ref, 
                            cantidad: Number(p.cantidadADescontar) || 1 
                        }],
                        cantidad: Number(p.cantidad) || 1
                    }));

                if (platosParaDevolver.length > 0) {
                    await fetch('/api/inventario/devolver', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ items: platosParaDevolver })
                    });
                }
            }

            const res = await fetch('/api/ordenes/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ordenId }),
            });
            
            if (!res.ok) throw new Error("Error al eliminar la orden");
            
            // Sincronizamos UI de mesas
            await mutate(); 

            // ⏱️ RETRASO TÁCTICO: Esperamos a que Sanity procese la devolución
            await new Promise(resolve => setTimeout(resolve, 800));

            // ✅ Notificación inmediata de stock recuperado tras el respiro
            await mutateGlobal('/api/inventario/list');

        } catch (error) {
            console.error("❌ Error:", error);
        }
    };

    return { ordenes, guardarOrden, eliminarOrden, refresh: mutate, cargandoAccion, errorConexion: error };
}