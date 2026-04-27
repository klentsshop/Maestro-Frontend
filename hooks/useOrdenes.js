import useSWR, { mutate as mutateGlobal } from 'swr';
import { useState } from 'react';

const fetcher = (url) => fetch(url).then((res) => {
    if (!res.ok) throw new Error('Error al obtener datos');
    return res.json();
});
export function useOrdenes() {
    const { data: ordenes = [], mutate, error } = useSWR('/api/ordenes/list', fetcher, {
        refreshInterval: 7000, 
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 2000 
    });

    const [cargandoAccion, setCargandoAccion] = useState(false);

    const guardarOrden = async (ordenPayload) => {
        setCargandoAccion(true);
        try {
            // ✅ TODA TU LÓGICA DE VARIABLES ORIGINAL SE MANTIENE
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
            
            // Sincronizamos mesas
            await mutate(); 

            // 🛡️ Solo notificamos al inventario para refrescar la VISTA (Modo Sensor)
            // pero ya no hay esperas de 800ms porque no hubo cambios en DB de stock
            mutateGlobal('/api/inventario/list'); 
            
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

        try {
            // ✅ Mantenemos la petición de borrado exactamente igual
            const res = await fetch('/api/ordenes/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ordenId }),
            });
            
            if (!res.ok) throw new Error("Error al eliminar la orden");
            
            await mutate(); 
            mutateGlobal('/api/inventario/list');

        } catch (error) {
            console.error("❌ Error eliminarOrden:", error);
        }
    };

    // ✅ NO SE OMITE NINGUNA VARIABLE DE RETORNO
    return { ordenes, guardarOrden, eliminarOrden, refresh: mutate, cargandoAccion, errorConexion: error };
}